"use client";

// Records short voice clips from the microphone (for server-side Speech-to-
// Text via Google Cloud), auto-stopping on silence or after a hard cap, to
// keep both latency and API cost low. This is intentionally independent
// from speechService's live SpeechRecognition-based listen() — recorded
// audio here is uploaded once, as a single blob, to our own backend.

export interface VoiceRecorderOptions {
  /** Hard cap on recording length. Default 15000ms per cost-control spec. */
  maxDurationMs?: number;
  /** How long of continuous silence before auto-stopping. Default 1300ms. */
  silenceMs?: number;
  /** Minimum time before silence detection kicks in, so the user has time to start speaking. */
  graceMs?: number;
  onStop?: (blob: Blob, mimeType: string) => void;
  onError?: (message: string) => void;
  /** Fired repeatedly while recording with a 0..1 volume level, for UI meters. */
  onLevel?: (level: number) => void;
}

export interface VoiceRecorderHandle {
  stop: () => void;
  cancel: () => void;
}

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(type)) {
      return type;
    }
  }
  return "";
}

export const voiceRecorderService = {
  isSupported(): boolean {
    return (
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== "undefined"
    );
  },

  async start(options: VoiceRecorderOptions = {}): Promise<VoiceRecorderHandle | null> {
    const {
      maxDurationMs = 15000,
      silenceMs = 1300,
      graceMs = 800,
      onStop,
      onError,
      onLevel,
    } = options;

    if (!this.isSupported()) {
      onError?.("此裝置不支援錄音功能，請改用文字輸入。");
      return null;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError?.("無法取得麥克風權限，請確認已允許使用麥克風。");
      return null;
    }

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      onError?.("無法啟動錄音器，請改用文字輸入。");
      return null;
    }

    const chunks: BlobPart[] = [];
    let stopped = false;
    let cancelled = false;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const cleanup = () => {
      stream.getTracks().forEach((t) => t.stop());
      try {
        audioCtx?.close();
      } catch {
        /* ignore */
      }
      clearTimeout(maxTimer);
      cancelAnimationFrame(rafId);
    };

    recorder.onstop = () => {
      cleanup();
      if (cancelled) return;
      const finalMimeType = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunks, { type: finalMimeType });
      if (!blob.size) {
        onError?.("沒有錄到聲音，請再試一次。");
        return;
      }
      onStop?.(blob, finalMimeType);
    };

    recorder.onerror = () => {
      cleanup();
      onError?.("錄音發生錯誤，請再試一次。");
    };

    // --- Silence detection via Web Audio API ---
    let audioCtx: AudioContext | null = null;
    let rafId = 0;
    let silenceStartedAt: number | null = null;
    const startedAt = Date.now();

    try {
      const AudioContextCtor =
        window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioContextCtor();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const SILENCE_RMS_THRESHOLD = 0.02;

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) {
          const normalized = (data[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / data.length);
        onLevel?.(Math.min(1, rms * 4));

        const elapsed = Date.now() - startedAt;
        if (elapsed > graceMs) {
          if (rms < SILENCE_RMS_THRESHOLD) {
            if (silenceStartedAt === null) silenceStartedAt = Date.now();
            else if (Date.now() - silenceStartedAt > silenceMs) {
              doStop();
              return;
            }
          } else {
            silenceStartedAt = null;
          }
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    } catch {
      // Silence detection is a nice-to-have; recording still works via the
      // hard max-duration cap and manual stop button if this fails.
    }

    const doStop = () => {
      if (stopped) return;
      stopped = true;
      if (recorder.state !== "inactive") recorder.stop();
    };

    const maxTimer = setTimeout(doStop, maxDurationMs);

    recorder.start();

    return {
      stop: doStop,
      cancel: () => {
        cancelled = true;
        doStop();
      },
    };
  },
};
