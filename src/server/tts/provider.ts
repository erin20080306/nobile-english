import crypto from "crypto";
import { getAppSetting } from "../settings";
import { incrementApiUsage } from "../apiUsage";
import type { AudioFormat, SynthesisOutput, SynthesisRequest, TtsAssetType } from "./types";

type TtsQuality = "standard" | "neural";
type ProviderKind = "google" | "polly" | "stub";

export interface TtsProvider {
  readonly name: string;
  readonly model: string;
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

function qualityForAsset(assetType?: TtsAssetType): TtsQuality {
  return assetType && STANDARD_ASSET_TYPES.has(assetType) ? "standard" : "neural";
}

function normalizeEnvKey(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

export const TTS_PROVIDER_SETTING_KEY = "tts_primary_provider";

async function providerPreference(): Promise<ProviderKind> {
  const override = (await getAppSetting(TTS_PROVIDER_SETTING_KEY))?.toLowerCase();
  if (override === "google" && hasGoogleConfig()) return "google";
  if (override === "polly" && hasPollyConfig()) return "polly";

  const preferred = (process.env.TTS_PROVIDER || process.env.TTS_PRIMARY_PROVIDER || "").toLowerCase();
  if (preferred === "google" && hasGoogleConfig()) return "google";
  if (preferred === "polly" && hasPollyConfig()) return "polly";
  if (hasGoogleConfig()) return "google";
  if (hasPollyConfig()) return "polly";
  return "stub";
}

function hasGoogleConfig() {
  return Boolean(process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON);
}

function hasPollyConfig() {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

function voiceOverride(provider: "google" | "polly", voiceProfileId: string, quality: TtsQuality) {
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

  constructor(readonly model: string) {}

  async synthesize(req: SynthesisRequest): Promise<SynthesisOutput> {
    return {
      audioPath: `stub://tts/${req.voiceProfileId}/${req.textHash}.${req.audioFormat}`,
      durationMs: estimateDurationMs(req.text),
      audioFormat: req.audioFormat,
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

    void incrementApiUsage(`tts:google-${this.quality}`);

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

    void incrementApiUsage(`tts:polly-${this.quality}`);

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
    kind === "google"
      ? new GoogleTtsProvider(quality)
      : kind === "polly"
      ? new PollyTtsProvider(quality)
      : new StubTtsProvider(quality);
  globalForProvider.__ttsProviders.set(key, provider);
  return provider;
}

export function isTtsProviderConfigured(): boolean {
  return hasGoogleConfig() || hasPollyConfig();
}

export interface TtsProviderStatus {
  active: ProviderKind;
  override: ProviderKind | null;
  googleConfigured: boolean;
  pollyConfigured: boolean;
}

export async function getTtsProviderStatus(): Promise<TtsProviderStatus> {
  const override = (await getAppSetting(TTS_PROVIDER_SETTING_KEY))?.toLowerCase();
  const validOverride = override === "google" || override === "polly" ? override : null;
  return {
    active: await providerPreference(),
    override: validOverride,
    googleConfigured: hasGoogleConfig(),
    pollyConfigured: hasPollyConfig(),
  };
}
