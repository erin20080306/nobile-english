/**
 * AI 導師語音自動播放服務
 * 
 * 處理：
 * - AI 導師回覆後的自動播放判斷
 * - TTS API 呼叫
 * - 音檔 URL 取得
 * - 加入 Audio Queue
 * - 統一 AI_TTS debug log
 */

import { audioQueueService } from "./audioQueueService";
import { speechService } from "./speechService";
import { voiceForLanguage } from "@/data/learningLanguages";
import type { TutorFeedback } from "@/types";
import type { LearningLanguageCode } from "@/types";

interface TutorVoiceOptions {
  languageCode: string;
  voiceGender?: string;
  voiceProfileId?: string;
  audioFormat?: string;
  audioVersionString?: string;
  sceneId?: string;
  sceneVersion?: string;
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
}

class TutorVoiceService {
  private isPlaying = false;

  /**
   * 自動播放 AI 導師回覆
   */
  async playTutorReply(
    feedback: TutorFeedback,
    options: TutorVoiceOptions
  ): Promise<void> {
    const replyText = feedback.reply?.trim() || "";
    const ttsCandidate = feedback.ttsCandidate?.trim() || "";
    const ttsText = ttsCandidate || replyText || "";

    this.log("[AI_TTS] tutor feedback received", {
      languageCode: options.languageCode,
      reply: feedback.reply,
      replyZh: feedback.replyZh,
      ttsCandidate: feedback.ttsCandidate,
    });
    this.log("[AI_TTS] reply exists", { exists: !!replyText });
    this.log("[AI_TTS] ttsCandidate exists", { exists: !!ttsCandidate });
    this.log("[AI_TTS] resolved ttsText", {
      exists: !!ttsText,
      text: ttsText,
    });

    if (!ttsText) {
      this.log("[AI_TTS] playback skipped reason", {
        reason: !replyText && !ttsCandidate ? "reply 空白 / ttsCandidate 空白" : "resolved ttsText 空白",
      });
      return;
    }

    // 1. 強制解鎖音訊（確保可以播放）
    try {
      await audioQueueService.unlockAudio();
    } catch (error) {
      this.log("[AI_TTS] Audio unlock failed, continuing anyway", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 2. 檢查自動播放設定
    const state = audioQueueService.getState();
    if (!state.autoPlayTutorVoice) {
      this.log("[AI_TTS] playback skipped reason", {
        reason: "autoPlayTutorVoice 關閉",
      });
      return;
    }

    if (state.recording) {
      this.log("[AI_TTS] playback skipped reason", {
        reason: "recording still active",
      });
      return;
    }

    // 3. 清空佇列並停止當前播放，確保導師語音優先播放
    audioQueueService.clearQueue();
    this.stop();

    // 4. 取得音檔 URL
    this.log("[AI_TTS] Fetching TTS audio URL", {
      text: ttsText,
      languageCode: options.languageCode,
    });

    let audioUrl: string | null = null;
    try {
      audioUrl = await this.getTtsAudioUrl(ttsText, options);
      if (audioUrl) this.log("[AI_TTS] audio URL received", { url: "received" });
    } catch (error) {
      this.log("[AI_TTS] playback skipped reason", {
        reason: "TTS API 失敗",
        error: error instanceof Error ? error.message : String(error),
      });
      this.speakFallback(ttsText, options.languageCode, options.onSpeakStart, options.onSpeakEnd);
      return;
    }

    if (!audioUrl) {
      this.log("[AI_TTS] playback skipped reason", {
        reason: "TTS API 失敗或無有效 signed URL",
      });
      this.speakFallback(ttsText, options.languageCode, options.onSpeakStart, options.onSpeakEnd);
      return;
    }

    // 5. 加入 Audio Queue
    this.log("[AI_TTS] queue enqueue", {
      url: audioUrl,
      text: ttsText,
    });

    audioQueueService.enqueue({
      id: `tutor-${Date.now()}`,
      url: audioUrl,
      text: ttsText,
      priority: 30, // 導師語音優先級最高（高於手動播放的 20）
      onStart: () => {
        this.isPlaying = true;
        options.onSpeakStart?.();
        this.log("[AI_TTS] playback started");
      },
      onEnd: () => {
        this.isPlaying = false;
        options.onSpeakEnd?.();
        this.log("[AI_TTS] playback ended");
      },
      onError: (error) => {
        this.isPlaying = false;
        this.log("[AI_TTS] playback skipped reason", {
          reason: error.message.includes("play()") ? "audio.play() 被拒絕" : "signed URL 失效",
          error: error.message,
        });
        this.speakFallback(ttsText, options.languageCode, options.onSpeakStart, options.onSpeakEnd);
      },
    });
  }

  /**
   * 取得 TTS 音檔 URL
   */
  private async getTtsAudioUrl(
    text: string,
    options: TutorVoiceOptions
  ): Promise<string | null> {
    try {
      const response = await fetch("/api/tts/get-or-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          languageCode: options.languageCode,
          assetType: "dynamic_tutor_reply",
          voiceGender: options.voiceGender,
          voiceProfileId: options.voiceProfileId,
          audioFormat: options.audioFormat,
          audioVersionString: options.audioVersionString,
          sceneId: options.sceneId,
          sceneVersion: options.sceneVersion,
        }),
      });

      if (!response.ok) {
        this.log("[AI_TTS] TTS API request failed", {
          status: response.status,
          statusText: response.statusText,
        });
        return null;
      }

      const data = await response.json();
      this.log("[AI_TTS] TTS API response", {
        id: data.id,
        status: data.status,
        cached: data.cached,
        hasSignedUrl: !!data.signedUrl,
      });
      this.log(data.cached ? "[AI_TTS] cache hit" : "[AI_TTS] cache miss", {
        id: data.id,
        status: data.status,
      });

      const url: string | null = data.signedUrl || null;
      // Stub provider returns stub:// URLs which cannot be played — treat as null
      if (url && url.startsWith("stub://")) {
        this.log("[AI_TTS] playback skipped reason", {
          reason: "stub URL",
        });
        this.log("[AI_TTS] fallback used", {
          reason: "stub URL",
        });
        return null;
      }
      if (!url) {
        this.log("[AI_TTS] playback skipped reason", {
          reason: "signed URL 失效",
        });
        return null;
      }
      return url;
    } catch (error) {
      this.log("[AI_TTS] playback skipped reason", {
        reason: "TTS API 失敗",
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Web Speech API fallback
   */
  private speakFallback(text: string, languageCode: string, onSpeakStart?: () => void, onSpeakEnd?: () => void): void {
    this.log("[AI_TTS] fallback used", { text, languageCode });
    const opts = voiceForLanguage(languageCode as LearningLanguageCode);
    const result = speechService.speak(text, {
      ...opts,
      onStart: () => {
        this.isPlaying = true;
        onSpeakStart?.();
        this.log("[AI_TTS] playback started", { fallback: true });
      },
      onEnd: () => {
        this.isPlaying = false;
        onSpeakEnd?.();
        this.log("[AI_TTS] playback ended", { fallback: true });
      },
      onError: (msg) => {
        this.log("[AI_TTS] playback skipped reason", {
          reason: "Web Speech fallback 失敗",
          error: msg,
        });
        this.isPlaying = false;
        onSpeakEnd?.();
      },
    });
    this.log("[AI_TTS] Web Speech API speak result", { ok: result.ok, message: result.message });
    if (!result.ok) {
      this.log("[AI_TTS] playback skipped reason", {
        reason: "Web Speech fallback 失敗",
        error: result.message,
      });
      this.isPlaying = false;
      onSpeakEnd?.();
    }
  }

  /**
   * 手動播放導師語音
   */
  async playManual(
    text: string,
    options: TutorVoiceOptions
  ): Promise<void> {
    this.log("[AI_TTS] playManual called", {
      text,
      languageCode: options.languageCode,
    });

    // 解鎖音訊
    await audioQueueService.unlockAudio();

    // 取得音檔 URL
    const audioUrl = await this.getTtsAudioUrl(text, options);
    if (!audioUrl) {
      this.log("[AI_TTS] fallback used", { reason: "manual playback no audio URL" });
      this.speakFallback(text, options.languageCode, options.onSpeakStart, options.onSpeakEnd);
      return;
    }

    // 加入 Audio Queue
    audioQueueService.enqueue({
      id: `manual-${Date.now()}`,
      url: audioUrl,
      text,
      priority: 20, // 手動播放優先級最高
      onStart: () => {
        this.isPlaying = true;
        options.onSpeakStart?.();
        this.log("[AI_TTS] Manual playback started");
      },
      onEnd: () => {
        this.isPlaying = false;
        options.onSpeakEnd?.();
        this.log("[AI_TTS] Manual playback ended");
      },
      onError: (error) => {
        this.isPlaying = false;
        options.onSpeakEnd?.();
        this.log("[AI_TTS] Manual playback error", {
          error: error.message,
        });
      },
    });
  }

  /**
   * 停止當前播放
   */
  stop(): void {
    this.log("[AI_TTS] Stop called");
    audioQueueService.stopCurrent();
    this.isPlaying = false;
  }

  /**
   * 設定自動播放導師語音
   */
  setAutoPlay(autoPlay: boolean): void {
    this.log("[AI_TTS] Set autoPlay", { autoPlay });
    audioQueueService.setAutoPlayTutorVoice(autoPlay);
  }

  /**
   * 設定錄音狀態
   */
  setRecording(recording: boolean): void {
    this.log("[AI_TTS] Set recording", { recording });
    audioQueueService.setRecording(recording);
  }

  /**
   * 檢查是否正在播放
   */
  isPlayingNow(): boolean {
    return this.isPlaying;
  }

  private log(message: string, data?: any): void {
    const logData = {
      ...data,
      timestamp: new Date().toISOString(),
    };
    console.log(message, logData);
  }
}

// 單例
export const tutorVoiceService = new TutorVoiceService();
