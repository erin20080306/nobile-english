import { registerPlugin } from '@capacitor/core';

export interface AudioSessionPlugin {
  setPlaybackMode(): Promise<{ success: boolean; category: string; mode: string }>;
  setRecordingMode(): Promise<{ success: boolean; category: string; mode: string }>;
  deactivate(): Promise<{ success: boolean }>;
  getCurrentMode(): Promise<{ category: string; mode: string; isActive: boolean }>;
}

const AudioSession = registerPlugin<AudioSessionPlugin>('AudioSessionPlugin');

export class AudioSessionService {
  /**
   * Set audio session to playback mode for tutor voice
   * - Category: playback
   * - Mode: spokenAudio
   * - Options: duckOthers, allowBluetooth, allowBluetoothA2DP
   */
  async setPlaybackMode(): Promise<void> {
    try {
      await AudioSession.setPlaybackMode();
      console.log('[AudioSession] Set to playback mode');
    } catch (error) {
      console.error('[AudioSession] Failed to set playback mode:', error);
      throw error;
    }
  }

  /**
   * Set audio session to recording mode for user input
   * - Category: playAndRecord
   * - Mode: voiceChat
   * - Options: defaultToSpeaker, allowBluetooth
   */
  async setRecordingMode(): Promise<void> {
    try {
      await AudioSession.setRecordingMode();
      console.log('[AudioSession] Set to recording mode');
    } catch (error) {
      console.error('[AudioSession] Failed to set recording mode:', error);
      throw error;
    }
  }

  /**
   * Deactivate audio session
   */
  async deactivate(): Promise<void> {
    try {
      await AudioSession.deactivate();
      console.log('[AudioSession] Deactivated');
    } catch (error) {
      console.error('[AudioSession] Failed to deactivate:', error);
      throw error;
    }
  }

  /**
   * Get current audio session mode
   */
  async getCurrentMode(): Promise<{ category: string; mode: string; isActive: boolean }> {
    try {
      const result = await AudioSession.getCurrentMode();
      console.log('[AudioSession] Current mode:', result);
      return result;
    } catch (error) {
      console.error('[AudioSession] Failed to get current mode:', error);
      throw error;
    }
  }
}

export const audioSessionService = new AudioSessionService();
