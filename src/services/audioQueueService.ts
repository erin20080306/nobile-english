/**
 * 全 App 單一 Audio Queue 服務
 * 
 * 處理：
 * - Audio Unlock 機制（iOS Safari 自動播放限制）
 * - 全 App 單一 Audio Queue
 * - 音檔載入與播放保護
 * - 統一 AI_TTS debug log
 */

export type AudioPlaybackState =
  | "locked"
  | "unlocking"
  | "ready"
  | "loading"
  | "playing"
  | "paused"
  | "recording"
  | "error";

interface AudioQueueItem {
  id: string;
  url: string;
  text?: string;
  priority: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

interface AudioState {
  state: AudioPlaybackState;
  currentItem: AudioQueueItem | null;
  queue: AudioQueueItem[];
  audioUnlocked: boolean;
  autoPlayTutorVoice: boolean;
  recording: boolean;
  playbackRate: number;
}

const PLAYBACK_GAIN = 2.0;

class AudioQueueService {
  private audio: HTMLAudioElement | null = null;
  // Second, untapped <audio> element used whenever playbackRate !== 1.
  // Once an element is passed to AudioContext.createMediaElementSource, its
  // native audio output pipeline is permanently replaced by the Web Audio
  // graph. On several browsers (notably Chrome), combining that graph with
  // a non-1 playbackRate produces crackling/garbled audio. Keeping a
  // separate, never-tapped element for sped-up/slowed-down playback avoids
  // touching the Web Audio graph entirely for those cases.
  private audioPlain: HTMLAudioElement | null = null;
  private activeAudio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private state: AudioState = {
    state: "locked",
    currentItem: null,
    queue: [],
    audioUnlocked: false,
    autoPlayTutorVoice: true,
    recording: false,
    playbackRate: 1.0,
  };
  private listeners: Set<(state: AudioState) => void> = new Set();
  private platform: string = "web";
  private browser: string = "unknown";

  constructor() {
    this.detectPlatform();
    this.log("[AI_TTS] AudioQueueService initialized", {
      platform: this.platform,
      browser: this.browser,
      state: this.state.state,
    });
  }

  private detectPlatform() {
    if (typeof window === "undefined") {
      this.platform = "server";
      this.browser = "server";
      return;
    }

    const ua = navigator.userAgent;
    
    // Detect platform
    if (/iPad|iPhone|iPod/.test(ua)) {
      this.platform = "ios";
    } else if (/Android/.test(ua)) {
      this.platform = "android";
    } else {
      this.platform = "web";
    }

    // Detect browser
    if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
      this.browser = "safari";
    } else if (/Chrome/.test(ua)) {
      this.browser = "chrome";
    } else if (/Firefox/.test(ua)) {
      this.browser = "firefox";
    } else if (/FBAV|FB_IAB|FBAN/.test(ua)) {
      this.browser = "facebook";
    } else if (/Line/.test(ua)) {
      this.browser = "line";
    } else {
      this.browser = "unknown";
    }
  }

  /**
   * Audio Unlock 機制
   * 使用者第一次互動時解鎖音訊
   */
  async unlockAudio(): Promise<boolean> {
    this.log("[AI_TTS] unlockAudio called", {
      currentState: this.state.state,
      audioUnlocked: this.state.audioUnlocked,
    });

    if (this.state.audioUnlocked) {
      this.log("[AI_TTS] Audio already unlocked");
      return true;
    }

    this.setState({ state: "unlocking" });

    try {
      // 建立或取得 Audio element
      if (!this.audio) {
        this.audio = new Audio();
        // Required so createMediaElementSource (used by the gain node below)
        // doesn't "taint" cross-origin audio (e.g. Supabase Storage signed
        // URLs) as silent. Must be set before the element ever loads a src.
        this.audio.crossOrigin = "anonymous";
      }

      // 建立 AudioContext
      if (!this.audioContext) {
        const AudioContextCtor =
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextCtor) {
          this.audioContext = new AudioContextCtor();
        }
      }

      // 建立音量增益節點（只需建立一次，重複使用同一個 Audio element）
      this.ensureGainNode();

      // 播放極短靜音音檔解鎖
      const silentUrl = this.createSilentAudio();
      this.audio.src = silentUrl;
      this.audio.volume = 0;
      
      await this.audio.play();
      this.audio.pause();
      
      // 清理
      URL.revokeObjectURL(silentUrl);
      this.audio.src = "";

      this.setState({
        state: "ready",
        audioUnlocked: true,
      });

      this.log("[AI_TTS] Audio unlocked successfully");
      return true;
    } catch (error) {
      this.log("[AI_TTS] Audio unlock failed", {
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : "Unknown",
      });
      
      this.setState({
        state: "error",
        audioUnlocked: false,
      });
      
      return false;
    }
  }

  /** 取得（必要時建立）經 Web Audio GainNode 加強音量的 audio element。 */
  private ensureBoostedAudio(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.crossOrigin = "anonymous";
    }
    return this.audio;
  }

  /**
   * 取得（必要時建立）完全不經過 Web Audio 圖表的 audio element，
   * 用於非 1 倍語速播放，避免雜聲/爆音。這個 element 永遠不會被傳入
   * createMediaElementSource，因此保留瀏覽器原生的 playbackRate 處理。
   */
  private ensurePlainAudio(): HTMLAudioElement {
    if (!this.audioPlain) {
      this.audioPlain = new Audio();
      this.audioPlain.crossOrigin = "anonymous";
    }
    return this.audioPlain;
  }

  /**
   * 建立一次性的 MediaElementSource -> GainNode -> destination 音訊圖，
   * 用來提升伺服器產生的 TTS/朗讀音檔音量。瀏覽器限制同一個 <audio>
   * element 只能呼叫一次 createMediaElementSource，因此這裡快取結果並
   * 在往後每次換 src 播放時重複使用同一個 gain node。
   */
  private ensureGainNode(): void {
    if (!this.audio || !this.audioContext || this.gainNode) return;
    try {
      const source = this.audioContext.createMediaElementSource(this.audio);
      const gain = this.audioContext.createGain();
      gain.gain.value = PLAYBACK_GAIN;
      source.connect(gain);
      gain.connect(this.audioContext.destination);
      this.gainNode = gain;
    } catch (error) {
      this.log("[AI_TTS] ensureGainNode failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private createSilentAudio(): string {
    // 建立極短靜音音檔
    const sampleRate = 44100;
    const samples = sampleRate * 0.1; // 0.1 秒
    const buffer = new Float32Array(samples);
    
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, samples * 2, true);
    
    const wavData = new Uint8Array(wavHeader.byteLength + samples * 2);
    wavData.set(new Uint8Array(wavHeader), 0);
    
    for (let i = 0; i < samples; i++) {
      const sample = Math.max(-1, Math.min(1, buffer[i]));
      wavData[44 + i * 2] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      wavData[45 + i * 2] = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) >> 8;
    }
    
    const blob = new Blob([wavData], { type: "audio/wav" });
    return URL.createObjectURL(blob);
  }

  /**
   * 加入音檔到佇列
   */
  enqueue(item: AudioQueueItem): void {
    this.log("[AI_TTS] Enqueue item", {
      id: item.id,
      text: item.text,
      priority: item.priority,
      queueLength: this.state.queue.length,
    });

    this.state.queue.push(item);
    this.processQueue();
  }

  /**
   * 處理音檔佇列
   */
  private async processQueue(): Promise<void> {
    if (this.state.state === "playing" || this.state.state === "loading") {
      this.log("[AI_TTS] Queue processing skipped - busy");
      return;
    }

    if (this.state.queue.length === 0) {
      this.log("[AI_TTS] Queue empty");
      return;
    }

    if (this.state.recording) {
      this.log("[AI_TTS] playback skipped reason", {
        reason: "recording still active",
      });
      return;
    }

    // 取得優先級最高的項目
    this.state.queue.sort((a, b) => b.priority - a.priority);
    const item = this.state.queue.shift()!;

    await this.playItem(item);
  }

  /**
   * 播放單一音檔
   */
  private async playItem(item: AudioQueueItem): Promise<void> {
    this.log("[AI_TTS] Play item", {
      id: item.id,
      url: item.url,
      text: item.text,
    });

    // 停止前一個項目，必須在設定新 currentItem 之前，否則 stopCurrent 會對新項目觸發 onEnd
    this.stopCurrent();

    this.setState({
      state: "loading",
      currentItem: item,
    });

    try {
      // 確認 Audio unlocked
      if (!this.state.audioUnlocked) {
        const unlocked = await this.unlockAudio();
        if (!unlocked) {
          throw new Error("Audio unlock failed");
        }
      }

      // 建立或取得 Audio element。語速不是 1 時改用完全不經過 Web Audio
      // 圖表的獨立 element，避免 MediaElementSource + 非 1 倍語速在部分
      // 瀏覽器上產生雜聲/爆音（一旦 element 被 createMediaElementSource
      // 接管，就無法再回到原生播放路徑，因此必須用另一個乾淨的 element）。
      const useBoosted = this.state.playbackRate === 1;
      const audio = useBoosted ? this.ensureBoostedAudio() : this.ensurePlainAudio();
      this.activeAudio = audio;
      // 確保另一個未使用的 element 是停止狀態，避免雙重播放
      const other = useBoosted ? this.audioPlain : this.audio;
      if (other) {
        try {
          other.pause();
        } catch {
          /* ignore */
        }
      }

      if (useBoosted) {
        this.ensureGainNode();
        if (this.audioContext && this.audioContext.state === "suspended") {
          await this.audioContext.resume().catch(() => undefined);
        }
      }

      // 設定新音檔
      audio.src = item.url;
      audio.volume = 1;
      audio.muted = false;
      audio.playbackRate = this.state.playbackRate;
      // 保險起見，非 1 倍語速時仍關閉 preservesPitch，簡化重採樣路徑。
      this.applyPreservesPitch(audio, useBoosted);

      // 等待 canplay
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Audio load timeout"));
        }, 10000);

        audio.oncanplay = () => {
          clearTimeout(timeout);
          this.log("[AI_TTS] Audio canplay received");
          resolve();
        };

        audio.onerror = () => {
          clearTimeout(timeout);
          this.log("[AI_TTS] playback skipped reason", {
            reason: "signed URL 失效",
          });
          reject(new Error("signed URL invalid or audio load error"));
        };

        audio.onloadedmetadata = () => {
          this.log("[AI_TTS] Audio loadedmetadata received");
        };
      });

      // 播放
      this.setState({ state: "playing" });

      this.log("[AI_TTS] Calling audio.play()");
      try {
        await audio.play();
      } catch (error) {
        this.log("[AI_TTS] playback skipped reason", {
          reason: "audio.play() 被拒絕",
          error: error instanceof Error ? error.message : String(error),
          errorName: error instanceof Error ? error.name : "Unknown",
        });
        throw new Error(`audio.play() rejected: ${error instanceof Error ? error.message : String(error)}`);
      }
      this.log("[AI_TTS] audio.play() succeeded");
      item.onStart?.();

      // 等待播放結束
      await new Promise<void>((resolve) => {
        audio.onended = () => {
          this.log("[AI_TTS] Audio ended");
          resolve();
        };

        audio.onerror = (e: Event | string) => {
          this.log("[AI_TTS] Audio error during playback", {
            error: e,
          });
          resolve();
        };
      });

      this.setState({
        state: "ready",
        currentItem: null,
      });

      item.onEnd?.();

      // 處理下一個項目
      this.processQueue();
    } catch (error) {
      this.log("[AI_TTS] Play item failed", {
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : "Unknown",
      });

      this.setState({
        state: "error",
        currentItem: null,
      });

      item.onError?.(error instanceof Error ? error : new Error(String(error)));

      // 處理下一個項目
      this.processQueue();
    }
  }

  /**
   * 停止當前播放
   */
  stopCurrent(): void {
    this.log("[AI_TTS] Stop current");

    for (const audio of [this.audio, this.audioPlain]) {
      if (!audio) continue;
      try {
        // 清除事件處理器，避免舊的 handler 對新音檔誤觸發
        audio.oncanplay = null;
        audio.onloadedmetadata = null;
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.currentTime = 0;
        audio.src = "";
      } catch (error) {
        this.log("[AI_TTS] Stop current error", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    this.activeAudio = null;

    const stoppingItem = this.state.currentItem;
    this.setState({
      state: "ready",
      currentItem: null,
    });

    // 先清除 currentItem 再呼叫 onEnd，避免重入問題
    if (stoppingItem) {
      stoppingItem.onEnd?.();
    }
  }

  /**
   * 清空佇列
   */
  clearQueue(): void {
    this.log("[AI_TTS] Clear queue", {
      queueLength: this.state.queue.length,
    });

    this.stopCurrent();
    this.state.queue = [];
  }

  /**
   * 設定錄音狀態
   */
  setRecording(recording: boolean): void {
    this.log("[AI_TTS] Set recording", {
      recording,
      previousState: this.state.recording,
    });

    this.state.recording = recording;

    if (recording) {
      // 錄音時停止播放
      this.stopCurrent();
      this.setState({ state: "recording" });
    } else {
      // 錄音結束後短暫等待再處理佇列，讓導師回覆更快開始播放
      setTimeout(() => {
        if (!this.state.recording) {
          this.processQueue();
        }
      }, 50);
    }
  }

  /**
   * 設定自動播放導師語音
   */
  setAutoPlayTutorVoice(autoPlay: boolean): void {
    this.log("[AI_TTS] Set autoPlayTutorVoice", {
      autoPlay,
      previous: this.state.autoPlayTutorVoice,
    });

    this.state.autoPlayTutorVoice = autoPlay;
  }

  /**
   * 設定播放速度
   */
  setPlaybackRate(rate: number): void {
    this.log("[AI_TTS] Set playback rate", {
      rate,
      previous: this.state.playbackRate,
    });

    this.state.playbackRate = rate;

    // 如果正在播放，即時應用新速度。注意：是否使用加強音量的 element
    // 只在下一次 playItem 時重新判斷（呼叫端通常會重新播放當前句子），
    // 這裡僅針對目前正在播放的 element 更新語速，避免播放中途切換
    // element 造成中斷。
    if (this.activeAudio && this.state.state === "playing") {
      this.activeAudio.playbackRate = rate;
      this.applyPreservesPitch(this.activeAudio, rate === 1);
    }
  }

  /**
   * 語速不是 1 時關閉 preservesPitch，避免部分瀏覽器（尤其 Chrome）在
   * MediaElementSource + GainNode 音訊圖搭配非 1 倍語速時產生雜聲/爆音。
   */
  private applyPreservesPitch(audio: HTMLAudioElement, preserve: boolean): void {
    try {
      const a = audio as HTMLAudioElement & {
        preservesPitch?: boolean;
        webkitPreservesPitch?: boolean;
        mozPreservesPitch?: boolean;
      };
      a.preservesPitch = preserve;
      a.webkitPreservesPitch = preserve;
      a.mozPreservesPitch = preserve;
    } catch {
      /* ignore unsupported browsers */
    }
  }

  /**
   * 取得播放速度
   */
  getPlaybackRate(): number {
    return this.state.playbackRate;
  }

  /**
   * 取得當前狀態
   */
  getState(): AudioState {
    return { ...this.state };
  }

  /**
   * 訂閱狀態變更
   */
  subscribe(listener: (state: AudioState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(partial: Partial<AudioState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.getState());
      } catch (error) {
        console.error("[AI_TTS] Listener error:", error);
      }
    });
  }

  private log(message: string, data?: any): void {
    const logData = {
      ...data,
      timestamp: new Date().toISOString(),
      platform: this.platform,
      browser: this.browser,
    };

    console.log(message.startsWith("[AI_TTS]") ? message : `[AI_TTS] ${message}`, logData);
  }
}

// 單例
export const audioQueueService = new AudioQueueService();
