package com.getcapacitor.plugin;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AudioFocusPlugin")
public class AudioFocusPlugin extends Plugin {

    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private boolean hasAudioFocus = false;

    private AudioManager.OnAudioFocusChangeListener audioFocusChangeListener = new AudioManager.OnAudioFocusChangeListener() {
        @Override
        public void onAudioFocusChange(int focusChange) {
            switch (focusChange) {
                case AudioManager.AUDIOFOCUS_GAIN:
                    // Resume playback
                    hasAudioFocus = true;
                    notifyAudioFocusChange("gained");
                    break;
                case AudioManager.AUDIOFOCUS_LOSS:
                    // Stop playback
                    hasAudioFocus = false;
                    notifyAudioFocusChange("lost");
                    break;
                case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                    // Pause playback
                    hasAudioFocus = false;
                    notifyAudioFocusChange("lost_transient");
                    break;
                case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                    // Lower volume (duck)
                    hasAudioFocus = false;
                    notifyAudioFocusChange("lost_transient_can_duck");
                    break;
            }
        }
    };

    @Override
    public void load() {
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    @PluginMethod
    public void requestAudioFocus(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Android 8.0+ use AudioFocusRequest
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build();

            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(audioAttributes)
                    .setAcceptsDelayedFocusGain(true)
                    .setOnAudioFocusChangeListener(audioFocusChangeListener)
                    .build();

            int result = audioManager.requestAudioFocus(audioFocusRequest);
            if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                hasAudioFocus = true;
                call.resolve(new JSObject().put("success", true).put("hasFocus", true));
            } else {
                hasAudioFocus = false;
                call.resolve(new JSObject().put("success", false).put("hasFocus", false));
            }
        } else {
            // Android 7.1 and below use deprecated method
            int result = audioManager.requestAudioFocus(audioFocusChangeListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
            if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                hasAudioFocus = true;
                call.resolve(new JSObject().put("success", true).put("hasFocus", true));
            } else {
                hasAudioFocus = false;
                call.resolve(new JSObject().put("success", false).put("hasFocus", false));
            }
        }
    }

    @PluginMethod
    public void abandonAudioFocus(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            int result = audioManager.abandonAudioFocusRequest(audioFocusRequest);
            if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                hasAudioFocus = false;
                call.resolve(new JSObject().put("success", true));
            } else {
                call.resolve(new JSObject().put("success", false));
            }
        } else {
            int result = audioManager.abandonAudioFocus(audioFocusChangeListener);
            if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                hasAudioFocus = false;
                call.resolve(new JSObject().put("success", true));
            } else {
                call.resolve(new JSObject().put("success", false));
            }
        }
    }

    @PluginMethod
    public void hasAudioFocus(PluginCall call) {
        call.resolve(new JSObject().put("hasFocus", hasAudioFocus));
    }

    private void notifyAudioFocusChange(String change) {
        JSObject data = new JSObject();
        data.put("change", change);
        notifyListeners("audioFocusChange", data);
    }
}
