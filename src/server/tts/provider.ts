import type { SynthesisOutput, SynthesisRequest } from "./types";

// A TTS provider synthesizes normalized text into a post-processed audio file
// and returns where it was stored. Post-processing (loudness -16 LUFS, true peak
// -1 dBTP, silence trim, AAC/M4A encode) happens before the file is persisted.
export interface TtsProvider {
  readonly name: string;
  readonly model: string;
  synthesize(req: SynthesisRequest): Promise<SynthesisOutput>;
}

// Offline stub: does NOT call Google Cloud and does NOT incur cost.
// It records a deterministic placeholder path so the whole cache/prewarm flow
// can be exercised end-to-end. Replace with GoogleChirpProvider in production.
export class StubChirpProvider implements TtsProvider {
  readonly name = "google-chirp3hd";
  readonly model = "chirp-3-hd";

  async synthesize(req: SynthesisRequest): Promise<SynthesisOutput> {
    const chars = Array.from(req.text).length;
    // ~14 chars/sec speaking rate, min 600ms — only an estimate for the stub.
    const durationMs = Math.max(600, Math.round((chars / 14) * 1000));
    return {
      audioPath: `stub://tts/${req.voiceName}/${req.textHash}.${req.audioFormat}`,
      durationMs,
      audioFormat: req.audioFormat,
    };
  }
}

const globalForProvider = globalThis as unknown as { __ttsProvider?: TtsProvider };

export function getTtsProvider(): TtsProvider {
  // TODO(prod): if GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON is configured, return a real
  // GoogleChirpProvider that calls Chirp 3 HD, runs the ffmpeg post-processing
  // worker, uploads to the private Supabase Storage bucket, and returns its path.
  if (!globalForProvider.__ttsProvider) {
    globalForProvider.__ttsProvider = new StubChirpProvider();
  }
  return globalForProvider.__ttsProvider;
}

export function isTtsProviderConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON);
}
