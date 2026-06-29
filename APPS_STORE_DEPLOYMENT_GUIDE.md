# App Store 與 Google Play 上架測試指南

## 目錄
1. [Capacitor 同步指令](#capacitor-同步指令)
2. [iOS 設定](#ios-設定)
3. [Android 設定](#android-設定)
4. [RevenueCat 設定](#revenuecat-設定)
5. [App Store Connect 設定](#app-store-connect-設定)
6. [Google Play Console 設定](#google-play-console-設定)
7. [測試步驟](#測試步驟)
8. [App Review Notes 範本](#app-review-notes-範本)

---

## Capacitor 同步指令

```bash
# 每次前端 build 後執行
npm run build
npx cap sync ios
npx cap sync android

# 開啟原生專案
npx cap open ios    # 開啟 Xcode
npx cap open android # 開啟 Android Studio
```

---

## iOS 設定

### Xcode 簽署設定

1. 開啟 Xcode 專案：`npx cap open ios`
2. 選擇專案 > Signing & Capabilities
3. 設定 Team：選擇你的開發者帳號
4. Bundle Identifier：`com.mobileenglish.app`
5. 設定 Provisioning Profile：自動管理或手動選擇

### Info.plist 麥克風權限

在 `ios/App/App/Info.plist` 加入：

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Mobile English 需要使用麥克風，讓你進行語言口說練習與語音辨識。</string>
```

### Sign in with Apple

1. 在 Apple Developer Console 建立 App ID
2. 啟用 Sign in with Apple
3. 在 Xcode > Signing & Capabilities 加入 "Sign in with Apple"

---

## Android 設定

### Keystore 設定

```bash
# 生成 keystore
keytool -genkey -v -keystore mobile-english.keystore -alias mobile-english-keyalg RSA -keysize 2048 -validity 10000

# 將 keystore 放在 android/app/ 目錄
```

在 `android/app/build.gradle` 設定：

```gradle
android {
    signingConfigs {
        release {
            storeFile file('mobile-english.keystore')
            storePassword 'YOUR_STORE_PASSWORD'
            keyAlias 'mobile-english'
            keyPassword 'YOUR_KEY_PASSWORD'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

### AndroidManifest.xml 麥克風權限

在 `android/app/src/main/AndroidManifest.xml` 加入：

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

---

## RevenueCat 設定

### 1. 建立 RevenueCat 專案

1. 登入 [RevenueCat Dashboard](https://app.revenuecat.com/)
2. 建立新專案：Mobile English
3. 複製 Public API Key 到環境變數 `NEXT_PUBLIC_REVENUECAT_PUBLIC_API_KEY`

### 2. iOS Products

在 RevenueCat Dashboard > iOS > Products 建立：

- **Product ID**: `mobileenglish_monthly_399`
  - Type: Subscription
  - Price: NT$399
  - Duration: 1 Month

- **Product ID**: `mobileenglish_yearly_2199`
  - Type: Subscription
  - Price: NT$2,199
  - Duration: 1 Year

### 3. Android Products

在 RevenueCat Dashboard > Android > Products 建立：

- **Product ID**: `mobileenglish_monthly_399`
  - Type: Subscription
  - Price: NT$399
  - Duration: 1 Month

- **Product ID**: `mobileenglish_yearly_2199`
  - Type: Subscription
  - Price: NT$2,199
  - Duration: 1 Year

### 4. Entitlements

建立 entitlement：`mobile_english_premium`

將所有 products 映射到此 entitlement。

### 5. Offerings

建立 offering：`default`

加入 packages：
- Monthly: `mobileenglish_monthly_399`
- Yearly: `mobileenglish_yearly_2199`

### 6. Webhook 設定

1. 在 RevenueCat Dashboard > Webhooks 新建
2. URL: `https://nobile-english.vercel.app/api/subscriptions/webhook/revenuecat`
3. Secret: 設定並複製到環境變數 `REVENUECAT_WEBHOOK_SECRET`
4. 選擇事件：INITIAL_PURCHASE, RENEWAL, EXPIRATION, CANCELLATION, REFUND

---

## App Store Connect 設定

### 1. 建立 App

1. 登入 [App Store Connect](https://appstoreconnect.apple.com/)
2. Apps > + > New App
3. Platform: iOS
4. Name: Mobile English
5. Bundle ID: `com.mobileenglish.app`
6. SKU: `mobileenglish`

### 2. 建立訂閱群組

1. App Store Connect > Subscriptions > Subscription Groups
2. 建立群組：Mobile English Premium
3. Reference Name: Mobile English Premium

### 3. 建立訂閱產品

**月費訂閱**：
- Product ID: `mobileenglish_monthly_399`
- Subscription Group: Mobile English Premium
- Name: 月費訂閱
- Description: 每月自動續訂
- Price: NT$399
- Duration: 1 Month

**年費訂閱**：
- Product ID: `mobileenglish_yearly_2199`
- Subscription Group: Mobile English Premium
- Name: 年費訂閱
- Description: 每年自動續訂
- Price: NT$2,199
- Duration: 1 Year

### 4. 建立首年優惠

1. 在年費訂閱下建立 Offer
2. Type: Promotional Offer
3. Price: NT$1,290
4. Duration: 1 Year
5. Offer Type: Free Trial 或 Promotional Price

### 5. 上傳版本

1. Xcode > Product > Archive
2. 選擇 archive > Distribute App
3. 選擇 App Store Connect
4. 上傳並等待處理

### 6. 建立測試帳號

1. App Store Connect > Users and Roles > Sandbox Testers
2. 建立測試帳號用於 TestFlight 測試

---

## Google Play Console 設定

### 1. 建立應用程式

1. 登入 [Google Play Console](https://play.google.com/console)
2. 建立新應用程式
3. App name: Mobile English
4. Package name: `com.mobileenglish.app`

### 2. 建立訂閱

**月費訂閱**：
- Product ID: `mobileenglish_monthly_399`
- Name: 月費訂閱
- Description: 每月自動續訂
- Price: NT$399
- Billing period: 1 Month

**年費訂閱**：
- Product ID: `mobileenglish_yearly_2199`
- Name: 年費訂閱
- Description: 每年自動續訂
- Price: NT$2,199
- Billing period: 1 Year

### 3. 建立首年優惠

1. 在年費訂閱下建立 Offer
2. Type: Introductory Price
3. Price: NT$1,290
4. Duration: 1 Year
5. Eligibility: New subscribers only

### 4. 上傳 AAB

1. Android Studio > Build > Generate Signed Bundle / APK
2. 選擇 Bundle
3. 使用 keystore 簽署
4. 上傳到 Google Play Console

### 5. 設定測試群組

1. Internal Testing: 加入測試人員
2. Closed Testing: 建立測試群組
3. Open Testing: 公開測試（可選）

---

## 測試步驟

### iOS 測試

1. **Sandbox 購買測試**
   - 使用 TestFlight 測試帳號
   - 測試月費訂閱購買
   - 測試年費訂閱購買
   - 測試首年優惠

2. **TestFlight 訂閱測試**
   - 邀請測試人員
   - 測試購買流程
   - 測試取消訂閱
   - 測試恢復購買

3. **麥克風權限測試**
   - 首次開啟 App 檢查權限請求
   - 拒絕權限後功能處理
   - 允許權限後錄音功能

4. **帳號刪除測試**
   - 測試刪除流程
   - 確認資料刪除
   - 測試重新註冊

### Android 測試

1. **Internal Testing 訂閱測試**
   - 加入 Internal Testing 群組
   - 測試月費訂閱購買
   - 測試年費訂閱購買
   - 測試首年優惠

2. **購買場景測試**
   - 購買成功
   - 購買失敗（網路錯誤）
   - 取消訂閱
   - 恢復購買
   - 續訂
   - 退款
   - 過期

3. **麥克風權限測試**
   - 首次開啟 App 檢查權限請求
   - 拒絕權限後功能處理
   - 允許權限後錄音功能

4. **帳號刪除測試**
   - 測試刪除流程
   - 確認資料刪除
   - 測試重新註冊

---

## App Review Notes 範本

### iOS App Review Notes

```
測試帳號：
Email: test@example.com
Password: Test1234!

測試步驟：
1. 使用測試帳號登入
2. 完成新手引導
3. 選擇一個對話場景進行練習
4. 測試麥克風錄音功能
5. 測試 AI 導師回覆
6. 測試訂閱購買流程（使用 Sandbox）
7. 測試設定頁面功能
8. 測試帳號刪除功能

功能說明：
- 本 App 是語言學習應用程式，提供對話練習、單字複習等功能
- 使用麥克風進行語音輸入練習
- AI 導師提供即時回饋
- 訂閱功能解鎖進階內容
- 完整的隱私權政策與帳號刪除功能

測試環境：
- iOS 17.0+
- iPhone 12 或更新機型
```

### Google Play Data Safety

**蒐集的資料類型**：
- Account information (email, name)
- App interactions (learning progress, dialogue records)
- Audio (voice recordings for speech recognition - deleted after processing)
- Purchase history (subscription data)

**資料用途**：
- 帳號管理與認證
- 學習進度追蹤
- 語音辨識與回饋
- 訂閱管理

**資料分享**：
- Supabase (資料庫與認證)
- OpenAI (AI 對話)
- Google Cloud (語音辨識)
- RevenueCat (訂閱管理)

**資料加密**：
- 傳輸中加密 (HTTPS)
- 靜態加密 (Supabase 加密)

**帳號刪除方式**：
- App 內：設定 > 刪除帳號
- 公開網站：https://nobile-english.vercel.app/delete-account

**隱私權政策 URL**：
https://nobile-english.vercel.app/privacy

---

## 常見問題

### Q: Capacitor sync 失敗？
A: 確保先執行 `npm run build`，然後再執行 `npx cap sync`。

### Q: iOS 構建失敗？
A: 檢查 Xcode 版本與 iOS SDK 版本，確保 provisioning profile 正確。

### Q: Android 構建失敗？
A: 檢查 keystore 設定，確保 build.gradle 中 signing configs 正確。

### Q: RevenueCat webhook 不觸發？
A: 檢查 webhook URL 是否正確，secret 是否設定，以及 Vercel 環境變數是否配置。

### Q: 測試購買失敗？
A: iOS 使用 Sandbox 測試帳號，Android 使用 Internal Testing 群組。

---

## 環境變數設定

### Vercel 環境變數

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_REVENUECAT_PUBLIC_API_KEY=your_revenuecat_public_key
REVENUECAT_WEBHOOK_SECRET=your_webhook_secret
OPENAI_API_KEY=your_openai_key
```

### 本地開發環境變數 (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_REVENUECAT_PUBLIC_API_KEY=your_revenuecat_public_key
REVENUECAT_WEBHOOK_SECRET=your_webhook_secret
OPENAI_API_KEY=your_openai_key
```
