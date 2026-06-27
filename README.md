# 📱 Mobile English — 時尚 Q 版手機英文學習 App

手機優先（375–430px）的英文學習 PWA，使用 **Next.js App Router + TypeScript + Tailwind CSS + Framer Motion + Lucide Icons**。
**無需任何 API Key 即可預覽與使用**，所有資料以 `localStorage` 儲存，並保留未來串接 Supabase / Firebase / OpenAI / 語音 API 的 service 層。

---

## 🚀 安裝與啟動

```bash
npm install
npm run dev
```

開啟瀏覽器（建議用手機尺寸的響應式檢視）：

```
http://localhost:3000
```

production build：

```bash
npm run build
npm run start
```

---

## 🐤 加油去背圖（重要）

App 會優先讀取：

```
public/assets/cheer.png
```

請將你提供的「加油」**透明去背 PNG** 放到該路徑（**請勿加白底、勿裁切、保留透明背景**）。
若該檔案不存在，會自動使用 `public/assets/cheer-fallback.svg` 簡易替代圖（不會報錯、不會空白）。

cheer.png 會出現在：
- 練習完成結果頁 `/results`
- 程度測驗結果 / 分數進步頁 `/learning-plan`
- 初學者首頁鼓勵區塊 `/dashboard`
- 連續學習天數打卡區塊（dashboard hero）

---

## 👤 Demo 帳號使用方式

登入頁 `/login` 點擊 **「使用示範帳號快速登入」**（免密碼）即可進入：

- 使用者：**Erin**
- 程度：Beginner（A1–A2）
- 興趣：旅遊、職場、日常生活、科技
- 每日目標：15 分鐘、中文輔助：開啟

也可用一般註冊流程：`/register` → 自動登入 → `/onboarding` 問卷 → `/level-test` 程度測驗 → `/learning-plan` 建立學習路線 → `/dashboard`。

> Email 欄位輸入 `erin20080306@gmail.com` 也視為示範帳號。

---

## 🗺️ 預覽路徑一覽

| 路徑 | 說明 |
| --- | --- |
| `/` | Landing 歡迎頁 |
| `/register` `/login` | 註冊 / 登入（含 Demo 快速登入） |
| `/onboarding` | 新手問卷（語言/目標/興趣/時間/中文輔助） |
| `/level-test` | 10 題程度測驗 |
| `/learning-plan` | 程度結果＋個人化學習路線（含 cheer.png） |
| `/dashboard` | 首頁 Dashboard（依程度顯示不同推薦） |
| `/scenes` `/scenes/[themeId]` `/scenes/[themeId]/[sceneId]` | 場景主題 → 場景列表 → 場景練習 |
| `/dialogue` | AI 對話學習（本地 mock tutor） |
| `/custom-scene` | 自創場景，自動產生練習卡 |
| `/rhyme` | 同尾字單字查詢（300+ 本地字庫） |
| `/dictionary` | 英英字典 |
| `/exam` `/exam/[type]` | TOEIC / IELTS / TOEFL 測驗中心（每種 20 題） |
| `/records` | 紀錄：單字 / 句子 / 對話 / 場景 / 測驗 / 錯題 / 複習 |
| `/results` | 練習成果與分數頁（含 cheer.png） |
| `/settings` | 個人設定與中文顯示控制 |

---

## 🧱 專案架構

```
src/
├─ app/                # App Router 頁面（每個資料夾一個路由）
├─ components/         # CheerImage / BottomNav / WordSheet / ClickableText / ScoreRing / ui
├─ hooks/useUser.ts    # 前端登入守衛
├─ services/           # 服務分層（資料存取與商業邏輯）
│  ├─ storageService.ts      # localStorage 封裝（未來可換 Supabase/Firebase）
│  ├─ authService.ts         # 註冊 / 登入 / Demo / 程度
│  ├─ learningService.ts     # 問卷 / 設定 / 統計 / 紀錄 / 程度評分 / 學習路線
│  ├─ sceneService.ts        # 場景主題 / 進度 / 自創場景產生
│  ├─ vocabularyService.ts   # 單字 / 同尾字搜尋 / 收藏 / 複習
│  ├─ dictionaryService.ts   # 英英字典查詢（含 fallback）/ 收藏句子
│  ├─ examService.ts         # 測驗評分 / 成績 / 錯題
│  ├─ aiTutorService.ts      # AI 導師 facade（預留 OpenAI）
│  ├─ mockAiTutorService.ts  # 本地 mock AI 導師（免 API Key）
│  └─ speechService.ts       # 瀏覽器 SpeechSynthesis（美式優先）
├─ data/               # mock data：scenes / vocabulary(300+) / dictionary / examQuestions / levelTest
└─ types/index.ts      # 所有 TypeScript interface（users, scenes, dialogues, vocabulary, examQuestions...）
```

資料模型涵蓋：`users`、`onboardingProfiles`、`levelTests`、`learningPlans`、`sceneThemes`、`scenes`、`dialogues`、`vocabulary`、`sentenceRecords`、`learningRecords`、`examQuestions`、`examResults`、`savedWords`、`savedSentences`、`userSettings`。

---

## ✅ 已完成功能清單

- [x] 註冊 / 登入 / Demo 免密碼快速登入
- [x] 新手問卷 + 10 題程度測驗 + 5 級程度判定 + 個人化學習路線
- [x] Dashboard：進度、連續天數、收藏數、完成對話、測驗摘要、今日一句、鼓勵區塊、中文/發音開關、程度徽章、依程度推薦
- [x] 10 大場景主題、每主題 ≥10 場景；場景練習含對話、選擇題、角色扮演、收藏、自動記錄
- [x] AI 對話學習（本地 mock）：即時自然度評分、文法建議、更自然說法、鼓勵語、結算分數
- [x] 自創場景：依輸入產生關鍵單字×10、句型×5、範例對話與角色扮演
- [x] 句子單字可點擊 → Bottom Sheet 顯示音標/解釋/例句/發音/收藏
- [x] 同尾字查詢（2–5 字母、300+ 本地單字）
- [x] 英英字典（定義/同反義/相關字/發音/收藏，含 fallback）
- [x] TOEIC / IELTS / TOEFL 測驗中心（各 20 題、多題型、錯題與成績紀錄）
- [x] 完整紀錄頁 + 設定頁 5 種中文顯示獨立開關
- [x] 成果頁：分數環、進度條、星等、XP、連續天數、cheer.png 鼓勵
- [x] PWA manifest、手機優先 RWD、Framer Motion 動畫

---

## 🔌 未來串接位置（不可將 Key 放前端）

- **OpenAI（真實 AI 導師）**：已串接 `app/api/tutor/route.ts`。在 `.env.local` 加入 `OPENAI_API_KEY` 後，對話會走 OpenAI；沒有 key 會自動 fallback 到本機智能。
- **Supabase / Firebase（雲端帳號與同步）**：替換 `src/services/storageService.ts` 的讀寫實作；env 見 `.env.example`。
- **免費字典 API**：`src/services/dictionaryService.ts` 的 `lookupRemote()`，base URL 見 `.env.example` 的 `DICTIONARY_API_BASE_URL`，本地資料作為離線 fallback。
- **語音 API**：`src/services/speechService.ts` 目前用瀏覽器 SpeechSynthesis，可替換為雲端 TTS。

環境變數請複製 `.env.example` 為 `.env.local` 後填入（前端只用 `NEXT_PUBLIC_` 前綴者）。

---

## ☁️ 上傳 GitHub 與 Vercel 部署

### 1) 上傳到 GitHub

```bash
git init
git add .
git commit -m "feat: Mobile English MVP"
git branch -M main
git remote add origin https://github.com/erin20080306/nobile-english.git
git push -u origin main
```

> 若遠端已有內容，可改用 `git push -u origin main --force`（請確認可覆蓋）。

### 2) 部署到 Vercel（推薦）

1. 前往 https://vercel.com → New Project → Import 這個 GitHub repo。
2. Framework 會自動偵測為 **Next.js**，Build Command `next build`、Output 預設即可。
3. （可選）在 Project → Settings → Environment Variables 加入 `.env.example` 中的變數。
4. Deploy，完成後即可取得 `https://<your-project>.vercel.app`。

或使用 CLI：

```bash
npm i -g vercel
vercel        # 預覽部署
vercel --prod # 正式部署
```

---

## 🔒 備註

- 預設使用 `next@14.2.5`；如需修補安全性更新可執行 `npm i next@latest`（14.2.x patched）後再 `npm run build` 驗證。
- 本專案為 MVP，所有按鈕皆有可操作行為，無空白頁/假功能。
