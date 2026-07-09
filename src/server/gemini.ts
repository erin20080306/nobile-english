/**
 * Shared Google Gemini (Generative Language API) helper.
 *
 * Used for AI tutor dynamic replies and daily reading article generation.
 * Reads the API key from several
 * common env var names so it works regardless of how the key was named in the
 * deployment dashboard. Gemini keys and TTS keys are intentionally kept
 * separate so a Google TTS key is never treated as permission to call Gemini.
 */

import { getAppSetting } from "./settings";
import { incrementApiUsage } from "./apiUsage";

const GENERATIVE_LANGUAGE_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

export function getGeminiApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    null
  );
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
}

// Cheaper model used automatically when the primary model hits a quota /
// rate-limit error, and also selectable manually from the admin panel.
export function getGeminiFallbackModel(): string {
  return process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";
}

// Models an admin can pick from in the admin panel's model switcher. Kept as
// a hand-maintained list of models known to be available for this project.
export const SUPPORTED_GEMINI_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
] as const;

export const GEMINI_MODEL_SETTING_KEY = "gemini_active_model";

// Admin-selected active model override, stored via app_settings (same
// pattern as the TTS provider override) so it can be changed from the admin
// panel without a redeploy. Falls back to the GEMINI_MODEL env var when no
// override has been set.
export async function resolveActiveGeminiModel(): Promise<string> {
  const override = await getAppSetting(GEMINI_MODEL_SETTING_KEY);
  return override || getGeminiModel();
}

export function hasGeminiConfig(): boolean {
  return Boolean(getGeminiApiKey());
}

interface GeminiGenerateOptions {
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  // When true, ask Gemini to return application/json so parsing is reliable.
  json?: boolean;
  model?: string;
  signal?: AbortSignal;
}

interface GeminiCandidatePart {
  text?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiCandidatePart[] };
    finishReason?: string;
  }>;
  error?: { message?: string; status?: string };
  promptFeedback?: { blockReason?: string };
}

function isQuotaOrRateLimitError(status: number, data: GeminiResponse): boolean {
  if (status === 429) return true;
  const errorStatus = (data.error?.status || "").toUpperCase();
  return errorStatus === "RESOURCE_EXHAUSTED" || errorStatus === "UNAVAILABLE";
}

async function callGeminiOnce(
  apiKey: string,
  model: string,
  options: GeminiGenerateOptions
): Promise<{ response: Response; data: GeminiResponse }> {
  const url = `${GENERATIVE_LANGUAGE_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0.6,
    maxOutputTokens: options.maxOutputTokens ?? 1024,
  };
  if (options.json) generationConfig.responseMimeType = "application/json";

  void incrementApiUsage(`gemini:${model}`);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: options.prompt }] }],
      generationConfig,
    }),
    signal: options.signal,
  });

  const data = (await response.json().catch(() => ({}))) as GeminiResponse;
  return { response, data };
}

/**
 * Call Gemini generateContent and return the raw text output.
 * Throws when the key is missing or the API returns an error.
 *
 * When the primary model (admin override, or GEMINI_MODEL env var) hits a
 * quota / rate-limit error, this automatically retries once with the
 * cheaper fallback model (see getGeminiFallbackModel) so a single busy day
 * doesn't take the whole feature down. Every call increments a per-model
 * usage counter (api_usage_counters) so the admin panel can show call
 * volume before quota problems happen.
 */
export async function generateWithGemini(options: GeminiGenerateOptions): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Missing Gemini API key");

  const primaryModel = options.model || (await resolveActiveGeminiModel());
  const fallbackModel = getGeminiFallbackModel();

  let { response, data } = await callGeminiOnce(apiKey, primaryModel, options);

  if (!response.ok && isQuotaOrRateLimitError(response.status, data) && primaryModel !== fallbackModel) {
    console.warn(
      `[Gemini] ${primaryModel} hit quota/rate limit (${response.status}); retrying with fallback model ${fallbackModel}`
    );
    ({ response, data } = await callGeminiOnce(apiKey, fallbackModel, options));
  }

  if (!response.ok) {
    throw new Error(
      `Gemini failed (${response.status}): ${data.error?.message || data.error?.status || "unknown error"}`
    );
  }
  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the prompt: ${data.promptFeedback.blockReason}`);
  }

  const text =
    data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  if (!text.trim()) throw new Error("Gemini returned empty output");
  return text;
}

/**
 * Extract a JSON object from arbitrary model output (handles ```json fences and
 * leading/trailing prose).
 */
export function parseJsonFromModel<T = unknown>(text: string): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced || trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1)) as T;
  return JSON.parse(raw) as T;
}

/**
 * Convenience: call Gemini expecting JSON output and parse it.
 */
export async function generateJsonWithGemini<T = unknown>(
  options: GeminiGenerateOptions
): Promise<T> {
  const text = await generateWithGemini({ ...options, json: true });
  return parseJsonFromModel<T>(text);
}
