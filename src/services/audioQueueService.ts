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

type PlaybackSession = {
  id: number;
  item: AudioQueueItem;
  started: boolean;
  ended: boolean;
  canceled: boolean;
  loadTimer?: number;
  cleanups: Array<() => void>;
};

const AUDIO_LOAD_TIMEOUT_MS = 10000;

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
  private platform = "web";
  private browser = "unknown";
  private activeSession: PlaybackSession | null = null;
  private sessionSeq = 0;
  private processing = false;

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
    if (/iPad|iPhone|iPod/.test(ua)) this.platform = "ios";
    else if (/Android/.test(ua)) this.platform = "android";
    else this.platform = "web";

    if (/Safari/.test(ua) && !/Chrome/.test(ua)) this.browser = "safari";
    else if (/Chrome/.test(ua)) this.browser = "chrome";
    else if (/Firefox/.test(ua)) this.browser = "firefox";
    else if (/FBAV|FB_IAB|FBAN/.test(ua)) this.browser = "facebook";
    else if (/Line/.test(ua)) this.browser = "line";
    else this.browser = "unknown";
  }

  async unlockAudio(): Promise<boolean> {
    this.log("[AI_TTS] unlockAudio called", {
      currentState: this.state.state,
      audioUnlocked: this.state.audioUnlocked,
    });

    if (this.state.audioUnlocked) {
      this.log("[AI_TTS] audio unlocked", { alreadyUnlocked: true });
      return true;
    }

    this.setState({ state: "unlocking" });

    try {
      const audio = this.ensureAudio();
      if (!this.audioContext && typeof window !== "undefined") {
        const AudioContextCtor =
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextCtor) this.audioContext = new AudioContextCtor();
      }

      const silentUrl = this.createSilentAudio();
      audio.src = silentUrl;
      audio.volume = 0;
      await audio.play();
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(silentUrl);

      this.setState({ state: "ready", audioUnlocked: true });
      this.log("[AI_TTS] audio unlocked", { platform: this.platform, browser: this.browser });
      return true;
    } catch (error) {
      this.log("[AI_TTS] playback failed", {
        stage: "unlock",
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : "Unknown",
      });
      this.setState({ state: "error", audioUnlocked: false });
      return false;
    } finally {
      if (this.audio) this.audio.volume = 1;
    }
  }

  private ensureAudio(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = "auto";
      this.audio.setAttribute("playsinline", "true");
      this.audio.setAttribute("webkit-playsinline", "true");
    }
    return this.audio;
  }

  private createSilentAudio(): string {
    const sampleRate = 44100;
    const samples = sampleRate * 0.1;
    const buffer = new Float32Array(samples);
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);

    const writeString = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
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
      const value = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      wavData[44 + i * 2] = value;
      wavData[45 + i * 2] = value >> 8;
    }

    return URL.createObjectURL(new Blob([wavData], { type: "audio/wav" }));
  }

  enqueue(item: AudioQueueItem): void {
    this.log("[AI_TTS] queue item enqueued", {
      id: item.id,
      textLength: item.text?.length ?? 0,
      priority: item.priority,
      queueLength: this.state.queue.length,
    });

    this.state.queue.push(item);
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.activeSession || this.state.state === "playing" || this.state.state === "loading") return;
    if (this.state.queue.length === 0) return;
    if (this.state.recording) {
      this.log("[AI_TTS] playback skipped reason", { reason: "recording still active" });
      return;
    }

    this.processing = true;
    this.state.queue.sort((a, b) => b.priority - a.priority);
    const item = this.state.queue.shift()!;
    try {
      await this.playItem(item);
    } finally {
      this.processing = false;
      if (!this.state.recording && this.state.queue.length > 0) void this.processQueue();
    }
  }

  private async playItem(item: AudioQueueItem): Promise<void> {
    this.log("[AI_TTS] Play item", {
      id: item.id,
      urlType: item.url.startsWith("blob:") ? "blob" : item.url.startsWith("stub:") ? "stub" : "remote",
      textLength: item.text?.length ?? 0,
    });

    this.stopCurrent();

    const session: PlaybackSession = {
      id: ++this.sessionSeq,
      item,
      started: false,
      ended: false,
      canceled: false,
      cleanups: [],
    };
    this.activeSession = session;
    this.setState({ state: "loading", currentItem: item });

    try {
      if (!this.state.audioUnlocked) {
        const unlocked = await this.unlockAudio();
        if (!unlocked) {
          this.log("[AI_TTS] playback unlock unavailable; trying direct play", {
            id: item.id,
          });
        }
        if (!this.isActiveSession(session)) return;
      }

      const audio = this.ensureAudio();
      this.resetAudioHandlers(audio);
      audio.src = item.url;
      audio.volume = 1;
      audio.muted = false;
      audio.playbackRate = this.state.playbackRate;

      await this.playWithTimeout(audio, session);
      if (!this.isActiveSession(session)) return;

      this.setState({ state: "playing" });
      this.markStarted(session);
      await this.waitForEnded(audio, session);
      if (!this.isActiveSession(session)) return;

      this.finishSession(session, "natural");
    } catch (error) {
      if (!this.isActiveSession(session)) return;
      const playbackError = error instanceof Error ? error : new Error(String(error));
      this.log("[AI_TTS] playback failed", {
        id: item.id,
        error: playbackError.message,
        errorName: playbackError.name,
      });
      this.finishSession(session, "error", playbackError);
    }
  }

  private playWithTimeout(audio: HTMLAudioElement, session: PlaybackSession): Promise<void> {
    return new Promise((resolve, reject) => {
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        if (session.loadTimer) window.clearTimeout(session.loadTimer);
        audio.removeEventListener("error", handleError);
      };
      const handleError = () => {
        cleanup();
        reject(new Error("signed URL invalid or audio load error"));
      };
      session.loadTimer = window.setTimeout(() => {
        cleanup();
        reject(new Error("Audio load timeout"));
      }, AUDIO_LOAD_TIMEOUT_MS);
      session.cleanups.push(cleanup);
      audio.addEventListener("error", handleError, { once: true });
      audio.load();
      audio.play()
        .then(() => {
          cleanup();
          resolve();
        })
        .catch((error) => {
          cleanup();
          reject(new Error(`audio.play() rejected: ${error instanceof Error ? error.message : String(error)}`));
        });
    });
  }

  private waitForEnded(audio: HTMLAudioElement, session: PlaybackSession): Promise<void> {
    return new Promise((resolve, reject) => {
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        audio.removeEventListener("ended", handleEnded);
        audio.removeEventListener("error", handleError);
      };
      const handleEnded = () => {
        cleanup();
        resolve();
      };
      const handleError = () => {
        cleanup();
        reject(new Error("Audio playback error"));
      };
      session.cleanups.push(cleanup);
      audio.addEventListener("ended", handleEnded, { once: true });
      audio.addEventListener("error", handleError, { once: true });
    });
  }

  private isActiveSession(session: PlaybackSession): boolean {
    return this.activeSession === session && !session.canceled;
  }

  private markStarted(session: PlaybackSession) {
    if (session.started || session.canceled) return;
    session.started = true;
    this.log("[AI_TTS] playback started", { id: session.item.id });
    session.item.onStart?.();
  }

  private finishSession(session: PlaybackSession, reason: "natural" | "manual" | "error", error?: Error) {
    if (session.ended) return;
    session.ended = true;
    session.canceled = true;
    if (session.loadTimer) window.clearTimeout(session.loadTimer);
    session.cleanups.splice(0).forEach((cleanup) => cleanup());

    const audio = this.audio;
    if (audio) {
      this.resetAudioHandlers(audio);
      if (reason !== "natural") {
        try {
          audio.pause();
          audio.removeAttribute("src");
          audio.load();
        } catch {
          /* ignore */
        }
      }
    }

    if (this.activeSession === session) this.activeSession = null;
    this.setState({ state: reason === "error" ? "error" : "ready", currentItem: null });

    if (error) session.item.onError?.(error);
    if (session.started) {
      this.log("[AI_TTS] playback ended", { id: session.item.id, reason });
      session.item.onEnd?.();
    }
  }

  private resetAudioHandlers(audio: HTMLAudioElement) {
    audio.oncanplay = null;
    audio.onloadedmetadata = null;
    audio.onerror = null;
    audio.onended = null;
    audio.onplay = null;
  }

  stopCurrent(): void {
    this.log("[AI_TTS] Stop current");
    const session = this.activeSession;
    if (session) {
      this.finishSession(session, "manual");
      return;
    }

    if (this.audio) {
      try {
        this.resetAudioHandlers(this.audio);
        this.audio.pause();
        this.audio.removeAttribute("src");
        this.audio.load();
      } catch (error) {
        this.log("[AI_TTS] Stop current error", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.setState({ state: this.state.recording ? "recording" : "ready", currentItem: null });
  }

  clearQueue(): void {
    this.log("[AI_TTS] Clear queue", { queueLength: this.state.queue.length });
    this.state.queue = [];
    this.stopCurrent();
  }

  setRecording(recording: boolean): void {
    this.log("[AI_TTS] Set recording", { recording, previousState: this.state.recording });
    this.state.recording = recording;

    if (recording) {
      this.stopCurrent();
      this.setState({ state: "recording", recording: true });
      return;
    }

    this.setState({ recording: false, state: this.activeSession ? this.state.state : "ready" });
    window.setTimeout(() => {
      if (!this.state.recording) void this.processQueue();
    }, 300);
  }

  setAutoPlayTutorVoice(autoPlay: boolean): void {
    this.log("[AI_TTS] Set autoPlayTutorVoice", { autoPlay, previous: this.state.autoPlayTutorVoice });
    this.state.autoPlayTutorVoice = autoPlay;
  }

  setPlaybackRate(rate: number): void {
    this.log("[AI_TTS] Set playback rate", { rate, previous: this.state.playbackRate });
    this.state.playbackRate = rate;
    if (this.audio && this.state.state === "playing") this.audio.playbackRate = rate;
  }

  getPlaybackRate(): number {
    return this.state.playbackRate;
  }

  getState(): AudioState {
    return { ...this.state, queue: [...this.state.queue] };
  }

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

  private log(message: string, data?: Record<string, unknown>): void {
    console.log(message.startsWith("[AI_TTS]") ? message : `[AI_TTS] ${message}`, {
      ...data,
      timestamp: new Date().toISOString(),
      platform: this.platform,
      browser: this.browser,
    });
  }
}

export const audioQueueService = new AudioQueueService();
