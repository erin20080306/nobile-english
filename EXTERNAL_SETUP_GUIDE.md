# 外部服務設定指南

本指南說明如何手動完成需要外部平台操作的設定項目。

---

## 1. Supabase Migration

### 步驟
1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇你的專案
3. 左側選單 > SQL Editor
4. 點擊 "New Query"
5. 複製 `supabase/migrations/0003_subscription_fields.sql` 的內容
6. 貼上到 SQL Editor
7. 點擊 "Run" 執行

### 驗證
- 在 Database > Tables 檢查 `profiles` 表是否有新欄位：
  - `subscription_platform`
  - `subscription_status`
  - `subscription_product_id`
  - `subscription_expires_at`
  - `subscription_entitlement`
  - `revenuecat_app_user_id`
  - `subscription_updated_at`

---

## 2. RevenueCat Dashboard

### 步驟
1. 登入 [RevenueCat Dashboard](https://app.revenuecat.com/)
2. 建立新專案：Mobile English
3. 複製 Public API Key（用於 Vercel 環境變數）

### iOS Products
1. Dashboard > iOS > Products > + New Product
2. **月費訂閱**：
   - Product ID: `mobileenglish_monthly_399`
   - Type: Subscription
   - Price: NT$399
   - Duration: 1 Month
3. **年費訂閱**：
   - Product ID: `mobileenglish_yearly_2199`
   - Type: Subscription
   - Price: NT$2,199
   - Duration: 1 Year

### Android Products
1. Dashboard > Android > Products > + New Product
2. 使用相同的 Product IDs 和設定

### Entitlements
1. Dashboard > Entitlements > + New Entitlement
2. Entitlement ID: `mobile_english_premium`
3. 將 iOS 和 Android 的 products 映射到此 entitlement

### Offerings
1. Dashboard > Offerings > + New Offering
2. Offering ID: `default`
3. 加入 packages：
   - Monthly: `mobileenglish_monthly_399`
   - Yearly: `mobileenglish_yearly_2199`

### Webhook
1. Dashboard > Webhooks > + New Webhook
2. URL: `https://nobile-english.vercel.app/api/subscriptions/webhook/revenuecat`
3. Secret: 設定一個隨機字串（用於 Vercel 環境變數）
4. 選擇事件：
   - INITIAL_PURCHASE
   - RENEWAL
   - EXPIRATION
   - CANCELLATION
   - REFUND

---

## 3. App Store Connect

### 步驟
1. 登入 [App Store Connect](https://appstoreconnect.apple.com/)
2. Apps > + > New App
3. **App 資訊**：
   - Platform: iOS
   - Name: Mobile English
   - Bundle ID: `com.mobileenglish.app`
   - SKU: `mobileenglish`

### 訂閱群組
1. App Store Connect > Subscriptions > Subscription Groups
2. + Create Group
3. Reference Name: Mobile English Premium

### 訂閱產品
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

### 首年優惠
1. 在年費訂閱下 > Create Offer
2. Type: Promotional Offer
3. Price: NT$1,290
4. Duration: 1 Year
5. Offer Type: Free Trial 或 Promotional Price

---

## 4. Google Play Console

### 步驟
1. 登入 [Google Play Console](https://play.google.com/console)
2. 建立新應用程式
3. **App 資訊**：
   - App name: Mobile English
   - Package name: `com.mobileenglish.app`

### 訂閱產品
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

### 首年優惠
1. 在年費訂閱下 > Create Offer
2. Type: Introductory Price
3. Price: NT$1,290
4. Duration: 1 Year
5. Eligibility: New subscribers only

---

## 5. iOS Sign in with Apple

### 步驟
1. 開啟 Xcode 專案：`npx cap open ios`
2. 選擇專案 > Signing & Capabilities
3. 點擊 "+ Capability"
4. 搜尋並加入 "Sign in with Apple"
5. 確認 Team 已設定

### 驗證
- 在 `Signing & Capabilities` 應該看到 "Sign in with Apple" 已加入

---

## 6. Vercel 環境變數

### 步驟
1. 登入 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇你的專案
3. Settings > Environment Variables
4. 新增以下變數：

**RevenueCat**：
- `NEXT_PUBLIC_REVENUECAT_PUBLIC_API_KEY`: 從 RevenueCat Dashboard 複製
- `REVENUECAT_WEBHOOK_SECRET`: 你在 RevenueCat Webhook 設定的 secret

**Apple Sign In**（可選）：
- `APPLE_SIGN_IN_CLIENT_ID`: `com.mobileenglish.app`
- `APPLE_SIGN_IN_REDIRECT_URI`: `https://nobile-english.vercel.app`

### 驗證
- 重新部署專案
- 檢查環境變數是否正確載入

---

## 7. 測試流程

### iOS 測試
1. 執行 `npx cap sync ios`
2. 開啟 Xcode：`npx cap open ios`
3. 選擇模擬器或實機
4. 點擊 Run
5. 測試：
   - 麥克風權限請求
   - Sign in with Apple
   - 訂閱購買（使用 Sandbox 測試帳號）

### Android 測試
1. 執行 `npx cap sync android`
2. 開啟 Android Studio：`npx cap open android`
3. 連接 Android 裝置或使用模擬器
4. 點擊 Run
5. 測試：
   - 麥克風權限請求
   - 訂閱購買（使用 Internal Testing）

---

## 常見問題

### Q: RevenueCat webhook 不觸發？
A: 檢查 webhook URL 是否正確，secret 是否設定，以及 Vercel 環境變數是否配置。

### Q: iOS 構建失敗？
A: 檢查 Xcode 版本與 iOS SDK 版本，確保 provisioning profile 正確。

### Q: Android 構建失敗？
A: 檢查 keystore 設定，確保 build.gradle 中 signing configs 正確。

### Q: 測試購買失敗？
A: iOS 使用 Sandbox 測試帳號，Android 使用 Internal Testing 群組。

---

## 完成檢查清單

- [ ] Supabase Migration 執行完成
- [ ] RevenueCat Dashboard 設定完成
- [ ] App Store Connect 設定完成
- [ ] Google Play Console 設定完成
- [ ] iOS Sign in with Apple 加入
- [ ] Vercel 環境變數設定完成
- [ ] iOS 測試通過
- [ ] Android 測試通過
