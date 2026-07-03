/**
 * AI 導師語音自動播放服務。
 *
 * 正式語音先走 /api/tts/get-or-create 與全站快取；當目前環境仍為
 * Chirp stub 或正式音檔暫時不可用時，改以「目前選擇的導師」設定取得
 * fallback MP3，並放回同一個已解鎖的 Audio Queue。不可直接讓第二套
 * unmanaged Audio / speechSynthesis 接管，否則 iOS 常只會播放第一句。
 */

import { audioQueueService } from "./audioQueueService";
import { speechService } from "./speechService";
import { voiceForLanguage } from "@/data/learningLanguages";
import { getTutorById } from "@/data/tutors";
import { getTutorVoiceProfileId } from "@/data/tutorVoiceProfiles";
import type { LearningLanguageCode, TutorFeedback } from "@/types";

// AI 導師對話語音的音量增益，高於一般朗讀內容（audioQueueService 的
// 預設 PLAYBACK_GAIN），讓對話練習中導師的聲音更明顯、更容易聽清楚。
const TUTOR_VOICE_GAIN = 3.2;

type TutorAudioAssetType =
  | "practice_sentence"
  | "tutor_reply"
  | "tutor_pass"
  | "tutor_minor_correction"
  | "tutor_retry"
  | "tutor_hint"
  | "tutor_complete"
  | "word_pronunciation"
  | "dynamic_tutor_reply"
  | "reading_sentence";

interface TutorVoiceOptions {
  languageCode: string;
  voiceGender?: string;
  /** Existing caller passes the selected UI tutor id, e.g. emma / jake / yui. */
  voiceProfileId?: string;
  audioFormat?: string;
  audioVersionString?: string;
  sceneId?: string;
  sceneVersion?: string;
  assetType?: TutorAudioAssetType;
  cacheOnly?: boolean;
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
}

function toLearningLanguage(languageCode: string): LearningLanguageCode {
  const lower = languageCode.toLowerCase();
  if (lower === "ja" || lower.startsWith("ja-")) return "ja";
  if (lower === "ko" || lower.startsWith("ko-")) return "ko";
  if (lower === "it" || lower.startsWith("it-")) return "it";
  if (lower === "es" || lower.startsWith("es-")) return "es";
  return "en";
}

function isTutorRoleAsset(assetType: TutorAudioAssetType) {
  return assetType === "dynamic_tutor_reply" || assetType.startsWith("tutor_");
}

class TutorVoiceService {
  private isPlaying = false;

  private resolveTtsText(feedback: TutorFeedback): string {
    return String(feedback.ttsCandidate || feedback.reply || "").trim();
  }

  private resolveTutor(options: TutorVoiceOptions) {
    const language = toLearningLanguage(options.languageCode);
    const tutorId = options.voiceProfileId || "";
    const resolved = getTutorById(tutorId, language);
    const isSelectedTutor = Boolean(tutorId && resolved.id === tutorId);
    return {
      tutor: isSelectedTutor ? resolved : null,
      chirpVoiceProfileId: isSelectedTutor ? getTutorVoiceProfileId(tutorId) : undefined,
    };
  }

  async playTutorReply(feedback: TutorFeedback, options: TutorVoiceOptions): Promise<void> {
    const ttsText = this.resolveTtsText(feedback);
    this.log("[AI_TTS] tutor feedback received", {
      hasReply: Boolean(feedback.reply?.trim()),
      hasTtsCandidate: Boolean(feedback.ttsCandidate?.trim()),
      hasResolvedText: Boolean(ttsText),
      languageCode: options.languageCode,
      tutorId: options.voiceProfileId,
      requestedGender: options.voiceGender,
    });

    if (!ttsText) {
      this.log("[AI_TTS] playback skipped", { reason: "empty_tutor_reply" });
      return;
    }

    try {
      await audioQueueService.unlockAudio();
    } catch (error) {
      this.log("[AI_TTS] audio unlock failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const state = audioQueueService.getState();
    if (!state.autoPlayTutorVoice) {
      this.log("[AI_TTS] playback skipped", { reason: "autoplay_disabled" });
      return;
    }

    // Voice-recognition callbacks can arrive slightly before the browser fully
    // releases the audio session. Release it and wait briefly instead of skipping.
    if (state.recording) {
      this.log("[AI_TTS] releasing recording before tutor playback");
      this.setRecording(false);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
    }

    audioQueueService.clearQueue();
    this.stop();

    const assetType = options.assetType || "dynamic_tutor_reply";
    const cacheOnly = options.cacheOnly ?? false;
    const canUsePaidFallback = !cacheOnly;

    const { chirpVoiceProfileId } = this.resolveTutor(options);
    let audioUrl = await this.getTtsAudioUrl(ttsText, {
      ...options,
      voiceProfileId: chirpVoiceProfileId || options.voiceProfileId,
    }, assetType, cacheOnly);
    let revokeBlobUrl = false;

    // A stub:// result is intentionally treated as unavailable. We still request
    // a real audio blob from the existing legacy endpoint and put it in AudioQueue.
    if (!audioUrl && canUsePaidFallback) {
      audioUrl = await this.getQueuedFallbackAudioUrl(ttsText, options);
      revokeBlobUrl = Boolean(audioUrl);
      this.log("[AI_TTS] fallback result", {
        provider: audioUrl ? "legacy_tts_queue" : "system_speech",
        tutorId: options.voiceProfileId,
        requestedGender: options.voiceGender,
      });
    }

    if (!audioUrl) {
      if (isTutorRoleAsset(assetType)) {
        this.log("[AI_TTS] playback failed", {
          reason: cacheOnly ? "cache_only_miss_no_tutor_voice" : "cloud_audio_unavailable_no_tutor_voice",
          tutorId: options.voiceProfileId,
          assetType,
        });
        options.onSpeakEnd?.();
        return;
      }
      this.log("[AI_TTS] fallback provider used", {
        provider: "system_speech",
        reason: cacheOnly ? "cache_only_miss" : "cloud_audio_unavailable",
        tutorId: options.voiceProfileId,
      });
      this.speakSystemFallback(ttsText, options);
      return;
    }

    this.enqueueAudio({
      idPrefix: "tutor",
      text: ttsText,
      url: audioUrl,
      priority: 30,
      revokeBlobUrl,
      options,
    });
  }

  private async getTtsAudioUrl(
    text: string,
    options: TutorVoiceOptions,
    assetType: TutorAudioAssetType,
    cacheOnly: boolean
  ): Promise<string | null> {
    try {
      const response = await fetch("/api/tts/get-or-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          languageCode: options.languageCode,
          assetType,
          voiceGender: options.voiceGender,
          voiceProfileId: options.voiceProfileId,
          audioFormat: options.audioFormat,
          audioVersionString: options.audioVersionString,
          sceneId: options.sceneId,
          sceneVersion: options.sceneVersion,
          cacheOnly,
        }),
      });

      if (!response.ok) {
        this.log("[AI_TTS] cache endpoint failed", { status: response.status });
        return null;
      }

      const data = await response.json();
      // Prefer inline audio (fresh synthesis) so we skip a second download; fall
      // back to the signed URL for cache hits.
      const url: string | null = data.audioBase64
        ? `data:audio/mpeg;base64,${data.audioBase64}`
        : data.signedUrl || null;
      this.log(data.cached ? "[AI_TTS] cache hit" : "[AI_TTS] cache miss", {
        id: data.id,
        status: data.status,
        hasSignedUrl: Boolean(url),
        voiceProfileId: options.voiceProfileId,
      });

      if (!url || url.startsWith("stub://")) {
        this.log("[AI_TTS] cache audio unavailable", {
          reason: !url ? "missing_signed_url" : "stub_provider",
        });
        return null;
      }
      return url;
    } catch (error) {
      this.log("[AI_TTS] cache endpoint error", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Uses the existing server endpoint to obtain a tutor-specific MP3, then lets
   * AudioQueue perform the only actual playback. This keeps follow-up speech in
   * the same unlocked audio pipeline as the first line.
   */
  private async getQueuedFallbackAudioUrl(text: string, options: TutorVoiceOptions): Promise<string | null> {
    const language = toLearningLanguage(options.languageCode);
    const { tutor } = this.resolveTutor(options);
    const fallback = voiceForLanguage(language, audioQueueService.getPlaybackRate());

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: text,
          voice: tutor?.ttsVoice || fallback.ttsVoice || "nova",
          instructions: tutor?.ttsInstructions || fallback.ttsInstructions,
          speed: audioQueueService.getPlaybackRate(),
        }),
      });
      if (!response.ok) {
        this.log("[AI_TTS] legacy fallback failed", { status: response.status });
        return null;
      }
      const blob = await response.blob();
      if (!blob.size) return null;
      return URL.createObjectURL(blob);
    } catch (error) {
      this.log("[AI_TTS] legacy fallback error", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private enqueueAudio({
    idPrefix,
    text,
    url,
    priority,
    revokeBlobUrl,
    options,
  }: {
    idPrefix: string;
    text: string;
    url: string;
    priority: number;
    revokeBlobUrl: boolean;
    options: TutorVoiceOptions;
  }): void {
    let cleaned = false;
    const cleanup = () => {
      if (!cleaned && revokeBlobUrl && url.startsWith("blob:")) {
        cleaned = true;
        URL.revokeObjectURL(url);
      }
    };
    const assetType = options.assetType || (idPrefix === "manual" ? "tutor_reply" : "dynamic_tutor_reply");

    audioQueueService.enqueue({
      id: `${idPrefix}-${Date.now()}`,
      url,
      text,
      priority,
      // AI 導師對話語音要更大聲，提高音量增益（高於一般朗讀的預設值）。
      gain: TUTOR_VOICE_GAIN,
      onStart: () => {
        this.isPlaying = true;
        options.onSpeakStart?.();
        this.log("[AI_TTS] playback started", { tutorId: options.voiceProfileId });
      },
      onEnd: () => {
        this.isPlaying = false;
        cleanup();
        options.onSpeakEnd?.();
        this.log("[AI_TTS] playback ended", { tutorId: options.voiceProfileId });
      },
      onError: (error) => {
        this.isPlaying = false;
        cleanup();
        this.log("[AI_TTS] playback failed", {
          error: error.message,
          tutorId: options.voiceProfileId,
          assetType,
        });
        if (isTutorRoleAsset(assetType)) {
          options.onSpeakEnd?.();
          return;
        }
        this.speakSystemFallback(text, options);
      },
    });
  }

  /** Last-resort device speech, retaining the selected tutor's language hints. */
  private speakSystemFallback(text: string, options: TutorVoiceOptions): void {
    const language = toLearningLanguage(options.languageCode);
    const { tutor } = this.resolveTutor(options);
    const defaults = voiceForLanguage(language, audioQueueService.getPlaybackRate());

    this.log("[AI_TTS] system fallback used", {
      tutorId: tutor?.id || options.voiceProfileId,
      requestedGender: options.voiceGender,
      languageCode: options.languageCode,
    });

    const result = speechService.speak(text, {
      ...defaults,
      lang: tutor?.lang || defaults.lang,
      voiceKeywords: tutor?.voiceKeywords || defaults.voiceKeywords,
      // Do not call the separate OpenAI Audio implementation from speechService.
      // It would create another unmanaged player and reintroduce autoplay issues.
      ttsVoice: undefined,
      ttsInstructions: undefined,
      volumeGain: 1,
      onStart: () => {
        this.isPlaying = true;
        options.onSpeakStart?.();
      },
      onEnd: () => {
        this.isPlaying = false;
        options.onSpeakEnd?.();
      },
      onError: (message) => {
        this.log("[AI_TTS] system fallback failed", { error: message });
        this.isPlaying = false;
        options.onSpeakEnd?.();
      },
    });

    if (!result.ok) {
      this.isPlaying = false;
      options.onSpeakEnd?.();
    }
  }

  async playManual(text: string, options: TutorVoiceOptions): Promise<void> {
    const clean = text.trim();
    if (!clean) return;

    await audioQueueService.unlockAudio();
    audioQueueService.clearQueue();
    const assetType = options.assetType || "tutor_reply";
    const cacheOnly = options.cacheOnly ?? false;
    const canUsePaidFallback = !cacheOnly;

    const { chirpVoiceProfileId } = this.resolveTutor(options);
    let audioUrl = await this.getTtsAudioUrl(clean, {
      ...options,
      voiceProfileId: chirpVoiceProfileId || options.voiceProfileId,
    }, assetType, cacheOnly);
    let revokeBlobUrl = false;

    if (!audioUrl && canUsePaidFallback) {
      audioUrl = await this.getQueuedFallbackAudioUrl(clean, options);
      revokeBlobUrl = Boolean(audioUrl);
    }

    if (!audioUrl) {
      this.log("[AI_TTS] fallback provider used", {
        provider: "system_speech",
        reason: cacheOnly ? "cache_only_miss" : "cloud_audio_unavailable",
        tutorId: options.voiceProfileId,
      });
      this.speakSystemFallback(clean, options);
      return;
    }

    this.enqueueAudio({
      idPrefix: "manual",
      text: clean,
      url: audioUrl,
      priority: 20,
      revokeBlobUrl,
      options,
    });
  }

  stop(): void {
    audioQueueService.stopCurrent();
    this.isPlaying = false;
  }

  setAutoPlay(autoPlay: boolean): void {
    audioQueueService.setAutoPlayTutorVoice(autoPlay);
  }

  setRecording(recording: boolean): void {
    audioQueueService.setRecording(recording);
  }

  isPlayingNow(): boolean {
    return this.isPlaying;
  }

  private log(message: string, data?: Record<string, unknown>): void {
    console.log(message, { ...data, timestamp: new Date().toISOString() });
  }
}

export const tutorVoiceService = new TutorVoiceService();
