/**
 * One shared audio queue for tutor, article, and word audio.
 *
 * Important: the previous implementation assigned the new queue item as
 * currentItem before stopping the previous item. stopCurrent() then invoked the
 * NEW item's onEnd callback before audio.play(), which made the tutor visual
 * indicator immediately turn off. This version always clears the old item first
 * and invokes each callback at most once.
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
  private state: AudioState = {
    state: "locked",
    currentItem: null,
    queue: [],
    audioUnlocked: false,
    autoPlayTutorVoice: true,
    recording: false,
    playbackRate: 1,
  };
  private listeners = new Set<(state: AudioState) => void>();
  private playbackToken = 0;
  private cancelPendingWait: (() => void) | null = null;

  private ensureAudio(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = "auto";
      this.audio.playsInline = true;
    }
    return this.audio;
  }

  async unlockAudio(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if (this.state.audioUnlocked) return true;

    this.setState({ state: "unlocking" });
    try {
      const audio = this.ensureAudio();
      const silence = this.createSilentAudio();
      audio.oncanplay = null;
      audio.onended = null;
      audio.onerror = null;
      audio.src = silence;
      audio.volume = 0;
      audio.muted = true;
      await audio.play();
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(silence);
      audio.volume = 1;
      audio.muted = false;
      this.setState({ state: "ready", audioUnlocked: true });
      this.log("Audio unlocked");
      return true;
    } catch (error) {
      this.setState({ state: "error", audioUnlocked: false });
      this.log("Audio unlock failed", { error: this.errorText(error) });
      return false;
    }
  }

  enqueue(item: AudioQueueItem): void {
    const queue = [...this.state.queue, item];
    this.setState({ queue });
    this.log("Enqueued audio", { id: item.id, priority: item.priority, queueLength: queue.length });
    void this.processQueue();
  }

  clearQueue(): void {
    this.stopCurrent();
    this.setState({ queue: [] });
  }

  stopCurrent(): void {
    const current = this.state.currentItem;
    this.playbackToken += 1;
    this.cancelPendingWait?.();
    this.cancelPendingWait = null;
    this.detachAudioHandlers();

    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.removeAttribute("src");
        this.audio.load();
      } catch {
        // Browsers can reject resetting an already detached media element.
      }
    }

    this.setState({
      state: this.state.recording ? "recording" : "ready",
      currentItem: null,
    });

    // The callback belongs only to the item that was actually current before it
    // was stopped. Never invoke a newly queued item's onEnd here.
    current?.onEnd?.();
  }

  setRecording(recording: boolean): void {
    if (recording) {
      this.setState({ recording: true });
      this.stopCurrent();
      this.setState({ state: "recording", recording: true });
      return;
    }

    this.setState({
      recording: false,
      state: this.state.currentItem ? this.state.state : "ready",
    });
    window.setTimeout(() => {
      if (!this.state.recording) void this.processQueue();
    }, 300);
  }

  setAutoPlayTutorVoice(autoPlay: boolean): void {
    this.setState({ autoPlayTutorVoice: autoPlay });
  }

  setPlaybackRate(rate: number): void {
    const playbackRate = Math.max(0.75, Math.min(1.25, Number(rate) || 1));
    this.setState({ playbackRate });
    if (this.audio && this.state.state === "playing") this.audio.playbackRate = playbackRate;
  }

  getPlaybackRate(): number {
    return this.state.playbackRate;
  }

  getState(): AudioState {
    return { ...this.state, queue: [...this.state.queue] };
  }

  subscribe(listener: (state: AudioState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async processQueue(): Promise<void> {
    if (this.state.state === "playing" || this.state.state === "loading" || this.state.currentItem) return;
    if (this.state.recording || this.state.queue.length === 0) return;

    const sorted = [...this.state.queue].sort((a, b) => b.priority - a.priority);
    const item = sorted.shift();
    if (!item) return;
    this.setState({ queue: sorted });
    await this.playItem(item);
  }

  private async playItem(item: AudioQueueItem): Promise<void> {
    // Clear only a previously active item before this item becomes current.
    if (this.state.currentItem) this.stopCurrent();

    const token = ++this.playbackToken;
    this.setState({ state: "loading", currentItem: item });

    try {
      if (!this.state.audioUnlocked && !(await this.unlockAudio())) {
        throw new Error("Audio unlock failed");
      }
      if (!this.isActive(token, item)) return;

      const audio = this.ensureAudio();
      this.detachAudioHandlers();
      audio.pause();
      audio.currentTime = 0;
      audio.src = item.url;
      audio.volume = 1;
      audio.muted = false;
      audio.playbackRate = this.state.playbackRate;

      await this.waitForCanPlay(audio, token, item);
      if (!this.isActive(token, item)) return;

      this.setState({ state: "playing" });
      await audio.play();
      if (!this.isActive(token, item)) return;

      item.onStart?.();
      this.log("Audio playback started", { id: item.id });
      await this.waitForEnd(audio, token, item);
      if (!this.isActive(token, item)) return;

      this.finishItem(item, token);
    } catch (error) {
      if (!this.isActive(token, item)) return;
      this.failItem(item, token, error instanceof Error ? error : new Error(String(error)));
    }
  }

  private waitForCanPlay(audio: HTMLAudioElement, token: number, item: AudioQueueItem): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (this.cancelPendingWait === cancel) this.cancelPendingWait = null;
        callback();
      };
      const cancel = () => finish(() => resolve());
      const timeout = window.setTimeout(() => finish(() => reject(new Error("Audio load timeout"))), 10000);
      this.cancelPendingWait = cancel;
      audio.oncanplay = () => finish(resolve);
      audio.onerror = () => finish(() => reject(new Error("Audio load error")));

      if (!this.isActive(token, item)) cancel();
    });
  }

  private waitForEnd(audio: HTMLAudioElement, token: number, item: AudioQueueItem): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        if (this.cancelPendingWait === cancel) this.cancelPendingWait = null;
        callback();
      };
      const cancel = () => finish(resolve);
      this.cancelPendingWait = cancel;
      audio.onended = () => finish(resolve);
      audio.onerror = () => finish(() => reject(new Error("Audio playback error")));
      if (!this.isActive(token, item)) cancel();
    });
  }

  private finishItem(item: AudioQueueItem, token: number): void {
    if (!this.isActive(token, item)) return;
    this.detachAudioHandlers();
    this.setState({ state: "ready", currentItem: null });
    item.onEnd?.();
    this.log("Audio playback ended", { id: item.id });
    void this.processQueue();
  }

  private failItem(item: AudioQueueItem, token: number, error: Error): void {
    if (!this.isActive(token, item)) return;
    this.detachAudioHandlers();
    this.setState({ state: "error", currentItem: null });
    this.log("Audio playback failed", { id: item.id, error: error.message });
    item.onError?.(error);
    void this.processQueue();
  }

  private isActive(token: number, item: AudioQueueItem): boolean {
    return this.playbackToken === token && this.state.currentItem?.id === item.id;
  }

  private detachAudioHandlers(): void {
    if (!this.audio) return;
    this.audio.oncanplay = null;
    this.audio.onended = null;
    this.audio.onerror = null;
    this.audio.onloadedmetadata = null;
  }

  private setState(partial: Partial<AudioState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => {
      try {
        listener(this.getState());
      } catch {
        // A UI subscriber must not be able to break audio playback.
      }
    });
  }

  private createSilentAudio(): string {
    const sampleRate = 8000;
    const samples = 800;
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    const write = (offset: number, value: string) => {
      for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
    };
    write(0, "RIFF");
    view.setUint32(4, 36 + samples * 2, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, samples * 2, true);
    return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  }

  private errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private log(message: string, data?: Record<string, unknown>): void {
    console.log(`[AI_TTS] ${message}`, { ...data, time: new Date().toISOString() });
  }
}

export const audioQueueService = new AudioQueueService();
