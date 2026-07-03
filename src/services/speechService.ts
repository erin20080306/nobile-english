// Browser SpeechSynthesis wrapper. Prefers US English voice.
// Designed so a future cloud TTS (e.g. Google/Azure) can replace the impl.

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentAudio: HTMLAudioElement | null = null;
let currentAudioContext: AudioContext | null = null;
let currentPlaybackEnd: (() => void) | null = null;
const ttsBlobCache = new Map<string, Blob>();
const TTS_CACHE_LIMIT = 24;

export interface SpeakOptions {
  rate?: number;
  lang?: string;
  voiceKeywords?: string[];
  ttsVoice?: string;
  ttsInstructions?: string;
  volumeGain?: number;
  voiceGender?: "male" | "female";
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

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

function pickVoice(voices: SpeechSynthesisVoice[], lang = "en-US", keywords: string[] = [], gender?: "male" | "female") {
  const preferred = lang || "en-US";
  const prefix = preferred.slice(0, 2).toLowerCase();
  const normalizedKeywords = keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean);
  
  // Filter voices by gender if specified
  let candidateVoices = voices;
  if (gender) {
    const genderKeywords = gender === "male" 
      ? ["male", "david", "mark", "daniel", "james", "google us english male", "microsoft david", "microsoft mark"]
      : ["female", "samantha", "ava", "zira", "karen", "google us english female", "microsoft zira", "microsoft aria"];
    
    candidateVoices = voices.filter((v) => 
      genderKeywords.some((keyword) => v.name.toLowerCase().includes(keyword))
    );
    
    // If no gender-specific voices found, use all voices
    if (candidateVoices.length === 0) {
      candidateVoices = voices;
    }
  }
  
  if (normalizedKeywords.length > 0) {
    const kwMatch = candidateVoices.find((v) => normalizedKeywords.some((keyword) => v.name.toLowerCase().includes(keyword)));
    if (kwMatch) return kwMatch;
  }
  const local =
    candidateVoices.find((v) => v.lang === preferred) ||
    candidateVoices.find((v) => v.lang.toLowerCase().startsWith(prefix));
  if (local) return local;
  if (prefix !== "en") return undefined;
  return candidateVoices.find((v) => v.lang.startsWith("en-GB") && preferred === "en-GB") ||
    candidateVoices.find((v) => v.lang === "en-US") ||
    candidateVoices.find((v) => v.lang.startsWith("en"));
}

function isEnglishLang(lang = "en-US") {
  return lang.toLowerCase().startsWith("en");
}

function speechSynthesisText(text: string, lang = "en-US") {
  const clean = text.trim();
  if (!isEnglishLang(lang)) return clean;
  if (/^[A-Za-z']{1,6}$/.test(clean)) return `${clean}.`;
  return clean;
}

function missingCloudVoiceMessage(lang = "en-US") {
  const label = lang.startsWith("ja")
    ? "日文"
    : lang.startsWith("ko")
    ? "韓文"
    : lang.startsWith("it")
    ? "義大利文"
    : lang.startsWith("es")
    ? "西班牙文"
    : "此語言";
  return `${label}語音需要 OpenAI TTS key；目前本機未讀到 key 或瀏覽器沒有${label}語音。`;
}

function stopAudio() {
  currentUtterance = null;
  const endPlayback = currentPlaybackEnd;
  currentPlaybackEnd = null;
  if (!currentAudio) {
    try {
      void currentAudioContext?.close();
    } catch {
      /* ignore */
    }
    currentAudioContext = null;
    endPlayback?.();
    return;
  }
  try {
    currentAudio.pause();
    currentAudio.src = "";
    void currentAudioContext?.close();
  } catch {
    /* ignore */
  }
  currentAudio = null;
  currentAudioContext = null;
  endPlayback?.();
}

function speakNow(text: string, opts?: SpeakOptions, voices = window.speechSynthesis.getVoices()) {
  const lang = opts?.lang ?? "en-US";
  const utter = new SpeechSynthesisUtterance(speechSynthesisText(text, lang));
  utter.lang = lang;
  utter.rate = opts?.rate ?? 0.95;
  utter.pitch = 1;
  utter.volume = 1;
  const voice = pickVoice(voices, lang, opts?.voiceKeywords ?? [], opts?.voiceGender);
  if (voice) utter.voice = voice;
  currentPlaybackEnd = opts?.onEnd ?? null;
  currentUtterance = utter;
  utter.onstart = () => opts?.onStart?.();
  utter.onend = () => {
    if (currentUtterance === utter) currentUtterance = null;
    const endPlayback = currentPlaybackEnd;
    currentPlaybackEnd = null;
    endPlayback?.();
  };
  utter.onerror = () => {
    if (currentUtterance === utter) currentUtterance = null;
    const endPlayback = currentPlaybackEnd;
    currentPlaybackEnd = null;
    endPlayback?.();
  };
  window.speechSynthesis.resume();
  window.speechSynthesis.speak(utter);
  window.setTimeout(() => {
    if (currentUtterance === utter) window.speechSynthesis.resume();
  }, 120);
}

async function speakWithOpenAi(text: string, opts?: SpeakOptions) {
  if (!opts?.ttsVoice || typeof fetch === "undefined" || typeof Audio === "undefined") return false;
  try {
    const cacheKey = ttsCacheKey(text, opts);
    const cachedBlob = ttsBlobCache.get(cacheKey);
    if (cachedBlob) {
      ttsBlobCache.delete(cacheKey);
      ttsBlobCache.set(cacheKey, cachedBlob);
    }
    let blob = cachedBlob;
    if (!blob) {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: text,
          voice: opts.ttsVoice,
          instructions: opts.ttsInstructions,
          speed: opts.rate ?? 1,
        }),
      });
      if (!response.ok) return false;
      blob = await response.blob();
      rememberTtsBlob(cacheKey, blob);
    }
    if (!blob.size) return false;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    currentPlaybackEnd = opts?.onEnd ?? null;
    const cleanup = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      currentAudioContext = null;
      const endPlayback = currentPlaybackEnd;
      currentPlaybackEnd = null;
      endPlayback?.();
    };
    audio.onplay = () => opts?.onStart?.();
    audio.onended = cleanup;
    audio.onerror = cleanup;
    const playedWithBoost = await playWithGain(audio, opts?.volumeGain ?? 1.35, cleanup);
    if (!playedWithBoost) {
      audio.volume = 1;
      await audio.play();
    }
    return true;
  } catch {
    return false;
  }
}

function ttsCacheKey(text: string, opts: SpeakOptions) {
  return JSON.stringify({
    text: text.trim(),
    voice: opts.ttsVoice,
    instructions: opts.ttsInstructions || "",
    speed: opts.rate ?? 1,
  });
}

function rememberTtsBlob(key: string, blob: Blob) {
  if (!blob.size) return;
  if (ttsBlobCache.has(key)) ttsBlobCache.delete(key);
  ttsBlobCache.set(key, blob);
  while (ttsBlobCache.size > TTS_CACHE_LIMIT) {
    const firstKey = ttsBlobCache.keys().next().value as string | undefined;
    if (!firstKey) break;
    ttsBlobCache.delete(firstKey);
  }
}

async function playWithGain(audio: HTMLAudioElement, gainValue: number, cleanup: () => void) {
  if (typeof window === "undefined") return false;
  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return false;

  try {
    const context = new AudioContextCtor();
    const source = context.createMediaElementSource(audio);
    const gain = context.createGain();
    gain.gain.value = Math.max(1, Math.min(2, gainValue));
    source.connect(gain);
    gain.connect(context.destination);
    currentAudioContext = context;
    if (context.state === "suspended") await context.resume();
    audio.onended = () => {
      cleanup();
      void context.close();
    };
    audio.onerror = () => {
      cleanup();
      void context.close();
    };
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

export const speechService = {
  isSupported(): boolean {
    return supported();
  },

  warmUp(opts?: SpeakOptions): void {
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
        primer.lang = opts?.lang ?? "en-US";
        const voice = pickVoice(voices, opts?.lang, opts?.voiceKeywords ?? []);
        if (voice) primer.voice = voice;
        window.speechSynthesis.speak(primer);
      } catch {
        /* ignore */
      }
    });
  },

  // Unlocks speechSynthesis + AudioContext for the rest of this page session.
  // Must be called SYNCHRONOUSLY from within a user gesture handler (onClick/
  // onTouchEnd), e.g. a button the user taps to navigate into a page that
  // will later auto-play TTS via setTimeout. iOS Safari (and some Android
  // browsers) require the *first* speechSynthesis.speak()/AudioContext
  // resume() call on a page to happen inside the direct call stack of a
  // user gesture; after that first successful unlock, subsequent calls
  // (even from setTimeout/async code) are allowed for the rest of the
  // browsing session as long as it's a client-side (SPA) navigation.
  unlockAudio(): void {
    if (typeof window === "undefined") return;
    try {
      if (supported()) {
        const primer = new SpeechSynthesisUtterance(" ");
        primer.volume = 0;
        primer.rate = 1;
        window.speechSynthesis.speak(primer);
      }
    } catch {
      /* ignore */
    }
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextCtor) {
        const ctx = new AudioContextCtor();
        if (ctx.state === "suspended") void ctx.resume();
        // Play a near-silent buffer to fully unlock the audio pipeline.
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      }
    } catch {
      /* ignore */
    }
  },

  speak(text: string, opts?: SpeakOptions): { ok: boolean; message?: string } {
    const canUseCloud = Boolean(opts?.ttsVoice && typeof fetch !== "undefined" && typeof Audio !== "undefined");
    if (!this.isSupported() && !canUseCloud) {
      return { ok: false, message: "您的瀏覽器不支援語音播放，請改用 Chrome 或 Safari。" };
    }
    const clean = text.trim();
    if (!clean) return { ok: true };
    try {
      stopAudio();
      if (supported()) {
        window.speechSynthesis.cancel();
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      }
      if (opts?.ttsVoice) {
        void speakWithOpenAi(clean, opts).then(async (played) => {
          if (played) return;
          if (!supported()) {
            opts.onError?.(missingCloudVoiceMessage(opts.lang));
            opts.onEnd?.();
            return;
          }
          const voices = window.speechSynthesis.getVoices().length
            ? window.speechSynthesis.getVoices()
            : await loadVoices();
          const voice = pickVoice(voices, opts.lang, opts.voiceKeywords ?? [], opts?.voiceGender);
          if (!voice && opts.lang && !isEnglishLang(opts.lang)) {
            opts.onError?.(missingCloudVoiceMessage(opts.lang));
            opts.onEnd?.();
            return;
          }
          speakNow(clean, opts, voices);
        });
        return { ok: true };
      }
      void (async () => {
        const voices = window.speechSynthesis.getVoices().length
          ? window.speechSynthesis.getVoices()
          : await loadVoices();
        const voice = pickVoice(voices, opts?.lang, opts?.voiceKeywords ?? [], opts?.voiceGender);
        if (!voice && opts?.lang && !isEnglishLang(opts.lang)) {
          opts.onError?.(missingCloudVoiceMessage(opts.lang));
          opts.onEnd?.();
          return;
        }
        speakNow(clean, opts, voices);
      })();
      return { ok: true };
    } catch {
      return { ok: false, message: "語音播放發生問題，請稍後再試。" };
    }
  },

  stop() {
    currentUtterance = null;
    stopAudio();
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
    lang?: string;
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
    // Note: the Web Speech API has no real "auto-detect language" mode.
    // Setting rec.lang to a literal "auto" is an invalid BCP-47 tag and
    // causes recognition to fail immediately on most engines. When callers
    // request "auto", fall back to a sensible default instead.
    const requestedLang = handlers.lang && handlers.lang !== "auto" ? handlers.lang : "en-US";
    rec.lang = requestedLang;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = true;

    let finalTranscript = "";
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const piece = e.results[i][0]?.transcript || "";
        if (e.results[i].isFinal) {
          finalTranscript += `${piece} `;
        } else {
          interimTranscript += piece;
        }
      }
      const transcript = `${finalTranscript} ${interimTranscript}`.trim();
      if (transcript) handlers.onResult(transcript);
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      const map: Record<string, string> = {
        "not-allowed": "麥克風權限被拒，請在瀏覽器允許麥克風。",
        "no-speech": "沒有偵測到語音，請再試一次。",
        "audio-capture": "找不到麥克風裝置。",
        "language-not-supported": `此瀏覽器不支援 ${handlers.lang || "目前語言"} 語音辨識，請改用 Chrome 或先用打字回覆。`,
        "network": "語音辨識需要網路服務，目前連線不穩，請再試一次。",
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
