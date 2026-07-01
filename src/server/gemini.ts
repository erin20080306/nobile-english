/**
 * Shared Google Gemini (Generative Language API) helper.
 *
 * Used for AI tutor dynamic replies and daily reading article generation,
 * replacing the previous OpenAI dependency. Reads the API key from several
 * common env var names so it works regardless of how the key was named in the
 * deployment dashboard. Gemini keys and TTS keys are intentionally kept
 * separate so a Google TTS key is never treated as permission to call Gemini.
 */

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

/**
 * Call Gemini generateContent and return the raw text output.
 * Throws when the key is missing or the API returns an error.
 */
export async function generateWithGemini(options: GeminiGenerateOptions): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Missing Gemini API key");

  const model = options.model || getGeminiModel();
  const url = `${GENERATIVE_LANGUAGE_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0.6,
    maxOutputTokens: options.maxOutputTokens ?? 1024,
  };
  if (options.json) generationConfig.responseMimeType = "application/json";

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
