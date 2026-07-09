import crypto from "crypto";
import { getGeminiApiKey } from "../gemini";
import { getAppSetting } from "../settings";
import { incrementApiUsage } from "../apiUsage";
import type { AudioFormat, SynthesisOutput, SynthesisRequest, TtsAssetType } from "./types";

type TtsQuality = "standard" | "neural";
type ProviderKind = "gemini" | "google" | "polly" | "stub";

export interface TtsProvider {
  readonly name: string;
  readonly model: string;
  readonly audioFormat: AudioFormat;
  synthesize(req: SynthesisRequest): Promise<SynthesisOutput>;
}

const STANDARD_ASSET_TYPES = new Set<TtsAssetType>([
  "practice_sentence",
  "reading_sentence",
  "word_pronunciation",
]);

const GOOGLE_STANDARD_VOICES: Record<string, string> = {
  "vp-en-jake": "en-US-Wavenet-D",
  "vp-en-william": "en-GB-Wavenet-B",
  "vp-en-emma": "en-US-Wavenet-F",
  "vp-en-amy": "en-US-Wavenet-E",
  "vp-en-sophie": "en-GB-Wavenet-A",
  "vp-en-lily": "cmn-CN-Wavenet-A",
  "vp-ja-haruto": "ja-JP-Wavenet-C",
  "vp-ja-yui": "ja-JP-Wavenet-B",
  "vp-ko-minjun": "ko-KR-Wavenet-C",
  "vp-ko-seoyeon": "ko-KR-Wavenet-A",
  "vp-it-marco": "it-IT-Wavenet-C",
  "vp-it-giulia": "it-IT-Wavenet-A",
  "vp-es-carlos": "es-ES-Wavenet-B",
  "vp-es-sofia": "es-ES-Wavenet-C",
};

const POLLY_STANDARD_VOICES: Record<string, string> = {
  "vp-en-jake": "Matthew",
  "vp-en-william": "Brian",
  "vp-en-emma": "Joanna",
  "vp-en-amy": "Joanna",
  "vp-en-sophie": "Amy",
  "vp-en-lily": "Zhiyu",
  "vp-ja-haruto": "Takumi",
  "vp-ja-yui": "Mizuki",
  "vp-ko-minjun": "Seung",
  "vp-ko-seoyeon": "Seoyeon",
  "vp-it-marco": "Giorgio",
  "vp-it-giulia": "Bianca",
  "vp-es-carlos": "Enrique",
  "vp-es-sofia": "Lucia",
};

const POLLY_NEURAL_VOICES: Record<string, string> = {
  "vp-en-jake": "Matthew",
  "vp-en-william": "Brian",
  "vp-en-emma": "Joanna",
  "vp-en-amy": "Danielle",
  "vp-en-sophie": "Amy",
  "vp-en-lily": "Zhiyu",
  "vp-ja-haruto": "Takumi",
  "vp-ja-yui": "Kazuha",
  "vp-ko-minjun": "Seung",
  "vp-ko-seoyeon": "Seoyeon",
  "vp-it-marco": "Giorgio",
  "vp-it-giulia": "Bianca",
  "vp-es-carlos": "Sergio",
  "vp-es-sofia": "Lucia",
};

const GEMINI_TTS_VOICES: Record<string, string> = {
  "vp-en-jake": "Puck",
  "vp-en-william": "Charon",
  "vp-en-emma": "Kore",
  "vp-en-amy": "Leda",
  "vp-en-sophie": "Aoede",
  "vp-en-lily": "Autonoe",
  "vp-ja-haruto": "Fenrir",
  "vp-ja-yui": "Callirrhoe",
  "vp-ko-minjun": "Orus",
  "vp-ko-seoyeon": "Despina",
  "vp-it-marco": "Algieba",
  "vp-it-giulia": "Erinome",
  "vp-es-carlos": "Enceladus",
  "vp-es-sofia": "Laomedeia",
};

const GEMINI_TUTOR_STYLES: Record<string, string> = {
  "vp-en-jake": "friendly American male English tutor from California",
  "vp-en-william": "polished British male English tutor",
  "vp-en-emma": "bright American female English tutor from New York",
  "vp-en-amy": "gentle American female English tutor for beginners",
  "vp-en-sophie": "soft British female pronunciation coach",
  "vp-en-lily": "warm Asian female English tutor with Mandarin-influenced English rhythm",
  "vp-ja-haruto": "native Japanese male tutor from Tokyo",
  "vp-ja-yui": "native Japanese female tutor from Tokyo",
  "vp-ko-minjun": "native Korean male tutor from Seoul",
  "vp-ko-seoyeon": "native Korean female tutor from Seoul",
  "vp-it-marco": "native Italian male tutor from Rome",
  "vp-it-giulia": "native Italian female tutor from Milan",
  "vp-es-carlos": "native Spanish male tutor from Madrid",
  "vp-es-sofia": "native Spanish female tutor from Barcelona",
};

function qualityForAsset(assetType?: TtsAssetType): TtsQuality {
  return assetType && STANDARD_ASSET_TYPES.has(assetType) ? "standard" : "neural";
}

function normalizeEnvKey(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

export const TTS_PROVIDER_SETTING_KEY = "tts_primary_provider";

async function providerPreference(): Promise<ProviderKind> {
  const override = (await getAppSetting(TTS_PROVIDER_SETTING_KEY))?.toLowerCase();
  if (override === "gemini" && hasGeminiTtsConfig()) return "gemini";
  if (override === "google" && hasGoogleConfig()) return "google";
  if (override === "polly" && hasPollyConfig()) return "polly";

  const preferred = (process.env.TTS_PROVIDER || process.env.TTS_PRIMARY_PROVIDER || "").toLowerCase();
  if (preferred === "gemini" && hasGeminiTtsConfig()) return "gemini";
  if (preferred === "google" && hasGoogleConfig()) return "google";
  if (preferred === "polly" && hasPollyConfig()) return "polly";
  if (hasGeminiTtsConfig()) return "gemini";
  if (hasGoogleConfig()) return "google";
  if (hasPollyConfig()) return "polly";
  return "stub";
}

function hasGeminiTtsConfig() {
  return Boolean(getGeminiApiKey());
}

function hasGoogleConfig() {
  return Boolean(process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON);
}

function hasPollyConfig() {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

function voiceOverride(provider: "gemini" | "google" | "polly", voiceProfileId: string, quality: TtsQuality) {
  const key = `${provider.toUpperCase()}_TTS_VOICE_${normalizeEnvKey(voiceProfileId)}_${quality.toUpperCase()}`;
  return process.env[key];
}

function estimateDurationMs(text: string) {
  const chars = Array.from(text).length;
  return Math.max(600, Math.round((chars / 14) * 1000));
}

function audioFormatForProvider(format: AudioFormat) {
  return format === "mp3" ? "mp3" : "mp3";
}

class StubTtsProvider implements TtsProvider {
  readonly name = "stub-tts";
  readonly audioFormat: AudioFormat = "mp3";

  constructor(readonly model: string) {}

  async synthesize(req: SynthesisRequest): Promise<SynthesisOutput> {
    return {
      audioPath: `stub://tts/${req.voiceProfileId}/${req.textHash}.${req.audioFormat}`,
      durationMs: estimateDurationMs(req.text),
      audioFormat: req.audioFormat,
    };
  }
}

function geminiTtsModel(quality: TtsQuality) {
  return (
    (quality === "standard" ? process.env.GEMINI_TTS_STANDARD_MODEL : process.env.GEMINI_TTS_NEURAL_MODEL) ||
    process.env.GEMINI_TTS_MODEL ||
    "gemini-3.1-flash-tts-preview"
  );
}

function languageLabel(languageCode: string) {
  const lower = languageCode.toLowerCase();
  if (lower.startsWith("ja")) return "Japanese";
  if (lower.startsWith("ko")) return "Korean";
  if (lower.startsWith("it")) return "Italian";
  if (lower.startsWith("es")) return "Spanish";
  if (lower.startsWith("en-gb")) return "British English";
  if (lower.startsWith("cmn") || lower.startsWith("zh")) return "Mandarin-accented English";
  return "American English";
}

function buildGeminiTtsPrompt(req: SynthesisRequest) {
  const style = GEMINI_TUTOR_STYLES[req.voiceProfileId] || `${req.voiceGender} ${languageLabel(req.languageCode)} tutor`;
  return [
    `Say only the following ${languageLabel(req.languageCode)} text.`,
    `Use the voice of a ${style}.`,
    "Keep the pacing natural, clear, teacher-like, and easy for a learner to understand.",
    "Do not add explanations, labels, translations, sound effects, or extra words.",
    req.text,
  ].join("\n");
}

function parseSampleRate(mimeType?: string) {
  const match = mimeType?.match(/rate=(\d+)/i);
  return match ? Number(match[1]) || 24000 : 24000;
}

function wrapPcmAsWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function durationFromPcmMs(bytes: number, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const bytesPerSecond = (sampleRate * channels * bitsPerSample) / 8;
  return bytesPerSecond > 0 ? Math.max(300, Math.round((bytes / bytesPerSecond) * 1000)) : null;
}

interface GeminiTtsResponse {
  output_audio?: {
    data?: string;
    mime_type?: string;
    mimeType?: string;
  };
  outputAudio?: {
    data?: string;
    mime_type?: string;
    mimeType?: string;
  };
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
      }>;
    };
  }>;
  error?: { message?: string; status?: string };
}

type GeminiAudioPayload = {
  data?: string;
  mime_type?: string;
  mimeType?: string;
};

class GeminiTtsProvider implements TtsProvider {
  readonly name = "gemini-tts";
  readonly model: string;
  readonly audioFormat: AudioFormat = "wav";

  constructor(private readonly quality: TtsQuality) {
    this.model = geminiTtsModel(quality);
  }

  private resolveVoice(req: SynthesisRequest) {
    return (
      voiceOverride("gemini", req.voiceProfileId, this.quality) ||
      GEMINI_TTS_VOICES[req.voiceProfileId] ||
      (req.voiceGender === "male" ? "Puck" : "Kore")
    );
  }

  async synthesize(req: SynthesisRequest): Promise<SynthesisOutput> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

    const url = "https://generativelanguage.googleapis.com/v1beta/interactions";
    const voiceName = this.resolveVoice(req);

    void incrementApiUsage(`tts:gemini-${this.model}`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: this.model,
        input: buildGeminiTtsPrompt(req),
        response_format: { type: "audio" },
        generation_config: {
          speech_config: [{ voice: voiceName }],
        },
      }),
    });

    const data = (await response.json().catch(() => ({}))) as GeminiTtsResponse;
    if (!response.ok) {
      throw new Error(`Gemini TTS failed (${response.status}): ${data.error?.message || data.error?.status || "unknown error"}`);
    }

    const parts = data.candidates?.flatMap((candidate) => candidate.content?.parts || []) || [];
    const inline: GeminiAudioPayload | undefined =
      data.output_audio ||
      data.outputAudio ||
      parts.find((part) => part.inlineData?.data)?.inlineData;
    if (!inline?.data) throw new Error("Gemini TTS returned no inline audio");

    const raw = Buffer.from(inline.data, "base64");
    if (!raw.byteLength) throw new Error("Gemini TTS returned empty audio");

    const mimeType = inline.mime_type || inline.mimeType;
    const sampleRate = parseSampleRate(mimeType);
    const wavBytes = mimeType?.includes("audio/wav") ? raw : wrapPcmAsWav(raw, sampleRate);
    const durationMs = durationFromPcmMs(raw.length, sampleRate) || estimateDurationMs(req.text);

    return {
      audioPath: "",
      audioBytes: wavBytes,
      durationMs,
      audioFormat: "wav",
    };
  }
}

let googleTokenCache: { token: string; expiresAt: number } | null = null;

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getGoogleAccessToken() {
  if (process.env.GOOGLE_TTS_API_KEY) return null;
  if (googleTokenCache && googleTokenCache.expiresAt > Date.now() + 60000) {
    return googleTokenCache.token;
  }

  const raw = process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing GOOGLE_TTS_API_KEY or GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON");

  const account = JSON.parse(raw) as {
    client_email?: string;
    private_key?: string;
    token_uri?: string;
  };
  if (!account.client_email || !account.private_key) {
    throw new Error("Invalid GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: account.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  const privateKey = account.private_key.replace(/\\n/g, "\n");
  const signature = base64Url(signer.sign(privateKey));
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch(payload.aud, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !data.access_token) {
    throw new Error(`Google TTS auth failed (${response.status}): ${data.error_description || "missing access token"}`);
  }

  googleTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(300, data.expires_in || 3600) * 1000,
  };
  return googleTokenCache.token;
}

class GoogleTtsProvider implements TtsProvider {
  readonly name = "google-tts";
  readonly model: string;
  readonly audioFormat: AudioFormat = "mp3";

  constructor(private readonly quality: TtsQuality) {
    this.model = quality === "standard" ? "wavenet" : "neural2";
  }

  private resolveVoice(req: SynthesisRequest) {
    return (
      voiceOverride("google", req.voiceProfileId, this.quality) ||
      (this.quality === "standard" ? GOOGLE_STANDARD_VOICES[req.voiceProfileId] : req.voiceName) ||
      req.voiceName
    );
  }

  async synthesize(req: SynthesisRequest): Promise<SynthesisOutput> {
    const apiKey = process.env.GOOGLE_TTS_API_KEY;
    const accessToken = await getGoogleAccessToken();
    const voiceName = this.resolveVoice(req);
    const outputFormat: AudioFormat = "mp3";
    const url = apiKey
      ? `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey)}`
      : "https://texttospeech.googleapis.com/v1/text:synthesize";

    void incrementApiUsage(`tts:google-${this.quality}`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        input: { text: req.text },
        voice: {
          languageCode: req.languageCode,
          name: voiceName,
        },
        audioConfig: {
          audioEncoding: "MP3",
          // Google TTS defaults to 0dB gain, which sounds noticeably quiet for a
          // tutor voice. Boost it so the AI tutor is loud and clear by default.
          volumeGainDb: 9,
        },
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      audioContent?: string;
      error?: { message?: string };
    };
    if (!response.ok || !data.audioContent) {
      throw new Error(`Google TTS failed (${response.status}): ${data.error?.message || "missing audioContent"}`);
    }

    const bytes = Buffer.from(data.audioContent, "base64");
    if (!bytes.byteLength) throw new Error("Google TTS returned empty audio");

    // Return raw bytes; the service returns them inline and uploads to Supabase
    // in the background so playback is not blocked by the storage round-trip.
    return {
      audioPath: "",
      audioBytes: bytes,
      durationMs: estimateDurationMs(req.text),
      audioFormat: outputFormat,
    };
  }
}

function hmac(key: Buffer | string, value: string) {
  return crypto.createHmac("sha256", key).update(value).digest();
}

function sha256Hex(value: string | Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function awsDate(date = new Date()) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function pollyLanguageCode(languageCode: string) {
  return languageCode;
}

class PollyTtsProvider implements TtsProvider {
  readonly name = "amazon-polly";
  readonly model: string;
  readonly audioFormat: AudioFormat = "mp3";

  constructor(private readonly quality: TtsQuality) {
    this.model = quality;
  }

  private resolveVoice(req: SynthesisRequest) {
    return (
      voiceOverride("polly", req.voiceProfileId, this.quality) ||
      (this.quality === "standard" ? POLLY_STANDARD_VOICES[req.voiceProfileId] : POLLY_NEURAL_VOICES[req.voiceProfileId]) ||
      POLLY_STANDARD_VOICES[req.voiceProfileId] ||
      "Joanna"
    );
  }

  async synthesize(req: SynthesisRequest): Promise<SynthesisOutput> {
    const outputFormat: AudioFormat = "mp3";
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const sessionToken = process.env.AWS_SESSION_TOKEN;
    if (!accessKeyId || !secretAccessKey) {
      throw new Error("Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY");
    }

    const host = `polly.${region}.amazonaws.com`;
    const endpoint = `https://${host}/v1/speech`;
    const body = JSON.stringify({
      Text: req.text,
      TextType: "text",
      OutputFormat: audioFormatForProvider(outputFormat),
      VoiceId: this.resolveVoice(req),
      Engine: this.quality,
      LanguageCode: pollyLanguageCode(req.languageCode),
    });
    const { amzDate, dateStamp } = awsDate();
    const payloadHash = sha256Hex(body);
    const canonicalHeaders = [
      "content-type:application/json",
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
      ...(sessionToken ? [`x-amz-security-token:${sessionToken}`] : []),
    ].join("\n") + "\n";
    const signedHeaders = [
      "content-type",
      "host",
      "x-amz-content-sha256",
      "x-amz-date",
      ...(sessionToken ? ["x-amz-security-token"] : []),
    ].join(";");
    const canonicalRequest = ["POST", "/v1/speech", "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const credentialScope = `${dateStamp}/${region}/polly/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), "polly"), "aws4_request");
    const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    const authorization =
      `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    void incrementApiUsage(`tts:polly-${this.quality}`);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Amz-Content-Sha256": payloadHash,
        "X-Amz-Date": amzDate,
        ...(sessionToken ? { "X-Amz-Security-Token": sessionToken } : {}),
        Authorization: authorization,
      },
      body,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(`Amazon Polly failed (${response.status}): ${message.slice(0, 500)}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.byteLength) throw new Error("Amazon Polly returned empty audio");

    // Return raw bytes; the service uploads to Supabase in the background.
    return {
      audioPath: "",
      audioBytes: bytes,
      durationMs: estimateDurationMs(req.text),
      audioFormat: outputFormat,
    };
  }
}

const globalForProvider = globalThis as unknown as {
  __ttsProviders?: Map<string, TtsProvider>;
};

export async function getTtsProvider(assetType?: TtsAssetType): Promise<TtsProvider> {
  const quality = qualityForAsset(assetType);
  const kind = await providerPreference();
  const key = `${kind}:${quality}`;
  if (!globalForProvider.__ttsProviders) globalForProvider.__ttsProviders = new Map();
  const cached = globalForProvider.__ttsProviders.get(key);
  if (cached) return cached;

  const provider =
    kind === "gemini"
      ? new GeminiTtsProvider(quality)
      : kind === "google"
      ? new GoogleTtsProvider(quality)
      : kind === "polly"
      ? new PollyTtsProvider(quality)
      : new StubTtsProvider(quality);
  globalForProvider.__ttsProviders.set(key, provider);
  return provider;
}

export function isTtsProviderConfigured(): boolean {
  return hasGeminiTtsConfig() || hasGoogleConfig() || hasPollyConfig();
}

export interface TtsProviderStatus {
  active: ProviderKind;
  override: ProviderKind | null;
  geminiConfigured: boolean;
  googleConfigured: boolean;
  pollyConfigured: boolean;
}

export async function getTtsProviderStatus(): Promise<TtsProviderStatus> {
  const override = (await getAppSetting(TTS_PROVIDER_SETTING_KEY))?.toLowerCase();
  const validOverride = override === "gemini" || override === "google" || override === "polly" ? override : null;
  return {
    active: await providerPreference(),
    override: validOverride,
    geminiConfigured: hasGeminiTtsConfig(),
    googleConfigured: hasGoogleConfig(),
    pollyConfigured: hasPollyConfig(),
  };
}
