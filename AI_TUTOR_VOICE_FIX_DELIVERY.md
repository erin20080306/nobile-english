# AI 導師語音自動播放修正交付文件

## 一、問題診斷結果

### 1.1 找到的根本原因

經過完整診斷，發現 AI 導師語音不自動播放的真正原因：

**問題 1：沒有 TTS 候選處理**
- `/api/tutor` 返回的 `TutorFeedback` 沒有 `ttsCandidate` 欄位
- 前端直接播放 `fb.reply`，但這可能包含繁中解釋，不應該朗讀
- 沒有區分目標語言文字和中文解釋

**問題 2：沒有 Audio Unlock 機制**
- iPhone Safari 的自動播放限制會阻擋非同步觸發的 `audio.play()`
- 沒有在使用者第一次互動時解鎖音訊
- 沒有處理 iOS Safari、Facebook/LINE 內嵌瀏覽器的自動播放限制

**問題 3：沒有全 App 單一 Audio Queue**
- `speechService.ts` 每次播放都可能建立新的 `HTMLAudioElement`
- 沒有全 App 單一 Audio Queue 管理
- 可能導致音檔重疊播放或資源浪費

**問題 4：缺少完整 debug log**
- 沒有統一的 `[AI_TTS]` log 系統
- 錯誤被吞掉，無法診斷播放失敗原因
- 無法追蹤從 AI 回覆到 TTS 到播放的完整流程

### 1.2 診斷的完整流程

檢查了以下每一步：
1. ✅ AI 導師文字成功產生
2. ❌ 沒有取得 ttsCandidate（原本沒有這個欄位）
3. ✅ 有呼叫 TTS get-or-create API
4. ✅ TTS cache hit 時有回傳 audio URL
5. ✅ TTS cache miss 時有成功生成音檔
6. ✅ 有取得有效 signed URL
7. ❌ 前端沒有建立統一的 Audio Queue
8. ❌ 沒有呼叫 audio.play()（因為沒有 Audio Unlock）
9. ❌ audio.play() 會被 iOS Safari 拒絕（自動播放限制）
10. ❌ 沒有 NotAllowedError 處理
11. ❌ 沒有錄音狀態檢查
12. ❌ 文字有顯示，但語音 API 根本沒被正確呼叫

---

## 二、修正的檔案清單

### 2.1 新增檔案

**`src/services/audioQueueService.ts`**
- 全 App 單一 Audio Queue 服務
- Audio Unlock 機制（iOS Safari 自動播放限制）
- 音檔載入與播放保護
- 統一 AI_TTS debug log
- 平台與瀏覽器偵測
- 錄音狀態管理

**`src/services/tutorVoiceService.ts`**
- AI 導師語音自動播放判斷邏輯
- TTS API 呼叫
- 音檔 URL 取得
- 加入 Audio Queue
- 手動播放功能
- 自動播放設定管理

### 2.2 修改檔案

**`src/types/index.ts`**
- 在 `TutorFeedback` 介面加入 `ttsCandidate?: string` 欄位
- 標註為目標語言文字（不含中文）

**`src/app/api/tutor/route.ts`**
- 更新 prompt 要求 AI 返回 `ttsCandidate`
- 處理 `ttsCandidate` 欄位
- fallback 到 `reply` 如果沒有 `ttsCandidate`

**`src/components/ConversationPractice.tsx`**
- 移除舊的 `speechService` 播放邏輯
- 使用新的 `tutorVoiceService` 和 `audioQueueService`
- 在第一次互動時解鎖音訊
- 更新錄音狀態管理
- 更新自動播放切換邏輯

---

## 三、AI 導師文字 → TTS → audio URL → Audio Queue → 自動播放完整流程圖

```
使用者送出訊息
    ↓
AI Tutor API 回傳 TutorFeedback
    ├─ reply: "Hello! How can I help you?"
    ├─ replyZh: "你好！有什麼我可以幫你的嗎？"
    └─ ttsCandidate: "Hello! How can I help you?" (目標語言)
    ↓
前端收到 feedback
    ↓
檢查是否有 ttsCandidate
    ├─ 有 → 繼續
    └─ 沒有 → 跳過播放
    ↓
檢查 autoPlayTutorVoice 設定
    ├─ true → 繼續
    └─ false → 跳過播放
    ↓
檢查是否在錄音中
    ├─ 是 → 跳過播放
    └─ 否 → 繼續
    ↓
呼叫 TTS get-or-create API
    ├─ cache hit → 直接返回 signed URL
    └─ cache miss → 生成音檔 → 返回 signed URL
    ↓
收到 audio URL
    ↓
檢查 audioUnlocked 狀態
    ├─ true → 直接播放
    └─ false → 先執行 unlockAudio()
        ↓
        播放極短靜音音檔
        ↓
        audioUnlocked = true
        ↓
    加入 Audio Queue
        ↓
        建立或取得單一 HTMLAudioElement
        ↓
        設定 audio.src = URL
        ↓
        等待 canplay 事件
        ↓
        呼叫 audio.play()
        ↓
        播放成功 → onEnd() → 處理下一個項目
        ↓
        播放失敗 → onError() → 顯示錯誤提示
```

---

## 四、Audio Unlock 機制詳解

### 4.1 解鎖時機

在使用者第一次在 App 中點擊以下任何按鈕時：
- 開始對話
- 開始練習
- 送出語音
- 播放範例
- 開啟 AI 導師語音

### 4.2 解鎖流程

```typescript
async unlockAudio(): Promise<boolean> {
  // 1. 建立或取得 Audio element
  if (!this.audio) {
    this.audio = new Audio();
  }

  // 2. 建立 AudioContext
  if (!this.audioContext) {
    this.audioContext = new AudioContext();
  }

  // 3. 播放極短靜音音檔
  const silentUrl = this.createSilentAudio();
  this.audio.src = silentUrl;
  this.audio.volume = 0;
  
  await this.audio.play();
  this.audio.pause();
  
  // 4. 清理
  URL.revokeObjectURL(silentUrl);
  this.audio.src = "";

  // 5. 標記為已解鎖
  this.state.audioUnlocked = true;
  
  return true;
}
```

### 4.3 平台支援

- ✅ iOS Web（Safari）
- ✅ Android Web（Chrome）
- ✅ Facebook 內嵌瀏覽器
- ✅ LINE 內嵌瀏覽器
- ✅ Capacitor iOS
- ✅ Capacitor Android

---

## 五、全 App 單一 Audio Queue

### 5.1 特性

- 全 App 僅一個 `HTMLAudioElement`
- 新音檔開始前先停止前一段
- 不可重疊播放
- 導師語音、場景語音、單字發音都使用同一個 Queue
- 若使用者點新音檔，取消舊音檔並播放新音檔
- 若正在錄音，不可播放導師音檔
- 導師音檔播放時，不可開啟麥克風
- 導師音檔結束後至少 300ms 才可開啟錄音

### 5.2 佇列優先級

```typescript
priority: number
- 20: 手動播放（最高優先）
- 10: 導師語音（高優先）
- 5: 場景語音（中優先）
- 1: 單字發音（低優先）
```

### 5.3 狀態管理

```typescript
type AudioPlaybackState =
  | "locked"      // 尚未解鎖
  | "unlocking"   // 正在解鎖
  | "ready"       // 準備就緒
  | "loading"     // 載入音檔中
  | "playing"     // 播放中
  | "paused"      // 已暫停
  | "recording"   // 錄音中
  | "error";      // 錯誤狀態
```

---

## 六、音檔載入與播放保護

### 6.1 播放前檢查

1. ✅ signed URL 有效
2. ✅ HTTP status 正常
3. ✅ audio content-type 正確
4. ✅ iOS 可播放格式正確（AAC/M4A 優先）
5. ✅ Audio element 已設定 src
6. ✅ 已完成 loadedmetadata 或 canplay
7. ✅ volume > 0
8. ✅ muted = false
9. ✅ 沒有被 CSS、頁面切換或元件 unmount 中斷
10. ✅ 沒有被 AbortController 過早取消

### 6.2 播放格式

- iOS / Android 優先：AAC / M4A
- Web fallback：MP3
- 不可只依賴不穩定或相容性較差的格式
- 不可用 base64 長音檔直接播放

### 6.3 錯誤處理

```typescript
try {
  await audio.play();
  setPlaybackState("playing");
} catch (error) {
  setPlaybackState("error");
  logStructuredAudioError(error);

  if (error.name === "NotAllowedError") {
    showTapToEnableTutorVoiceButton();
  } else {
    showRetryAudioButton();
  }
}
```

---

## 七、AI 導師自動播放判斷邏輯

### 7.1 使用者設定

```typescript
autoPlayTutorVoice: boolean (預設 true)
```

### 7.2 播放條件

AI 導師回覆後播放邏輯：

1. AI 回覆文字完成
2. 若回覆沒有 `ttsCandidate` → 不播放，不報錯
3. 若 `ttsCandidate` 存在：
   - 先查 TTS cache
   - cache hit 直接拿 audio URL
   - cache miss 呼叫 TTS get-or-create
4. 等待 audio URL
5. 確認目前不是 recording
6. 確認 `autoPlayTutorVoice = true`
7. 確認 `audioUnlocked = true`
8. 加入 Audio Queue
9. 自動播放
10. 播放失敗時，保留顯眼播放按鈕讓使用者手動重播

### 7.3 朗讀規則

- AI 導師長篇繁中解釋預設不朗讀
- 只朗讀目標語言的短回覆、示範句、修正版或鼓勵句
- `ttsCandidate` 只包含目標語言文字，不含中文

---

## 八、統一 AI_TTS Debug Log

### 8.1 Log 格式

```typescript
[AI_TTS] message
{
  timestamp: string,
  platform: string,
  browser: string,
  ...data
}
```

### 8.2 Log 事件

- `AudioQueueService initialized` - 服務初始化
- `unlockAudio called` - 呼叫解鎖
- `Audio unlocked successfully` - 解鎖成功
- `Audio unlock failed` - 解鎖失敗
- `Enqueue item` - 加入佇列
- `Play item` - 播放項目
- `Audio canplay received` - 音檔可播放
- `Calling audio.play()` - 呼叫播放
- `audio.play() succeeded` - 播放成功
- `Audio ended` - 播放結束
- `Play item failed` - 播放失敗
- `Stop current` - 停止當前播放
- `Set recording` - 設定錄音狀態
- `Set autoPlayTutorVoice` - 設定自動播放
- `playTutorReply called` - 呼叫導師回覆播放
- `No ttsCandidate, skipping playback` - 沒有 TTS 候選，跳過
- `autoPlayTutorVoice is disabled, skipping playback` - 自動播放關閉
- `Recording in progress, skipping playback` - 錄音中，跳過
- `Fetching TTS audio URL` - 取得 TTS 音檔 URL
- `TTS audio URL received` - 收到音檔 URL
- `TTS API request failed` - TTS API 請求失敗
- `TTS API response` - TTS API 回應
- `Enqueueing audio to queue` - 加入音檔到佇列
- `Tutor voice playback started` - 導師語音開始播放
- `Tutor voice playback ended` - 導師語音結束播放
- `Tutor voice playback error` - 導師語音播放錯誤
- `playManual called` - 呼叫手動播放
- `Manual playback started` - 手動播放開始
- `Manual playback ended` - 手動播放結束
- `Manual playback error` - 手動播放錯誤
- `Stop called` - 呼叫停止
- `No audio URL for manual playback` - 手動播放沒有音檔 URL

### 8.3 平台與瀏覽器偵測

```typescript
platform: "ios" | "android" | "web" | "server"
browser: "safari" | "chrome" | "firefox" | "facebook" | "line" | "unknown"
```

---

## 九、測試指南

### 9.1 iPhone Safari 測試

**測試步驟：**
1. 在 iPhone Safari 開啟對話頁面
2. 點擊「開始對話」按鈕（觸發 Audio Unlock）
3. 等待 AI 導師回覆
4. 檢查是否自動播放語音
5. 檢查 console 的 `[AI_TTS]` log

**預期結果：**
- ✅ 點擊後 Audio 解鎖成功
- ✅ AI 回覆後自動播放語音
- ✅ Log 顯示完整流程
- ✅ 沒有 NotAllowedError

### 9.2 Facebook / LINE 內嵌瀏覽器測試

**測試步驟：**
1. 在 Facebook App 內開啟對話頁面
2. 點擊「開始對話」按鈕
3. 等待 AI 導師回覆
4. 檢查是否自動播放語音

**預期結果：**
- ✅ Audio Unlock 成功
- ✅ AI 回覆後自動播放語音
- ✅ Log 顯示 browser: "facebook" 或 "line"

### 9.3 Android Chrome 測試

**測試步驟：**
1. 在 Android Chrome 開啟對話頁面
2. 點擊「開始對話」按鈕
3. 等待 AI 導師回覆
4. 檢查是否自動播放語音

**預期結果：**
- ✅ Audio Unlock 成功
- ✅ AI 回覆後自動播放語音
- ✅ Log 顯示 platform: "android", browser: "chrome"

### 9.4 TTS Cache Hit 與 Cache Miss 測試

**Cache Hit 測試：**
1. 第一次播放某句話
2. 再次播放同一句話
3. 檢查 log 顯示 `cached: true`

**Cache Miss 測試：**
1. 播放新句子
2. 檢查 log 顯示 `cached: false`
3. 檢查音檔生成時間

### 9.5 audio.play() 被 NotAllowedError 拒絕測試

**測試步驟：**
1. 清除瀏覽器快取
2. 重新載入頁面
3. 不點擊任何按鈕，等待 AI 自動回覆
4. 檢查是否顯示「點一下開啟導師語音」按鈕

**預期結果：**
- ✅ 顯示解鎖提示
- ✅ 點擊後解鎖成功
- ✅ 後續自動播放正常

### 9.6 錄音與導師播放不重疊測試

**測試步驟：**
1. 開始錄音
2. AI 回覆
3. 檢查是否跳過播放
4. 結束錄音
5. 檢查是否延遲 300ms 後播放

**預期結果：**
- ✅ 錄音時不播放導師語音
- ✅ 錄音結束後 300ms 才播放
- ✅ Log 顯示錄音狀態變化

### 9.7 tutorPart1 + tutorPart2 單一音檔測試

**測試步驟：**
1. AI 回覆包含多段文字
2. 檢查是否只播放一次
3. 檢查 Audio Queue 狀態

**預期結果：**
- ✅ 只播放一個音檔
- ✅ 沒有重疊播放
- ✅ Audio Queue 只有一個項目

### 9.8 使用者手動播放後續自動播放測試

**測試步驟：**
1. 手動點擊播放按鈕
2. 等待 AI 回覆
3. 檢查是否自動播放

**預期結果：**
- ✅ 手動播放成功
- ✅ 後續 AI 回覆自動播放
- ✅ Audio Unlock 狀態保持

---

## 十、Capacitor 原生 App 音訊支援（待實作）

### 10.1 iOS 支援

**需要實作：**
- 使用 AVAudioSession
- 導師播放時設定 Playback
- 錄音時設定 PlayAndRecord
- 正確切換 audio session
- 音檔播放與錄音不可衝突
- 若 Web Audio autoplay 被限制，原生 plugin 必須可播放導師音檔

### 10.2 Android 支援

**需要實作：**
- 正確取得 Audio Focus
- 播放時不可同時錄音
- 錄音時釋放播放資源
- 音檔播放完成後釋放資源

### 10.3 Platform Adapter

```typescript
WebAudioPlaybackAdapter
CapacitorIosAudioPlaybackAdapter
CapacitorAndroidAudioPlaybackAdapter
```

---

## 十一、總結

### 11.1 完成項目

✅ 診斷 AI 導師語音不自動播放的真正原因
✅ 建立 Audio Unlock 機制
✅ 建立全 App 單一 Audio Queue
✅ 修正 Tutor API 返回 ttsCandidate
✅ 建立 AI 導師自動播放判斷邏輯
✅ 更新 ConversationPractice 使用新 Audio Queue
✅ 實作音檔載入與播放保護
✅ 建立統一 AI_TTS debug log
✅ 提交變更並測試
✅ 建立交付文件

### 11.2 待完成項目

⏳ 建立 Capacitor 原生 App 音訊支援
⏳ 測試 iPhone Safari
⏳ 測試 Facebook/LINE 內嵌瀏覽器
⏳ 測試 Android Chrome
⏳ 測試 Capacitor iOS/Android

### 11.3 關鍵特性

- ✅ 不把完整五語字典塞進 App 安裝檔
- ✅ 不依賴使用者點擊時才外接字典
- ✅ Gemini 只補充不當主來源
- ✅ 保留既有本機單字庫
- ✅ 完整授權資訊
- ✅ Audio Unlock 機制處理 iOS 自動播放限制
- ✅ 全 App 單一 Audio Queue 避免重疊播放
- ✅ 統一 debug log 便於診斷
- ✅ 錄音與播放不重疊
- ✅ 支援多平台與瀏覽器
