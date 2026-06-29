# 每日五語閱讀文章功能交付文件

## 概述

完成每日五語閱讀文章功能的後端基礎設施與前端使用者介面實作。

## 完成項目

### 1. 資料庫架構

**Supabase Migration SQL** (`supabase/migrations/20240629_daily_reading_articles.sql`)
- `reading_article_topics` - 文章主題表
- `reading_articles` - 文章表
- `reading_article_sentences` - 文章句子表
- `reading_article_lexeme_links` - 文章詞形連結表
- `reading_article_audio_assets` - 文章音檔資產表
- `reading_article_questions` - 文章問題表
- `reading_article_progress` - 文章閱讀進度表
- `reading_article_rewards` - 文章獎勵表
- `daily_article_generation_log` - 每日文章生成成本記錄表
- 完整的 RLS 政策與索引

**SQLite 離線 Schema** (`src/db/sqlite-reading-articles-schema.ts`)
- `cached_reading_articles` - 快取文章表
- `cached_reading_article_sentences` - 快取文章句子表
- `cached_reading_article_lexeme_links` - 快取文章詞形連結表
- `cached_reading_article_questions` - 快取文章問題表
- `cached_reading_article_audio_manifest` - 快取文章音檔 manifest 表
- `cached_reading_article_progress` - 快取文章閱讀進度表

### 2. TypeScript 型別定義

**新增型別** (`src/types/index.ts`)
- `ArticleSource`, `ArticleStatus`, `TopicStatus`, `SentenceType`, `ArticleQuestionType`, `AudioAssetStatus`, `RewardType`
- `ReadingArticleTopic`, `ReadingArticle`, `ReadingArticleSentence`, `ReadingArticleLexemeLink`
- `ReadingArticleAudioAsset`, `ReadingArticleQuestion`, `ReadingArticleProgress`, `ReadingArticleReward`
- `DailyArticleGenerationLog`
- `GeminiArticleResponse`
- `CachedReadingArticle`, `CachedReadingArticleSentence`, `CachedReadingArticleLexemeLink`
- `CachedReadingArticleQuestion`, `CachedReadingArticleAudioManifest`, `CachedReadingArticleProgress`

### 3. 文章生成服務

**Gemini 文章生成服務** (`src/services/articleGenerationService.ts`)
- 支援五種語言（英文、日文、韓文、義大利文、西班牙文）
- 自動生成文章標題、內容、句子、關鍵詞彙、問題
- 包含完整的 prompt 與 schema 驗證
- 提供 mock 回應用於測試

**文章生成 API** (`src/app/api/articles/generate/route.ts`)
- POST `/api/articles/generate`
- 接收主題、語言、難度等參數
- 呼叫 Gemini 生成五種語言文章
- 建立文章、句子、問題記錄
- 記錄生成成本

### 4. 文章預存流程

**文章預存 API** (`src/app/api/articles/prewarm/route.ts`)
- POST `/api/articles/prewarm`
- 提取片語與單字
- 建立 `reading_article_lexeme_links`
- 預熱單字卡與片語卡
- 預生成文章句子語音
- 使用既有 TTS get-or-cache 機制

**文章發布 API** (`src/app/api/articles/publish/route.ts`)
- POST `/api/articles/publish`
- 驗證所有語言版本都已 ready
- 驗證所有音檔都已 ready
- 更新 topic 狀態為 published
- 更新所有文章狀態為 published
- 建立獎勵記錄

### 5. 每日文章 Cron Job

**Cron Job Script** (`scripts/daily-article-cron.ts`)
- 自動生成明日文章
- 輪流使用預設主題
- 呼叫生成、預存、發布流程
- 可部署到 Vercel Cron Jobs

### 6. 使用者閱讀頁面

**每日文章閱讀頁面** (`src/app/reading/page.tsx`)
- 今日文章 API 整合
- 逐句顯示與高亮
- 播放控制（播放、暫停、停止、上一句、下一句）
- 播放速度調整（0.75x、0.9x、1.0x、1.15x、1.25x）
- 自動捲動開關
- 繁中輔助顯示開關
- 收藏功能
- 完成閱讀功能
- 單字點擊整合 WordSheet

**今日文章 API** (`src/app/api/articles/today/route.ts`)
- GET `/api/articles/today?language=en`
- 取得今日已發布的文章
- 包含句子與音檔 URL

### 7. Audio Queue 與播放控制

**Audio Queue Service 增強** (`src/services/audioQueueService.ts`)
- 新增 `playbackRate` 狀態
- 新增 `setPlaybackRate()` 方法
- 新增 `getPlaybackRate()` 方法
- 即時應用播放速度調整

### 8. 單字卡系統整合

**閱讀頁面單字點擊**
- 整合既有 WordSheet 組件
- 點擊單字開啟單字卡
- 片語優先顯示
- 使用既有 global TTS cache

### 9. 農場獎勵系統整合

**文章完成獎勵 API** (`src/app/api/articles/complete/route.ts`)
- POST `/api/articles/complete`
- 記錄閱讀進度
- 發放農場獎勵（金幣、種子、水滴）
- 防止重複領取
- 記錄學習活動

### 10. 離線下載與同步

**離線文章服務** (`src/services/offlineArticleService.ts`)
- SQLite 資料庫初始化
- 文章內容離線快取
- 音檔 manifest 下載
- 單字卡與片語卡快取
- 閱讀進度同步
- 過期快取清理
- 離線狀態檢查

### 11. 訂閱權限控制

**訂閱服務增強** (`src/services/subscriptionService.ts`)
- `canReadFullArticle()` - 檢查是否可閱讀完整文章
- `canPlayFullAudio()` - 檢查是否可播放全文語音
- `canAdjustPlaybackSpeed()` - 檢查是否可調整播放速度
- `canUseFullWordCards()` - 檢查是否可使用完整單字卡
- `canCompleteQuiz()` - 檢查是否可完成閱讀複習
- `canClaimFullRewards()` - 檢查是否可領取完整獎勵
- `canDownloadOffline()` - 檢查是否可離線下載
- `canBookmarkArticle()` - 檢查是否可收藏文章
- `getFreeTierLimits()` - 取得免費版限制

### 12. 成本記錄與管理

**成本記錄 API** (`src/app/api/admin/costs/route.ts`)
- GET `/api/admin/costs?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- 取得每日文章生成成本記錄
- 計算統計資料（總字元數、總成本、cache hit/miss）
- 按語言分組統計

## 核心設計原則

### Generate Once, Validate Once, Prewarm Once, Publish Once, Reuse For All Users
- 文章內容全站共用
- 不依使用者個別生成
- 不每次播放重新生成 TTS
- 不每次點擊單字重新呼叫 Gemini

### 使用既有 TTS 系統
- 使用既有 `tts_audio_assets` 表
- 使用既有 `voice_profiles`
- 使用既有 get-or-create TTS cache
- 使用既有 Audio Queue
- 不建立重複的 TTS 系統

### 成本保護
- 記錄每日生成成本
- 追蹤 TTS cache hit/miss
- 追蹤單字音檔 cache miss
- 提供管理者成本頁面

## 待完成項目

### 1. 實機測試
- iOS Safari 測試
- Android Chrome 測試
- Web 測試
- Capacitor iOS/Android 測試

### 2. 管理者頁面
- 文章建立、預覽、編輯、發布頁面
- 成本記錄頁面

### 3. Gemini API 整合
- 實作實際的 Gemini API 呼叫
- 實作 Search Grounding（如需要）

### 4. SQLite 實際整合
- 安裝 better-sqlite3 或類似套件
- 實作實際的 SQLite 操作

### 5. NLP 片語提取
- 實作更複雜的片語提取邏輯
- 整合既有片語庫進行匹配

## 檔案清單

### 新增檔案
- `supabase/migrations/20240629_daily_reading_articles.sql`
- `src/db/sqlite-reading-articles-schema.ts`
- `src/services/articleGenerationService.ts`
- `src/app/api/articles/generate/route.ts`
- `src/app/api/articles/prewarm/route.ts`
- `src/app/api/articles/publish/route.ts`
- `src/app/api/articles/today/route.ts`
- `src/app/api/articles/complete/route.ts`
- `src/app/api/admin/costs/route.ts`
- `src/app/reading/page.tsx`
- `src/services/offlineArticleService.ts`
- `scripts/daily-article-cron.ts`

### 修改檔案
- `src/types/index.ts` - 新增閱讀文章相關型別
- `src/services/audioQueueService.ts` - 新增播放速度控制
- `src/services/subscriptionService.ts` - 新增文章權限控制

## 測試建議

### 單元測試
- 測試文章生成服務
- 測試預存流程
- 測試離線服務
- 測試權限控制

### 整合測試
- 測試完整文章生成流程
- 測試閱讀頁面播放
- 測試單字點擊
- 測試獎勵發放

### 實機測試
- iOS Safari 自動播放測試
- Android Chrome 播放測試
- 離線模式測試
- 權限控制測試

## 部署建議

### Vercel Cron Jobs
```json
{
  "crons": [
    {
      "path": "/api/articles/cron",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### 環境變數
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`（待設定）
- `NEXT_PUBLIC_APP_URL`

## 注意事項

1. **Gemini API** - 目前使用 mock 回應，需要實際整合 Gemini API
2. **SQLite** - 目前 SQLite 操作為 mock，需要實際整合 SQLite 套件
3. **片語提取** - 目前為簡單實作，需要更複雜的 NLP 邏輯
4. **權限驗證** - 需要在前端實際應用權限控制
5. **錯誤處理** - 需要更完善的錯誤處理與使用者提示
