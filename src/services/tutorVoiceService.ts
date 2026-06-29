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
import type { TutorFeedback } from "@/types";

interface TutorVoiceOptions {
  languageCode: string;
  voiceGender?: string;
  voiceProfileId?: string;
  audioFormat?: string;
  audioVersion?: string;
  sceneId?: string;
  sceneVersion?: string;
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
    this.log("[AI_TTS] playTutorReply called", {
      hasTtsCandidate: !!feedback.ttsCandidate,
      reply: feedback.reply,
      replyZh: feedback.replyZh,
      languageCode: options.languageCode,
    });

    // 1. 檢查是否有 ttsCandidate
    if (!feedback.ttsCandidate) {
      this.log("[AI_TTS] No ttsCandidate, skipping playback");
      return;
    }

    // 2. 檢查自動播放設定
    const state = audioQueueService.getState();
    if (!state.autoPlayTutorVoice) {
      this.log("[AI_TTS] autoPlayTutorVoice is disabled, skipping playback");
      return;
    }

    // 3. 檢查是否在錄音中
    if (state.recording) {
      this.log("[AI_TTS] Recording in progress, skipping playback");
      return;
    }

    // 4. 取得音檔 URL
    this.log("[AI_TTS] Fetching TTS audio URL", {
      text: feedback.ttsCandidate,
      languageCode: options.languageCode,
    });

    let audioUrl: string | null = null;
    try {
      audioUrl = await this.getTtsAudioUrl(feedback.ttsCandidate, options);
      this.log("[AI_TTS] TTS audio URL received", {
        url: audioUrl ? "received" : "null",
      });
    } catch (error) {
      this.log("[AI_TTS] Failed to get TTS audio URL", {
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    if (!audioUrl) {
      this.log("[AI_TTS] No audio URL returned, skipping playback");
      return;
    }

    // 5. 加入 Audio Queue
    this.log("[AI_TTS] Enqueueing audio to queue", {
      url: audioUrl,
      text: feedback.ttsCandidate,
    });

    audioQueueService.enqueue({
      id: `tutor-${Date.now()}`,
      url: audioUrl,
      text: feedback.ttsCandidate,
      priority: 10, // 導師語音優先級高
      onStart: () => {
        this.isPlaying = true;
        this.log("[AI_TTS] Tutor voice playback started");
      },
      onEnd: () => {
        this.isPlaying = false;
        this.log("[AI_TTS] Tutor voice playback ended");
      },
      onError: (error) => {
        this.isPlaying = false;
        this.log("[AI_TTS] Tutor voice playback error", {
          error: error.message,
        });
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
          audioVersion: options.audioVersion,
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

      return data.signedUrl || null;
    } catch (error) {
      this.log("[AI_TTS] TTS API request error", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
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
      this.log("[AI_TTS] No audio URL for manual playback");
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
        this.log("[AI_TTS] Manual playback started");
      },
      onEnd: () => {
        this.isPlaying = false;
        this.log("[AI_TTS] Manual playback ended");
      },
      onError: (error) => {
        this.isPlaying = false;
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
