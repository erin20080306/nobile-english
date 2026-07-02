"use client";

// Thin client for our own /api/stt backend route (which proxies to Google
// Cloud Speech-to-Text). The Google API key/credentials never touch the
// browser — only the recorded audio blob is uploaded here.

export interface TranscribeOptions {
  languageCode: string;
  alternativeLanguageCodes?: string[];
}

export interface TranscribeResult {
  ok: boolean;
  text?: string;
  languageCode?: string;
  message?: string;
}

export async function transcribeAudio(blob: Blob, opts: TranscribeOptions): Promise<TranscribeResult> {
  try {
    const form = new FormData();
    form.append("audio", blob, "audio");
    form.append("languageCode", opts.languageCode);
    if (opts.alternativeLanguageCodes?.length) {
      form.append("alternativeLanguageCodes", opts.alternativeLanguageCodes.join(","));
    }
    const res = await fetch("/api/stt", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, message: data?.message || data?.error || "語音辨識失敗，請再試一次。" };
    }
    return { ok: true, text: data.text || "", languageCode: data.languageCode };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "語音辨識服務無法連線。" };
  }
}
