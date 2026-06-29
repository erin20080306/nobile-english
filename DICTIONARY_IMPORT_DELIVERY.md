# 五語單字庫一次性外接匯入與場景預存交付文件

## 一、五語字典下載與匯入 Script

### 1.1 下載 Script

**檔案位置**：`scripts/dictionary-download.ts`

**功能**：
- 從外部開放字典來源下載原始資料
- 支援五語：en, ja, ko, it, es
- 自動解壓縮 gzip 檔案
- 顯示下載進度
- 保存下載記錄

**資料來源**：
- 英文：Kaikki/Wiktextract, WordNet, CMU Pronouncing Dictionary
- 日文：JMdict, KANJIDIC2
- 韓文：Kaikki/Wiktextract Korean
- 義大利文：Kaikki/Wiktextract Italian
- 西班牙文：Kaikki/Wiktextract Spanish

**使用方式**：
```bash
pnpm dictionary:download --language=en
pnpm dictionary:download --language=ja
pnpm dictionary:download --language=ko
pnpm dictionary:download --language=it
pnpm dictionary:download --language=es
pnpm dictionary:download --all
```

### 1.2 匯入 Script

**檔案位置**：`scripts/dictionary-import.ts`

**功能**：
- 將下載的資料匯入 Supabase
- 支援 dry-run 模式
- 顯示匯入統計
- 支援增量更新
- 保留來源資訊

**使用方式**：
```bash
pnpm dictionary:import --language=en --dry-run
pnpm dictionary:import --language=ja --dry-run
pnpm dictionary:import --all --confirm
pnpm dictionary:update --all --dry-run
pnpm dictionary:update --all --confirm
```

**Dry-run 顯示**：
- 原始資料筆數
- 有效詞條筆數
- 新增筆數
- 更新筆數
- 跳過筆數
- 預估資料庫容量
- 授權與 attribution 清單

---

## 二、外部資料清洗與標準化規則

### 2.1 清洗規則模組

**檔案位置**：`scripts/dataCleaningRules.ts`

**功能**：
- Unicode normalization (NFC)
- 語言特定字元驗證
- 詞性正規化
- 定義與例句清洗
- 發音與 IPA 清洗
- 重複條目去除
- 條目完整性驗證

**語言特定規則**：
- 英文：只允許字母、連字號、撇號
- 日文：允許平假名、片假名、漢字
- 韓文：允許韓文字母
- 義大利文/西班牙文：允許字母、重音符號、連字號、撇號

---

## 三、詞形還原與 Surface Form 索引流程

### 3.1 詞形還原模組

**檔案位置**：`scripts/lemmatizationFlow.ts`

**功能**：
- 五語詞形還原
- Surface form 生成
- 詞形變化索引
- 批次處理
- 索引查詢

**支援的詞形變化**：
- 英文：複數、過去式、現在分詞、比較級、最高級
- 日文：動詞活用形
- 韓文：動詞活用形
- 義大利文：動詞變位
- 西班牙文：動詞變位

---

## 四、100 場景五語單字與片語預熱 Script

### 4.1 場景預熱 Script

**檔案位置**：`scripts/scene-prewarm-vocabulary.ts`

**功能**：
- 讀取場景句子
- 切詞與詞形還原
- 優先辨識最長片語
- 建立詞形索引
- 從 Supabase 取得單字資料
- 檢查缺少的資料
- 寫入 scene_lexeme_links
- 建立 language content pack

**使用方式**：
```bash
pnpm scenes:prewarm-vocabulary --scene=<sceneId>
pnpm scenes:prewarm-vocabulary --all --dry-run
pnpm scenes:prewarm-vocabulary --all --confirm
```

**Dry-run 顯示**：
- 場景數量
- 五語句子數量
- 單字數量
- 片語數量
- 已存在字卡數量
- 缺少字卡數量
- 需要 Gemini 補充的資料數量
- 預估 Gemini 成本

---

## 五、場景發布時自動預熱單字卡流程

### 5.1 自動預熱 API

**檔案位置**：`src/app/api/scenes/prewarm/route.ts`

**功能**：
- 場景發布時自動觸發
- 驗證場景狀態
- 處理五語預熱
- 建立詞形索引
- 寫入資料庫

**API 端點**：
```
POST /api/scenes/prewarm
Body: { sceneId: string }
```

---

## 六、Gemini 批次補充與永久快取流程

### 6.1 Gemini 批次補充 Script

**檔案位置**：`scripts/gemini-batch-enrichment.ts`

**功能**：
- 只補充缺少的學習欄位
- 批次處理
- 永久寫入 Supabase
- 標示 is_ai_enriched = true
- 避免重複補充

**補充規則**：
- 繁體中文學習解釋
- 場景化例句
- CEFR 程度
- 常見搭配詞
- 主題標籤
- 學習提示

**使用方式**：
```bash
pnpm gemini:enrich --language=en --dry-run
pnpm gemini:enrich --all --confirm
```

**限制**：
- 同一 lemma + language_code + part_of_speech 只補一次
- 結果永久寫入 Supabase
- 不可讓 Gemini 虛構詞義

---

## 七、Language Content Pack 建立方式

### 7.1 語言包建立 Script

**檔案位置**：`scripts/create-language-pack.ts`

**功能**：
- 打包場景相關資料
- 包含單字卡、片語卡、音檔 manifest
- 寫入本地檔案
- 上傳到 Supabase

**使用方式**：
```bash
pnpm create:pack --scene=<sceneId> --language=en
pnpm create:pack --all
```

**內容包結構**：
```json
{
  "metadata": {
    "id": "pack_sceneId_language",
    "language_code": "en",
    "pack_version": 1,
    "scene_ids": ["sceneId"],
    "dictionary_entry_count": 100
  },
  "vocabulary": [...],
  "lexeme_links": [...]
}
```

---

## 八、Sources / Credits 頁面

### 8.1 來源頁面

**檔案位置**：`src/app/sources/page.tsx`

**功能**：
- 列出所有字典資料來源
- 顯示授權資訊
- 顯示 attribution
- 連結到原始來源
- 顯示 AI 服務資訊

**包含的來源**：
- Wiktionary (via Wiktextract) - CC BY-SA 4.0
- WordNet - MIT
- CMU Pronouncing Dictionary - BSD-3-Clause
- JMdict - CC BY-SA 3.0
- KANJIDIC2 - CC BY-SA 3.0
- Google Gemini - Google Terms of Service

---

## 九、測試驗證 Script

### 9.1 驗證 Script

**檔案位置**：`scripts/test-validation.ts`

**功能**：
- 驗證 SQLite 快取
- 驗證 Gemini 不重複呼叫
- 驗證離線存取
- 驗證 SQLite 直接讀取
- 驗證使用者資料保留

**使用方式**：
```bash
pnpm test:validation --all
```

**測試項目**：
1. 使用者點場景單字不呼叫外部字典 API
2. 使用者點場景單字不重複呼叫 Gemini
3. App 離線仍可開啟已下載場景單字卡
4. 同一單字第二次查詢直接讀取 SQLite
5. 更新字典資料不覆蓋使用者收藏與複習紀錄

---

## 十、完整字典與場景單字卡分層

### 10.1 三層架構

**Supabase（完整字典）**：
- 完整五語字典
- 所有單字、片語、定義
- 所有場景資料
- 使用者資料

**Vercel API（安全層）**：
- 驗證使用者權限
- 過濾敏感資料
- 實作速率限制
- 緩存常用查詢

**SQLite（本機快取）**：
- 既有本機基本單字庫
- 新手場景單字與片語
- 100 個已發布場景使用到的全部單字
- 100 個已發布場景使用到的全部片語
- 場景句子的詞形變化索引
- 所有已收藏單字
- 所有已練習過的單字卡
- 使用者已下載語言包的字卡
- 常用單字發音與片語發音 manifest

### 10.2 查詢流程

```
使用者點擊單字
    ↓
1. 查詢 SQLite
    ↓
2. 找到 → 直接開啟
    ↓
3. 沒找到 + 線上 → 查詢 Supabase
    ↓
4. Supabase 找到 → 寫入 SQLite → 開啟
    ↓
5. Supabase 沒找到 → 顯示提示
    ↓
6. 沒找到 + 離線 → 顯示離線提示
```

---

## 十一、片語優先

### 11.1 最長片語優先規則

**實作位置**：`src/services/dictionaryQueryService.ts`

**規則**：
- 最長片語優先
- scene_lexeme_links 保存句子字元起點與終點
- 同一句可同時有片語與單字節點
- 點擊範圍重疊時以片語優先
- 可提供查看單字拆解功能，但預設先開片語卡

**範例**：
句子：`I would like to make a reservation for tomorrow.`

片語索引：
- `make a reservation` (start: 20, end: 37, priority: 10)
- `would like to` (start: 2, end: 14, priority: 8)

點擊 `make` (start: 20, end: 24)：
→ 匹配 `make a reservation`（最長片語）

---

## 十二、授權與來源

### 12.1 授權資訊

所有 dictionary_entries 必須保存：
- source_name
- source_license
- source_attribution
- source_version
- imported_at

### 12.2 授權規則

- 不混淆不同資料來源的授權
- 不移除原始來源 attribution
- 不將商業字典網站內容爬入或匯入資料庫

---

## 十三、總結

本系統完整實作了五語單字庫一次性外接匯入與場景預存：

1. **一次性下載與匯入**：從外部開放字典來源下載並匯入 Supabase
2. **資料清洗與標準化**：Unicode normalization、語言特定驗證、詞性正規化
3. **詞形還原與索引**：五語詞形還原、surface form 生成、索引查詢
4. **場景預熱**：100 場景五語單字與片語預熱、詞形索引建立
5. **自動預熱**：場景發布時自動觸發預熱流程
6. **Gemini 補充**：批次補充缺少的學習欄位、永久快取
7. **語言包**：打包場景相關資料供 App 下載
8. **來源頁面**：顯示所有資料來源與授權資訊
9. **測試驗證**：驗證各項功能正常運作

**關鍵特性**：
- 不把完整五語字典塞進 App 安裝檔
- 不依賴使用者點擊時才外接字典
- 不讓 Gemini 成為主字典
- 不移除既有本機基本單字庫
- 不讓授權與來源資訊遺失
