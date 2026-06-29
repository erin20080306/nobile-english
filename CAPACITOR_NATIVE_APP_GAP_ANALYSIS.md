# Mobile English — Capacitor 原生 App 上架差距分析

## 當前專案狀態（2026-06-29）

### 已有
- Next.js 14.2.5 React Web App
- TypeScript
- TailwindCSS
- 本機 localStorage 認證（Email/Password + Google demo）
- 瀏覽器 Web Speech API（TTS fallback + STT）
- OpenAI TTS API（`/api/tts`）
- Supabase migration 檔（TTS cache schema，尚未實際連線）
- Vercel 部署（無 vercel.json，使用預設配置）

### 缺失（對應你的 23 點規格）

---

## 十八、Capacitor 原生打包

### 缺失項目
- **Capacitor 依賴**：`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`
- **capacitor.config.ts**：appId, appName, webDir, server 配置
- **ios/android 原生專案**：尚未初始化
- **App Icon / Splash Screen**：未準備
- **深色模式 icon / Android adaptive icon**：未準備
- **npm scripts**：`cap sync`, `cap open ios`, `cap open android`
- **Vercel 環境變數保護**：需確保不進入原生 bundle（目前用 server-only env，已符合）

### 建議 App ID
- iOS bundleId: `com.mobileenglish.app`
- Android applicationId: `com.mobileenglish.app`
- **需先確認是否已被使用**（App Store Connect / Google Play Console 查詢）

### 行動項目
1. 安裝 Capacitor 套件
2. 建立 `capacitor.config.ts`
3. 初始化 ios/android 專案
4. 準備 icon/splash assets
5. 在 `package.json` 加入 sync 腳本
6. 每次 build 後執行 `npx cap sync`

---

## 十九、原生麥克風與音訊處理

### 當前狀態
- 僅使用瀏覽器 `getUserMedia` + Web Speech API
- 無原生音訊處理（無 AEC、降噪、AGC）
- 無錄音與播放互斥控制
- 無 AVAudioSession / Audio Focus 處理

### 缺失項目
- **Capacitor 原生 plugin**：需選擇方案（例如 `@capacitor-community/audio-recorder` 或自寫原生 module）
- **iOS Info.plist**：`NSMicrophoneUsageDescription`
- **Android AndroidManifest.xml**：`RECORD_AUDIO` 權限
- **原生音訊處理**：
  - 回音消除（AEC）
  - 降噪
  - 自動增益控制（AGC）
- **播放與錄音互斥**：
  - 錄音時停止導師播放
  - 導師播放結束後延遲 300ms 才可錄音
  - 音檔播放與錄音不可重疊
- **iOS AVAudioSession**：正確切換播放/錄音模式
- **Android Audio Focus**：處理 `AcousticEchoCanceler`, `NoiseSuppressor`
- **錄音檔上傳**：multipart/form-data → 後端
- **錄音檔刪除**：辨識完成後立即刪除

### 行動項目
1. 選擇 Capacitor 麥克風/錄音 plugin
2. 加入 iOS/Android 權限配置
3. 實作原生音訊處理邏輯
4. 重構 `speechService.listen()` 改用原生 plugin
5. 實作播放/錄音互斥狀態機
6. 建立錄音上傳 API（`POST /api/speech/upload`）
7. 實作錄音檔清理邏輯

---

## 二十、App 內訂閱與付款（RevenueCat）

### 當前狀態
- 無訂閱功能
- 無 RevenueCat SDK
- User 型別無訂閱欄位
- 無訂閱頁面

### 缺失項目
- **RevenueCat Capacitor SDK**：`@revenuecat/purchases-capacitor`
- **SubscriptionProvider abstraction**：需建立介面與實作
- **Supabase schema 擴充**：
  - `subscription_platform`
  - `subscription_status`
  - `subscription_product_id`
  - `subscription_expires_at`
  - `subscription_entitlement`
  - `revenuecat_app_user_id`
  - `updated_at`
- **RevenueCat 配置**：
  - public SDK key（可存於 App bundle）
  - products: `mobileenglish_monthly_399`, `mobileenglish_yearly_2199`
  - offering: `mobile_english_premium`
- **後端 API**：
  - `POST /api/subscriptions/webhook/revenuecat`
  - `GET /api/subscriptions/status`
  - `POST /api/subscriptions/sync`
- **訂閱頁面**：
  - 月費 NT$399
  - 首年年費 NT$1,290（顯示「首年 NT$1,290，之後每年 NT$2,199 自動續訂」）
  - 恢復購買按鈕
  - 管理訂閱按鈕
  - 錯誤處理（購買失敗、網路失敗、過期、取消）
- **跨裝置恢復**：App 重新安裝後恢復權限
- **後端驗證**：不可只信前端，需透過 RevenueCat webhook / Store 驗證

### 行動項目
1. 安裝 RevenueCat SDK
2. 建立 Supabase migration（訂閱欄位）
3. 實作 SubscriptionProvider
4. 建立訂閱頁面 UI
5. 實作後端 webhook/sync API
6. RevenueCat Console 配置（products, offering, entitlement, webhook）
7. 測試購買/恢復/續訂/取消流程

---

## 二十一、App Store / Google Play 隱私與帳號刪除

### 當前狀態
- 無隱私權政策頁面
- 無帳號刪除功能
- 無 `/delete-account` 公開路由
- User 型別無刪除相關欄位
- Settings 頁面無隱私/刪除選項

### 缺失項目
- **App 內設定頁面擴充**：
  - 訂閱與付款
  - 恢復購買
  - 管理訂閱
  - 隱私權政策
  - AI 與語音資料說明
  - 刪除學習紀錄
  - 刪除帳號
  - 支援與聯絡方式
- **App 內帳號刪除流程**：
  - 設定 > 帳號 > 刪除帳號
  - 兩次確認
  - 刪除/匿名化：profiles, conversation records, speech transcripts, vocabulary progress, saved cards, user preferences, learning history
  - 原始錄音刪除
  - 訂閱交易紀錄保留（法律/會計必要）
- **公開刪除連結**：`/delete-account` 路由
- **Privacy Policy 頁面**：
  - 蒐集資料類型
  - 麥克風用途
  - 原始錄音處理與刪除
  - 語音辨識文字保存
  - 第三方服務（OpenAI, Gemini, Google Cloud, RevenueCat, Supabase）
  - 訂閱資料處理
  - 帳號刪除方式
  - 撤回麥克風權限
  - 聯絡方式
- **Google Play Data Safety 準備**：
  - account information
  - microphone / audio
  - app interactions
  - purchase history
  - transcripts / user content
  - third-party SDK data practices
  - encryption in transit
  - account deletion method
  - privacy policy URL

### 行動項目
1. 建立 Privacy Policy 頁面（`/privacy`）
2. 建立 AI 與語音資料說明頁面
3. 實作 App 內刪除學習紀錄功能
4. 實作 App 內刪除帳號功能（兩次確認）
5. 建立公開 `/delete-account` 路由
6. Supabase schema 加入軟刪除欄位（deleted_at）
7. 準備 Google Play Data Safety 文件

---

## 二十二、登入規則（Sign in with Apple）

### 當前狀態
- 僅有 Email/Password 本機登入
- Google 登入僅為 demo（非真實 OAuth）
- 無 Sign in with Apple
- 無 Supabase Auth 整合

### 缺失項目
- **Sign in with Apple**（iOS 必需）：
  - Capacitor plugin：`@capacitor-community/apple-sign-in`
  - Supabase Auth 整合
  - 可建立並登入同一 Mobile English 帳號
- **真實 Google OAuth**（若要正式使用）：
  - Supabase Auth Google provider
  - 與 Apple Sign in 共用同一帳號
- **Supabase Auth 整合**：
  - 取代本機 localStorage 認證
  - 跨裝置同步
  - RevenueCat appUserID 使用 Supabase Auth user id

### 行動項目
1. 安裝 Sign in with Apple plugin
2. 設定 Supabase Auth（Apple + Google providers）
3. 重構 authService 改用 Supabase Auth
4. 確保 Apple/Google 登入對應同一 Supabase user
5. 測試跨裝置登入同步

---

## 二十三、上架測試與產物

### 當前狀態
- 無 iOS Xcode 專案
- 無 Android Studio 專案
- 無簽署配置
- 無 TestFlight / Play Console 配置
- 無 RevenueCat Console 配置

### 缺失項目
- **iOS**：
  - Debug / TestFlight / Production 配置
  - Xcode 簽署設定
  - TestFlight 上傳步驟
  - App Store Connect IAP 設定（首年優惠）
- **Android**：
  - Debug / Internal / Closed / Production 配置
  - Keystore 設定
  - Signed AAB 建置
  - Play Console subscription base plan + offer 設定
- **RevenueCat**：
  - iOS/Android products 建立
  - offering 建立
  - entitlement 建立
  - webhook 設定
- **測試清單**：
  - iOS Sandbox 購買測試
  - TestFlight 訂閱測試
  - Google Play internal testing 訂閱測試
  - 購買成功/取消/恢復/續訂/付款失敗/退款/過期
  - 麥克風權限測試
  - 帳號刪除與資料刪除測試
  - Data Safety 與 Privacy Policy 對照
- **App Review Notes**：
  - 測試帳號
  - Reviewer 操作步驟

### 行動項目
1. 初始化 iOS Xcode 專案並設定簽署
2. 初始化 Android Studio 專案並設定 keystore
3. App Store Connect 建立 App 與 IAP
4. Google Play Console 建立 App 與 subscription
5. RevenueCat Console 建立所有配置
6. 執行完整測試清單
7. 準備 App Review Notes

---

## Vercel 與環境變數檢查

### 當前狀態
- 無 `vercel.json`（使用預設配置）
- `.env.example` 已包含部分 server-only key（Chirp3HD, Supabase, OpenAI STT, Gemini）
- 無 RevenueCat public key（可存於 App bundle，不需 server-only）

### 缺失項目
- **vercel.json**：可選，用於自定義 build/headers/redirects
- **環境變數檢查**：
  - 確保 OpenAI、Gemini、Google Cloud、Supabase Service Role 不進入原生 bundle
  - RevenueCat public key 可安全存於 App bundle

### 行動項目
1. 檢查 Vercel 環境變數配置
2. 確保所有敏感 key 僅在 server-side 使用
3. 考慮加入 `vercel.json` 以優化 build/headers

---

## 優先順序建議

### Phase 1 — Capacitor 基礎
1. 安裝 Capacitor 依賴
2. 建立 `capacitor.config.ts`
3. 初始化 ios/android 專案
4. 準備 icon/splash assets
5. 加入 `cap sync` 腳本

### Phase 2 — 原生音訊
1. 選擇並安裝 Capacitor 麥克風 plugin
2. 加入 iOS/Android 權限
3. 重構 `speechService` 使用原生 plugin
4. 實作播放/錄音互斥

### Phase 3 — RevenueCat 訂閱
1. 安裝 RevenueCat SDK
2. Supabase schema 擴充（訂閱欄位）
3. 建立 SubscriptionProvider
4. 建立訂閱頁面
5. 後端 webhook/sync API
6. RevenueCat Console 配置

### Phase 4 — 隱私與帳號刪除
1. 建立 Privacy Policy 頁面
2. App 內刪除學習紀錄/帳號功能
3. 公開 `/delete-account` 路由
4. Google Play Data Safety 文件

### Phase 5 — Sign in with Apple + Supabase Auth
1. 安裝 Apple Sign in plugin
2. Supabase Auth 配置
3. 重構 authService 改用 Supabase Auth
4. 測試跨裝置同步

### Phase 6 — 上架測試
1. iOS/Android 簽署配置
2. App Store Connect / Play Console 配置
3. RevenueCat Console 配置
4. 執行完整測試清單
5. 準備 App Review Notes

---

## 注意事項

- **不要重寫成 Swift/Kotlin**：使用 Capacitor 包裝現有 React Web App
- **不要改變既有場景/TTS cache/STT/五語單字卡/每日 20 場設計**
- **不要改成分鐘制**
- **不要在前端顯示剩餘次數**
- **不要在 App 中直接暴露 OpenAI、Gemini、Google Cloud 或 Supabase Service Role 金鑰**
- **iOS 必須有 Sign in with Apple**（若有第三方登入）
- **RevenueCat public SDK key 可存於 App bundle**，但其他金鑰必須 server-only
