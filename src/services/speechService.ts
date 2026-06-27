// Browser SpeechSynthesis wrapper. Prefers US English voice.
// Designed so a future cloud TTS (e.g. Google/Azure) can replace the impl.

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

function supported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!supported()) return Promise.resolve([]);
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) return Promise.resolve(voices);
  if (voicesReady) return voicesReady;

  voicesReady = new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.onvoiceschanged = finish;
    window.setTimeout(finish, 450);
  });
  return voicesReady;
}

function pickVoice(voices: SpeechSynthesisVoice[]) {
  return (
    voices.find((v) => v.lang === "en-US" && /female|samantha|google|natural/i.test(v.name)) ||
    voices.find((v) => v.lang === "en-US") ||
    voices.find((v) => v.lang.startsWith("en"))
  );
}

function speakNow(text: string, opts?: { rate?: number }) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.rate = opts?.rate ?? 0.95;
  utter.pitch = 1;
  utter.volume = 1;
  const voice = pickVoice(window.speechSynthesis.getVoices());
  if (voice) utter.voice = voice;
  window.speechSynthesis.resume();
  window.speechSynthesis.speak(utter);
}

export const speechService = {
  isSupported(): boolean {
    return supported();
  },

  warmUp(): void {
    if (!this.isSupported()) return;
    void loadVoices().then((voices) => {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
        // Speak a silent utterance to prime the audio engine and avoid
        // the static/noise burst that occurs on the very first real speak.
        const primer = new SpeechSynthesisUtterance(" ");
        primer.volume = 0;
        primer.rate = 1;
        primer.lang = "en-US";
        const voice = pickVoice(voices);
        if (voice) primer.voice = voice;
        window.speechSynthesis.speak(primer);
      } catch {
        /* ignore */
      }
    });
  },

  speak(text: string, opts?: { rate?: number }): { ok: boolean; message?: string } {
    if (!this.isSupported()) {
      return { ok: false, message: "您的瀏覽器不支援語音播放，請改用 Chrome 或 Safari。" };
    }
    const clean = text.trim();
    if (!clean) return { ok: true };
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      if (window.speechSynthesis.getVoices().length === 0) void loadVoices();
      speakNow(clean, opts);
      return { ok: true };
    } catch {
      return { ok: false, message: "語音播放發生問題，請稍後再試。" };
    }
  },

  stop() {
    if (this.isSupported()) window.speechSynthesis.cancel();
  },

  // ---- Speech recognition (voice input) ----
  isRecognitionSupported(): boolean {
    if (typeof window === "undefined") return false;
    const w = window as unknown as Record<string, unknown>;
    return "SpeechRecognition" in w || "webkitSpeechRecognition" in w;
  },

  // Starts listening for English speech. Returns a stop() function, or null if
  // unsupported. onResult fires with the recognized transcript.
  listen(handlers: {
    onResult: (text: string) => void;
    onError?: (message: string) => void;
    onEnd?: () => void;
  }): (() => void) | null {
    if (!this.isRecognitionSupported()) {
      handlers.onError?.("您的瀏覽器不支援語音輸入，請改用 Chrome 或 Safari，或用打字回覆。");
      return null;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognition;
      webkitSpeechRecognition?: new () => SpeechRecognition;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      handlers.onError?.("無法啟動語音輸入。");
      return null;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0]?.transcript || "";
        transcript += " ";
      }
      transcript = transcript.trim();
      if (transcript) handlers.onResult(transcript);
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      const map: Record<string, string> = {
        "not-allowed": "麥克風權限被拒，請在瀏覽器允許麥克風。",
        "no-speech": "沒有偵測到語音，請再試一次。",
        "audio-capture": "找不到麥克風裝置。",
      };
      handlers.onError?.(map[e.error] || "語音辨識發生問題，請再試一次。");
    };
    rec.onend = () => handlers.onEnd?.();

    try {
      rec.start();
    } catch {
      handlers.onError?.("語音輸入啟動失敗，請再試一次。");
      return null;
    }
    return () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    };
  },
};
