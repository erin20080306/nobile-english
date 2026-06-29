import Foundation
import AVFoundation

@objc(AudioSessionPlugin)
public class AudioSessionPlugin: CAPPlugin {

    @objc func setPlaybackMode(_ call: CAPPluginCall) {
        do {
            let session = AVAudioSession.sharedInstance()
            
            // Configure for playback
            try session.setCategory(
                AVAudioSession.Category.playback,
                mode: AVAudioSession.Mode.spokenAudio,
                options: [.duckOthers, .allowBluetooth, .allowBluetoothA2DP]
            )
            
            try session.setActive(true)
            
            call.resolve([
                "success": true,
                "category": session.category.rawValue,
                "mode": session.mode.rawValue
            ])
        } catch {
            call.reject("Failed to set playback mode: \(error.localizedDescription)")
        }
    }

    @objc func setRecordingMode(_ call: CAPPluginCall) {
        do {
            let session = AVAudioSession.sharedInstance()
            
            // Configure for recording
            try session.setCategory(
                AVAudioSession.Category.playAndRecord,
                mode: AVAudioSession.Mode.voiceChat,
                options: [.defaultToSpeaker, .allowBluetooth]
            )
            
            try session.setActive(true)
            
            call.resolve([
                "success": true,
                "category": session.category.rawValue,
                "mode": session.mode.rawValue
            ])
        } catch {
            call.reject("Failed to set recording mode: \(error.localizedDescription)")
        }
    }

    @objc func deactivate(_ call: CAPPluginCall) {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setActive(false)
            call.resolve(["success": true])
        } catch {
            call.reject("Failed to deactivate audio session: \(error.localizedDescription)")
        }
    }

    @objc func getCurrentMode(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        call.resolve([
            "category": session.category.rawValue,
            "mode": session.mode.rawValue,
            "isActive": session.isActive
        ])
    }
}
