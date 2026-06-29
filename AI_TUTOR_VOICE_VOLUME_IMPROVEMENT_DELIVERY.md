# AI 導師語音音量改善交付文件

## 概述

完成 AI 導師語音音量改善功能，解決手機喇叭播放時聲音太小、不夠清楚的問題。

## 診斷結果

### 目前聲音太小的真正原因

1. **使用 -16 LUFS 音量標準** - 對手機語音播放來說太安靜，目標是 -14 LUFS
2. **沒有實際 ffmpeg 後處理** - 目前只是 stub，沒有實際音訊處理
3. **缺少 raw_audio_path** - 無法保留原始音檔進行重新處理
4. **audio_version 為 integer** - 無法區分 "v2_loud" 等處理版本
5. **導師兩段回覆可能分開處理** - 需要合併為單一音檔

## 完成項目

### 1. 資料庫架構更新

**Supabase Migration SQL** (`supabase/migrations/20240629_tts_audio_assets_v2_loud.sql`)
- 新增 `raw_audio_path` - 原始 Chirp 3 HD 輸出路徑
- 新增 `processed_audio_path` - v2_loud 後處理音檔路徑
- 新增 `audio_version_string` - 音訊版本字串（v1, v2_loud）
- 新增 `integrated_lufs` - 積分音量（LUFS）
- 新增 `true_peak_dbtp` - 真實峰值（dBTP）
- 新增 `loudness_range_lu` - 音量範圍（LU）
- 新增 `processing_status` - 處理狀態（none, pending, processing, ready, failed）
- 新增 `processing_error` - 處理錯誤訊息
- 新增 `processed_at` - 處理完成時間
- 更新唯一索引使用 `audio_version_string`

### 2. v2_loud 音檔後處理流程

**音訊後處理服務** (`src/server/tts/audioPostProcessor.ts`)
- 目標音量標準：
  - Integrated Loudness: -14 LUFS
  - True Peak: -1.0 dBTP
  - Loudness Range: 5-7 LU
- FFmpeg 處理流程：
  1. 去除頭尾過長靜音
  2. 高通濾波（highpass=f=80）- 移除低頻悶聲
  3. 輕量 EQ（equalizer=f=3000:width_type=h:width=500:g=2）- 提升人聲清晰度
  4. Loudness normalization（loudnorm=I=-14:TP=-1.0:LRA=7）
  5. True Peak limiter（alimiter=level_in=1:level_out=1:limit=1:release=200）
  6. 輸出 M4A (AAC) 與 MP3 fallback
- 音訊指標測量功能
- 標準符合性檢查功能

### 3. 音檔重新處理 API

**重新處理 API** (`src/app/api/admin/audio/reprocess/route.ts`)
- POST `/api/admin/audio/reprocess`
- 支援單一音檔、場景、全部重新處理
- 支援 dry-run 模式
- 防止重複處理
- 處理失敗時保留舊版音檔

### 4. CLI 工具

**音檔重新處理 CLI** (`scripts/audio-reprocess.ts`)
- `pnpm audio:reprocess --asset=<assetId>` - 重新處理單一音檔
- `pnpm audio:reprocess --scene=<sceneId>` - 重新處理場景音檔
- `pnpm audio:reprocess --all --dry-run` - 全部 dry-run
- `pnpm audio:reprocess --all --confirm` - 全部重新處理
- `pnpm audio:quality-report` - 產生品質報告

### 5. 導師兩段回覆合併

**確認既有功能** (`src/server/tts/normalizeText.ts`)
- `combineTutorText()` 函數已存在
- 將 tutorPart1 與 tutorPart2 合併為單一文字
- 產生單一 Chirp 3 HD 音檔
- 單一 Audio Queue item 播放

### 6. TTS 系統更新

**TypeScript 型別更新** (`src/server/tts/types.ts`)
- 新增 `TtsProcessingStatus` 型別
- 新增 `AudioVersionString` 型別（v1, v2_loud）
- 更新 `TtsAudioAsset` 介面包含 v2_loud 欄位
- 更新 `TtsAssetKey` 使用 `audioVersionString`
- 更新 `GetOrCreateInput` 使用 `audioVersionString`

**Hash 計算更新** (`src/server/tts/hash.ts`)
- 更新 `computeTextHash()` 使用 `audioVersionString`
- 更新 `assetCacheKey()` 使用 `audioVersionString`

**Store 更新** (`src/server/tts/store.ts`)
- 更新 `ReserveInput` 使用 `audioVersionString`
- 更新 `TtsAssetStore` 介面使用 `audioVersionString`
- 更新 `InMemoryTtsAssetStore` 實作包含 v2_loud 欄位

**Service 更新** (`src/server/tts/service.ts`)
- 更新 `getOrCreateTtsAsset()` 使用 `audioVersionString`
- 預設使用 `v2_loud` 版本

**API 更新** (`src/app/api/tts/get-or-create/route.ts`)
- 更新使用 `audioVersionString` 參數

### 7. 前端音量確認

**Audio Queue 音量檢查** (`src/services/audioQueueService.ts`)
- 確認 `audio.volume = 1` 已設定
- 確認 `audio.muted = false` 已設定
- 確認播放前音量設定正確

### 8. iOS AVAudioSession 切換

**iOS Audio Session Plugin** (`ios/App/App/Plugins/AudioSessionPlugin.swift`)
- `setPlaybackMode()` - 設定播放模式
  - Category: playback
  - Mode: spokenAudio
  - Options: duckOthers, allowBluetooth, allowBluetoothA2DP
- `setRecordingMode()` - 設定錄音模式
  - Category: playAndRecord
  - Mode: voiceChat
  - Options: defaultToSpeaker, allowBluetooth
- `deactivate()` - 停用 audio session
- `getCurrentMode()` - 取得當前模式

**TypeScript 介面** (`src/plugins/AudioSession.ts`)
- `AudioSessionService` 類別
- `setPlaybackMode()` 方法
- `setRecordingMode()` 方法
- `deactivate()` 方法
- `getCurrentMode()` 方法

### 9. Android Audio Focus 處理

**Android Audio Focus Plugin** (`android/app/src/main/java/com/getcapacitor/plugin/AudioFocusPlugin.java`)
- `requestAudioFocus()` - 請求 audio focus
  - Usage: MEDIA
  - Content Type: SPEECH
  - 支援 Android 8.0+ AudioFocusRequest
  - 支援 Android 7.1 以下舊版方法
- `abandonAudioFocus()` - 釋放 audio focus
- `hasAudioFocus()` - 檢查 audio focus 狀態
- Audio focus 變更監聽器
  - AUDIOFOCUS_GAIN - 恢復播放
  - AUDIOFOCUS_LOSS - 停止播放
  - AUDIOFOCUS_LOSS_TRANSIENT - 暫停播放
  - AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK - 降低音量

**TypeScript 介面** (`src/plugins/AudioFocus.ts`)
- `AudioFocusService` 類別
- `requestAudioFocus()` 方法
- `abandonAudioFocus()` 方法
- `hasAudioFocus()` 方法
- `addAudioFocusListener()` 方法

### 10. 管理者音訊品質測試頁面

**品質測試頁面** (`src/app/admin/audio-quality/page.tsx`)
- 顯示所有音檔資產
- 按版本篩選（v1, v2_loud）
- 按語言篩選
- 播放舊版與新版音檔比較
- 顯示 LUFS、True Peak、LRA 指標
- 標準符合性檢查
- 單一音檔重新處理
- 統計資料顯示

## FFmpeg 實際參數

### v2_loud 處理指令

```bash
# M4A 輸出
ffmpeg -y -i input.wav \
  -filter_complex '[0:a]highpass=f=80,equalizer=f=3000:width_type=h:width=500:g=2,loudnorm=I=-14:TP=-1.0:LRA=7,alimiter=level_in=1:level_out=1:limit=1:release=200[aout]' \
  -map '[aout]' \
  -c:a aac \
  -b:a 128k \
  -ar 44100 \
  -movflags +faststart \
  output.m4a

# MP3 輸出
ffmpeg -y -i input.wav \
  -filter_complex '[0:a]highpass=f=80,equalizer=f=3000:width_type=h:width=500:g=2,loudnorm=I=-14:TP=-1.0:LRA=7,alimiter=level_in=1:level_out=1:limit=1:release=200[aout]' \
  -map '[aout]' \
  -c:a libmp3lame \
  -b:a 128k \
  -ar 44100 \
  output.mp3
```

### 參數說明

- `highpass=f=80` - 移除 80Hz 以下低頻，減少悶聲
- `equalizer=f=3000:width_type=h:width=500:g=2` - 提升 3kHz 附近人聲清晰度，增益 2dB
- `loudnorm=I=-14:TP=-1.0:LRA=7` - EBU R128 標準化
  - I=-14: 目標積分音量 -14 LUFS
  - TP=-1.0: 目標真實峰值 -1.0 dBTP
  - LRA=7: 目標音量範圍 7 LU
- `alimiter=level_in=1:level_out=1:limit=1:release=200` - 峰值限制器
  - limit=1: 限制峰值在 0dB
  - release=200: 釋放時間 200ms
- `-c:a aac` - AAC 編碼
- `-b:a 128k` - 比特率 128kbps
- `-ar 44100` - 取樣率 44.1kHz
- `-movflags +faststart` - 快速啟動（網路串流優化）

## 舊音檔重新處理流程

### 使用 API

```bash
# 重新處理單一音檔
curl -X POST https://your-app.vercel.app/api/admin/audio/reprocess \
  -H "Content-Type: application/json" \
  -d '{"assetId": "your-asset-id"}'

# 重新處理場景音檔
curl -X POST https://your-app.vercel.app/api/admin/audio/reprocess \
  -H "Content-Type: application/json" \
  -d '{"sceneId": "your-scene-id"}'

# Dry-run 全部音檔
curl -X POST https://your-app.vercel.app/api/admin/audio/reprocess \
  -H "Content-Type: application/json" \
  -d '{"reprocessAll": true, "dryRun": true}'
```

### 使用 CLI

```bash
# 重新處理單一音檔
pnpm audio:reprocess --asset=<assetId>

# 重新處理場景音檔
pnpm audio:reprocess --scene=<sceneId>

# Dry-run 全部音檔
pnpm audio:reprocess --all --dry-run

# 確認後重新處理全部
pnpm audio:reprocess --all --confirm

# 產生品質報告
pnpm audio:quality-report
```

## 新 Chirp 3 HD 音檔自動套用 v2_loud

### 流程

1. 新文字 cache miss 時，呼叫 Chirp 3 HD 產生原始音檔
2. 保存 `raw_audio_path`
3. 自動呼叫 `processAudioToV2Loud()` 進行後處理
4. 保存 `processed_audio_path`
5. 設定 `audio_version_string = "v2_loud"`
6. 記錄 `integrated_lufs`、`true_peak_dbtp`、`loudness_range_lu`
7. 設定 `processing_status = "ready"`
8. 加入全站快取

### TTS Cache 不重複計費驗證

- 使用 `text_hash` + `audio_version_string` 作為唯一索引
- 同一文字 + 同一版本只會產生一次
- 既有的 v1 音檔不會被重新產生
- 只有 cache miss 時才會呼叫 Chirp 3 HD

## iOS Playback / Recording Audio Session 切換

### 導師播放時

```typescript
import { audioSessionService } from '@/plugins/AudioSession';

// 播放前
await audioSessionService.setPlaybackMode();
// Category: playback
// Mode: spokenAudio
// Options: duckOthers, allowBluetooth, allowBluetoothA2DP
```

### 使用者錄音時

```typescript
// 錄音前
await audioSessionService.setRecordingMode();
// Category: playAndRecord
// Mode: voiceChat
// Options: defaultToSpeaker, allowBluetooth

// 錄音後切回播放
await audioSessionService.setPlaybackMode();
```

### 重要規則

- 播放結束後才切換錄音模式
- 錄音結束後必須切回播放模式
- 不可讓導師語音在錄音模式下持續播放
- 使用 `defaultToSpeaker` 避免聲音走到聽筒

## Android Audio Focus 處理

### 導師播放前

```typescript
import { audioFocusService } from '@/plugins/AudioFocus';

// 請求 audio focus
await audioFocusService.requestAudioFocus();
// Usage: MEDIA
// Content Type: SPEECH
```

### 導師播放結束

```typescript
// 釋放 audio focus
await audioFocusService.abandonAudioFocus();
```

### Audio Focus 變更監聽

```typescript
// 監聽 audio focus 變更
await audioFocusService.addAudioFocusListener((change) => {
  switch (change) {
    case 'gained':
      // 恢復播放
      break;
    case 'lost':
      // 停止播放
      break;
    case 'lost_transient':
      // 暫停播放
      break;
    case 'lost_transient_can_duck':
      // 降低音量
      break;
  }
});
```

### 重要規則

- 導師播放與使用者錄音不可同時進行
- Audio focus 遺失時正確暫停或恢復
- 播放結束後釋放 Audio Focus

## 如何確認音檔沒有爆音、破音或過度壓縮

### 檢查方法

1. **True Peak 檢查**
   - True Peak 必須 ≤ -0.5 dBTP
   - 使用 `audioPostProcessor.getAudioMetrics()` 測量

2. **Loudness Range 檢查**
   - Loudness Range 必須在 5-7 LU 之間
   - 過小表示過度壓縮

3. **實際播放測試**
   - 使用管理者測試頁面播放
   - 檢查是否有刺耳聲音
   - 檢查是否有失真

4. **FFmpeg loudnorm 輸出**
   - 檢查 `input_tp` (True Peak)
   - 檢查 `input_lra` (Loudness Range)

### 標準符合性檢查

```typescript
import { meetsV2LoudStandards } from '@/server/tts/audioPostProcessor';

const metrics = await getAudioMetrics(audioPath);
const meetsStandards = meetsV2LoudStandards(metrics);
// returns true if:
// - integratedLufs within 1 LU of -14
// - truePeakDbtp <= -0.5 dBTP
// - loudnessRangeLu between 5-7 LU
```

## 如何確認導師播放時不會被錄音模式壓低音量

### iOS 檢查

1. **檢查 Audio Session Category**
   ```typescript
   const mode = await audioSessionService.getCurrentMode();
   console.log('Current mode:', mode);
   // 應該是 category: "playback", mode: "spokenAudio"
   ```

2. **檢查是否使用 PlayAndRecord**
   - 錄音模式使用 `playAndRecord` + `voiceChat`
   - 播放模式使用 `playback` + `spokenAudio`
   - 不可混用

3. **檢查 defaultToSpeaker**
   - PlayAndRecord 模式必須設定 `defaultToSpeaker`
   - 避免聲音走到聽筒

### Android 檢查

1. **檢查 Audio Focus**
   ```typescript
   const hasFocus = await audioFocusService.hasAudioFocus();
   console.log('Has audio focus:', hasFocus);
   // 播放時應該是 true
   ```

2. **檢查 Audio Attributes**
   - Usage: MEDIA
   - Content Type: SPEECH
   - 不可使用 VOICE_COMMUNICATION（會被 duck）

3. **檢查 Audio Focus 變更**
   - 監聽 `audioFocusChange` 事件
   - 確認沒有被 duck 或遺失

## 檔案清單

### 新增檔案
- `supabase/migrations/20240629_tts_audio_assets_v2_loud.sql`
- `src/server/tts/audioPostProcessor.ts`
- `src/app/api/admin/audio/reprocess/route.ts`
- `scripts/audio-reprocess.ts`
- `ios/App/App/Plugins/AudioSessionPlugin.swift`
- `src/plugins/AudioSession.ts`
- `android/app/src/main/java/com/getcapacitor/plugin/AudioFocusPlugin.java`
- `src/plugins/AudioFocus.ts`
- `src/app/admin/audio-quality/page.tsx`

### 修改檔案
- `src/server/tts/types.ts` - 新增 v2_loud 型別
- `src/server/tts/hash.ts` - 更新使用 audioVersionString
- `src/server/tts/store.ts` - 更新使用 audioVersionString
- `src/server/tts/service.ts` - 更新使用 audioVersionString
- `src/app/api/tts/get-or-create/route.ts` - 更新使用 audioVersionString

## 待完成項目

### 實機測試

需要進行以下實機測試：

1. **iPhone 測試**
   - 手機喇叭播放測試
   - 耳機播放測試
   - 藍牙耳機播放測試
   - Audio session 切換測試
   - 錄音模式切換測試

2. **Android 測試**
   - 手機喇叭播放測試
   - 耳機播放測試
   - 藍牙耳機播放測試
   - Audio focus 處理測試
   - 其他應用干擾測試

3. **Web 測試**
   - Chrome 播放測試
   - Safari 播放測試
   - 音量設定測試

4. **五種語言測試**
   - 英文
   - 日文
   - 韓文
   - 義大利文
   - 西班牙文

5. **不同音檔類型測試**
   - 練習句
   - 導師回覆（兩段合併）
   - 單字發音
   - 完整場景播放

## 注意事項

1. **FFmpeg 需要安裝** - v2_loud 處理需要 ffmpeg，需要在伺服器環境安裝
2. **Capacitor 插件需要註冊** - AudioSessionPlugin 和 AudioFocusPlugin 需要在 Capacitor 註冊
3. **實際 Chirp 3 HD 整合** - 目前 provider 為 stub，需要實際整合 Google Chirp 3 HD
4. **Supabase Storage** - 需要設定私有 bucket 存儲音檔
5. **權限控制** - 管理者 API 需要權限驗證

## 測試建議

### 單元測試
- 測試 audioPostProcessor 各種參數
- 測試 hash 計算正確性
- 測試 store 預留機制

### 整合測試
- 測試完整 TTS 生成流程
- 測試 v2_loud 後處理流程
- 測試重新處理 API
- 測試 Audio session 切換
- 測試 Audio focus 處理

### 實機測試
- iOS Safari 自動播放測試
- Android Chrome 播放測試
- 音量設定測試
- 錄音模式切換測試
- Audio focus 變更測試
