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

class AudioQueueService {
  private audio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
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
      this.log("[AI_TTS] Queue processing skipped - recording");
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

      // 建立或取得 Audio element
      if (!this.audio) {
        this.audio = new Audio();
      }

      // 停止當前播放
      this.stopCurrent();

      // 設定新音檔
      this.audio.src = item.url;
      this.audio.volume = 1;
      this.audio.muted = false;
      this.audio.playbackRate = this.state.playbackRate;

      // 等待 canplay
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Audio load timeout"));
        }, 10000);

        this.audio!.oncanplay = () => {
          clearTimeout(timeout);
          this.log("[AI_TTS] Audio canplay received");
          resolve();
        };

        this.audio!.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Audio load error"));
        };

        this.audio!.onloadedmetadata = () => {
          this.log("[AI_TTS] Audio loadedmetadata received");
        };
      });

      // 播放
      this.setState({ state: "playing" });
      item.onStart?.();

      this.log("[AI_TTS] Calling audio.play()");
      await this.audio.play();
      this.log("[AI_TTS] audio.play() succeeded");

      // 等待播放結束
      await new Promise<void>((resolve) => {
        this.audio!.onended = () => {
          this.log("[AI_TTS] Audio ended");
          resolve();
        };

        this.audio!.onerror = (e) => {
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

    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.src = "";
      } catch (error) {
        this.log("[AI_TTS] Stop current error", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (this.state.currentItem) {
      this.state.currentItem.onEnd?.();
    }

    this.setState({
      state: "ready",
      currentItem: null,
    });
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
      // 錄音結束後等待 300ms 再處理佇列
      setTimeout(() => {
        if (!this.state.recording) {
          this.processQueue();
        }
      }, 300);
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

    // 如果正在播放，即時應用新速度
    if (this.audio && this.state.state === "playing") {
      this.audio.playbackRate = rate;
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
    
    console.log(`[AI_TTS] ${message}`, logData);
  }
}

// 單例
export const audioQueueService = new AudioQueueService();
