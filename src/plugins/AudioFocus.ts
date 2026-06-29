import { registerPlugin } from '@capacitor/core';

export interface AudioFocusPlugin {
  requestAudioFocus(): Promise<{ success: boolean; hasFocus: boolean }>;
  abandonAudioFocus(): Promise<{ success: boolean }>;
  hasAudioFocus(): Promise<{ hasFocus: boolean }>;
  addListener(eventName: 'audioFocusChange', listenerFunc: (data: { change: string }) => void): Promise<void>;
}

const AudioFocus = registerPlugin<AudioFocusPlugin>('AudioFocusPlugin');

export class AudioFocusService {
  private listeners: Array<(change: string) => void> = [];

  /**
   * Request audio focus for playback
   * - Usage: MEDIA
   * - Content Type: SPEECH
   */
  async requestAudioFocus(): Promise<void> {
    try {
      const result = await AudioFocus.requestAudioFocus();
      console.log('[AudioFocus] Request audio focus:', result);
    } catch (error) {
      console.error('[AudioFocus] Failed to request audio focus:', error);
      throw error;
    }
  }

  /**
   * Abandon audio focus when playback ends
   */
  async abandonAudioFocus(): Promise<void> {
    try {
      await AudioFocus.abandonAudioFocus();
      console.log('[AudioFocus] Abandoned audio focus');
    } catch (error) {
      console.error('[AudioFocus] Failed to abandon audio focus:', error);
      throw error;
    }
  }

  /**
   * Check if we currently have audio focus
   */
  async hasAudioFocus(): Promise<boolean> {
    try {
      const result = await AudioFocus.hasAudioFocus();
      return result.hasFocus;
    } catch (error) {
      console.error('[AudioFocus] Failed to check audio focus:', error);
      return false;
    }
  }

  /**
   * Listen for audio focus changes
   */
  async addAudioFocusListener(listener: (change: string) => void): Promise<void> {
    try {
      await AudioFocus.addListener('audioFocusChange', (data) => {
        console.log('[AudioFocus] Audio focus changed:', data.change);
        listener(data.change);
      });
      this.listeners.push(listener);
    } catch (error) {
      console.error('[AudioFocus] Failed to add listener:', error);
      throw error;
    }
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners = [];
  }
}

export const audioFocusService = new AudioFocusService();
