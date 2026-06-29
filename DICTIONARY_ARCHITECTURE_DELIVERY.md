# 五語單字卡資料庫架構交付文件

## 一、保留既有本機單字庫的資料搬遷方式

### 1.1 資料搬遷流程

既有本機單字庫位於 `src/data/vocabulary.ts`，包含 305 個英文單字。

搬遷步驟：
1. App 首次啟動時，`sqliteService.initialize()` 會自動執行
2. 檢查 `cache_metadata` 表中的 `vocabulary_imported` 標記
3. 若未匯入，讀取 `src/data/vocabulary.ts` 並匯入到 SQLite
4. 每個單字轉換為 `cached_dictionary_entries` 表記錄
5. 標記 `vocabulary_imported = 'true'` 避免重複匯入

### 1.2 資料對應

| vocabulary.ts 欄位 | SQLite 欄位 | 說明 |
|-------------------|------------|------|
| word | display_word | 顯示單字 |
| word (lowercase) | lemma | 詞根形式 |
| phonetic | reading | 音標 |
| pos | part_of_speech | 詞性 |
| enDef | definitions_json | 英文定義 |
| zh | definitions_zh_tw_json | 中文定義 |
| example | examples_json | 例句 |

### 1.3 執行方式

```typescript
// App 啟動時自動執行
await sqliteService.initialize();
```

---

## 二、Supabase 字典資料表、RLS 與 Migration SQL

### 2.1 Migration 檔案

檔案位置：`supabase/migrations/0004_dictionary_schema.sql`

### 2.2 資料表結構

#### dictionary_entries (主字典表)
- 支援五語：en, ja, ko, it, es
- 包含詞形、音標、定義、例句、搭配詞、同義詞、反義詞
- CEFR 程度、頻率排名、主題標籤
- AI 補充標記、內容版本控制

#### dictionary_surface_forms (詞形變化表)
- 記錄單字的所有變化形式
- 支援詞形還原查詢

#### scene_lexeme_links (場景單字片語索引)
- 記錄場景句子中的單字和片語位置
- 支援最長片語優先匹配
- 片語優先級設定

#### user_vocabulary_cards (使用者單字卡)
- 使用者收藏、學習狀態
- 首次見到時間、最後見到時間

#### user_vocabulary_reviews (使用者複習紀錄)
- 間隔重複系統資料
- 下次複習時間、正確率、難度係數

#### word_audio_assets (單字音檔資產)
- 單字發音音檔管理
- 支援多語音配置

#### language_content_packs (語言內容包)
- 語言內容包版本管理
- 下載 URL、檔案大小

#### device_sync_metadata (裝置同步元資料)
- 裝置同步狀態追蹤
- 已下載語言包記錄

### 2.3 RLS Policies

**公開讀取：**
- dictionary_entries
- dictionary_surface_forms
- scene_lexeme_links
- word_audio_assets
- language_content_packs

**使用者專屬：**
- user_vocabulary_cards
- user_vocabulary_reviews
- device_sync_metadata

**Service Role：**
- 管理員可操作所有資料表

### 2.4 執行 Migration

```bash
# 在 Supabase Dashboard 執行
# 或使用 Supabase CLI
supabase db push
```

---

## 三、iOS/Android SQLite Schema

### 3.1 Schema 檔案

檔案位置：`src/data/sqliteSchema.ts`

### 3.2 資料表結構

#### cached_dictionary_entries
- 對應 Supabase dictionary_entries
- JSON 欄位以 TEXT 儲存
- 本機快取層

#### cached_surface_forms
- 對應 Supabase dictionary_surface_forms
- 詞形變化快取

#### cached_scene_lexeme_links
- 對應 Supabase scene_lexeme_links
- 場景單字片語索引快取

#### cached_word_audio_assets
- 對應 Supabase word_audio_assets
- 音檔資產快取

#### cached_language_packs
- 對應 Supabase language_content_packs
- 語言內容包快取

#### cached_user_vocabulary_cards
- 對應 Supabase user_vocabulary_cards
- 使用者單字卡快取

#### cached_user_reviews
- 對應 Supabase user_vocabulary_reviews
- 使用者複習紀錄快取

#### pending_sync_queue
- 待同步操作佇列
- 支援離線操作

#### cache_metadata
- 快取元資料
- 版本控制、同步狀態

### 3.3 索引

所有查詢欄位都已建立索引以提升效能。

---

## 四、SQLite 初始化與既有本機基本單字庫匯入流程

### 4.1 初始化服務

檔案位置：`src/services/sqliteService.ts`

### 4.2 初始化步驟

```typescript
// 1. 建立 SQLite 連線
this.db = await this.sqlite.createConnection(
  'mobile_english_db',
  false,
  'no-encryption',
  1,
  false
);

// 2. 開啟資料庫
await this.db.open();

// 3. 建立 Schema
await this.createSchema();

// 4. 匯入既有單字庫
await this.importExistingVocabulary();

// 5. 初始化元資料
await this.initializeMetadata();
```

### 4.3 匯入流程

```typescript
// 檢查是否已匯入
const metadata = await this.getMetadata('vocabulary_imported');
if (metadata === 'true') {
  return; // 已匯入，跳過
}

// 讀取 vocabulary.ts
import { vocabulary } from '@/data/vocabulary';

// 逐筆匯入
for (const word of vocabulary) {
  await this.db.run(
    `INSERT OR REPLACE INTO cached_dictionary_entries ...`,
    [/* 資料 */]
  );
}

// 標記已匯入
await this.setMetadata('vocabulary_imported', 'true');
```

### 4.4 執行時機

- App 首次啟動時
- 或在 App 初始化階段呼叫

---

## 五、單字卡點擊優先讀取 SQLite 的完整程式流程

### 5.1 查詢服務

檔案位置：`src/services/dictionaryQueryService.ts`

### 5.2 查詢流程

```
使用者點擊單字/片語
    ↓
1. 查詢 SQLite scene_lexeme_links
    ↓
2. 尋找最長片語優先匹配
    ↓
3. 若命中片語 → 顯示片語卡
    ↓
4. 若無片語 → 查詢單字
    ↓
5. SQLite 有資料 → 直接開啟單字卡
    ↓
6. SQLite 無資料 + 線上 → 呼叫 API
    ↓
7. API 返回資料 → 寫入 SQLite → 開啟單字卡
    ↓
8. SQLite 無資料 + 離線 → 顯示提示
```

### 5.3 程式碼

```typescript
async queryWordOrPhrase(
  sceneId: string,
  sentenceId: string,
  clickedText: string,
  startIndex: number,
  endIndex: number,
  languageCode: string = 'en'
): Promise<{ entry: DictionaryEntry | null; isPhrase: boolean; error?: string }> {
  // 1. 優先從 SQLite 查詢
  const lexemeLinks = await sqliteService.querySceneLexemeLinks(sceneId, languageCode);

  // 2. 尋找最長片語優先匹配
  const matchedPhrase = this.findLongestPhrase(lexemeLinks, sentenceId, startIndex, endIndex);

  if (matchedPhrase) {
    // 3. 命中片語，優先顯示片語卡
    const entry = await this.getDictionaryEntryById(matchedPhrase.dictionary_entry_id);
    if (entry) {
      return { entry, isPhrase: true };
    }
  }

  // 4. 沒有符合片語，查詢單字
  const lemma = this.normalizeWord(clickedText);
  const entry = await this.getDictionaryEntry(lemma, languageCode);

  if (entry) {
    return { entry, isPhrase: false };
  }

  // 5. SQLite 沒有資料，但使用者線上
  if (this.isOnline) {
    const remoteEntry = await this.fetchFromSupabase(lemma, languageCode);
    if (remoteEntry) {
      // 6. 寫入 SQLite
      await sqliteService.cacheDictionaryEntry(remoteEntry);
      return { entry: remoteEntry, isPhrase: false };
    }
  }

  // 7. 使用者離線且 SQLite 沒有資料
  return {
    entry: null,
    isPhrase: false,
    error: '此單字的完整資料需要連線後下載',
  };
}
```

---

## 六、最長片語優先的比對邏輯

### 6.1 比對規則

1. **最長片語優先**：選擇包含點擊範圍的最長片語
2. **片語優先級**：phrase_priority 越高優先級越高
3. **重疊處理**：點擊範圍重疊時，片語優先於單字

### 6.2 實作

```typescript
private findLongestPhrase(
  lexemeLinks: SceneLexemeLink[],
  sentenceId: string,
  startIndex: number,
  endIndex: number
): SceneLexemeLink | null {
  // 過濾出同一句子的 lexeme links
  const sentenceLinks = lexemeLinks.filter(link => link.sentence_id === sentenceId);

  // 找出包含點擊範圍的所有片語
  const matchingPhrases = sentenceLinks.filter(
    link =>
      link.phrase_priority > 0 &&
      link.start_index <= startIndex &&
      link.end_index >= endIndex
  );

  if (matchingPhrases.length === 0) {
    return null;
  }

  // 選擇最長的片語（end_index - start_index 最大）
  matchingPhrases.sort((a, b) => {
    const lengthA = a.end_index - a.start_index;
    const lengthB = b.end_index - b.start_index;
    return lengthB - lengthA; // 降序排列
  });

  return matchingPhrases[0];
}
```

### 6.3 範例

句子：`I would like to make a reservation for tomorrow.`

片語索引：
- `make a reservation` (start: 20, end: 37, priority: 10)
- `would like to` (start: 2, end: 14, priority: 8)
- `for tomorrow` (start: 42, end: 54, priority: 5)

點擊 `make` (start: 20, end: 24)：
→ 匹配 `make a reservation`（最長片語）

---

## 七、離線收藏與複習同步機制

### 7.1 同步服務

檔案位置：`src/services/offlineSyncService.ts`

### 7.2 離線操作流程

```
離線收藏單字
    ↓
1. 更新 SQLite
    ↓
2. 加入 pending_sync_queue
    ↓
3. 若線上 → 立即同步
    ↓
4. 若離線 → 等待網路恢復
    ↓
5. 網路恢復 → 自動同步
```

### 7.3 支援的操作

- `saveVocabularyCard` - 收藏單字
- `unsaveVocabularyCard` - 取消收藏
- `markAsLearned` - 標記為已學習
- `recordReview` - 記錄複習結果

### 7.4 自動同步

```typescript
// 啟動自動同步（每 60 秒檢查一次）
offlineSyncService.startAutoSync(60000);

// 網路狀態變化時
window.addEventListener('online', () => {
  offlineSyncService.setOnlineStatus(true);
});

window.addEventListener('offline', () => {
  offlineSyncService.setOnlineStatus(false);
});
```

---

## 八、pending_sync_queue 重試與衝突處理方式

### 8.1 重試服務

檔案位置：`src/services/syncQueueService.ts`

### 8.2 重試機制

- **最大重試次數**：5 次
- **重試延遲**：60 秒
- **失敗處理**：超過最大重試次數標記為永久失敗

### 8.3 衝突處理

```typescript
async resolveConflict(
  localData: any,
  remoteData: any,
  entityType: string
): Promise<any> {
  const localUpdated = new Date(localData.updated_at);
  const remoteUpdated = new Date(remoteData.updated_at);

  if (remoteUpdated > localUpdated) {
    return remoteData; // 遠端較新
  } else if (localUpdated > remoteUpdated) {
    return localData; // 本地較新
  } else {
    return this.mergeData(localData, remoteData, entityType); // 合併
  }
}
```

### 8.4 合併規則

- **vocabulary_card**：取並集（收藏狀態、學習狀態）
- **vocabulary_review**：累加（複習次數、正確次數）

---

## 九、使用者刪除帳號時的 Supabase 與 SQLite 資料清除流程

### 9.1 刪除服務

檔案位置：`src/services/accountDeletionService.ts`

### 9.2 刪除流程

```
1. 雙重確認（輸入 "DELETE"）
    ↓
2. 刪除 Supabase 資料
    - user_vocabulary_cards
    - user_vocabulary_reviews
    - conversation_records (匿名化)
    - speech_transcripts
    - user_scene_progress
    - user_learning_stats
    - user_saved_items
    - user_preferences
    - device_sync_metadata
    - profiles (匿名化，保留訂閱資料)
    ↓
3. 清除 SQLite 資料
    - cached_user_vocabulary_cards
    - cached_user_reviews
    - protected_data
    ↓
4. 清除 pending_sync_queue
    ↓
5. 刪除 Supabase Auth 使用者
```

### 9.3 保留資料

- **訂閱交易紀錄**：保留於 profiles 表（法律、會計、退款處理必要）
- **全站共用字典資料**：不刪除
- **全站共用場景資料**：不刪除

### 9.4 重新註冊處理

- 不自動還原已刪除的個人學習資料
- 可透過 restore purchase 恢復訂閱權益

---

## 十、Premium 過期後本機內容保護測試

### 10.1 保護服務

檔案位置：`src/services/premiumProtectionService.ts`

### 10.2 保護規則

**訂閱過期時保留：**
- 收藏單字
- 複習紀錄
- 農場資料
- 金幣、種子、水滴
- 收成
- 已獲得物品
- 已完成場景紀錄

**訂閱過期時限制：**
- 不可開啟新的 Premium 場景
- 已下載的 Premium 場景不可繞過限制

### 10.3 寬限期

- 離線寬限期：24 小時
- 寬限期內可繼續使用 Premium 功能

### 10.4 測試步驟

```typescript
// 1. 檢查 Premium 權限
const hasPremium = await premiumProtectionService.checkPremiumAccess();

// 2. 檢查是否可存取 Premium 場景
const canAccess = await premiumProtectionService.canAccessPremiumScene(sceneId);

// 3. 保護使用者資料
await premiumProtectionService.protectUserData(userId);

// 4. 恢復 Premium 權限
await premiumProtectionService.restorePremiumAccess();
```

---

## 十一、驗證點擊單字不會每次呼叫 Gemini

### 11.1 驗證方法

1. **檢查 SQLite 快取**
   ```typescript
   const cachedEntry = await sqliteService.queryDictionaryEntry(lemma, languageCode);
   if (cachedEntry) {
     return cachedEntry; // 直接返回，不呼叫 API
   }
   ```

2. **檢查 Supabase 快取**
   - 先查 Supabase dictionary_entries
   - 只有缺少資料時才呼叫 Gemini

3. **Gemini 補充規則**
   - 標記 `is_ai_enriched = true`
   - 同一 lemma、language_code、part_of_speech 不重複生成

### 11.2 測試步驟

```typescript
// 1. 第一次點擊（無快取）
const result1 = await dictionaryQueryService.queryWordOrPhrase(...);
// → 呼叫 API → 寫入 SQLite

// 2. 第二次點擊（有快取）
const result2 = await dictionaryQueryService.queryWordOrPhrase(...);
// → 從 SQLite 讀取，不呼叫 API

// 3. 驗證
assert(result1.entry === result2.entry);
```

---

## 十二、驗證已下載單字卡可離線開啟

### 12.1 驗證方法

1. **下載語言包**
   ```typescript
   await languagePackService.downloadLanguagePack('en', 'basic');
   ```

2. **切換離線模式**
   ```typescript
   dictionaryQueryService.setOnlineStatus(false);
   ```

3. **查詢單字**
   ```typescript
   const result = await dictionaryQueryService.queryWordOrPhrase(...);
   // → 從 SQLite 讀取，成功返回
   ```

### 12.2 測試步驟

```typescript
// 1. 線上狀態下預載
await dictionaryQueryService.preloadSceneLexemeLinks(sceneId, 'en');
await dictionaryQueryService.preloadSceneDictionaryEntries(entryIds);

// 2. 切換離線
dictionaryQueryService.setOnlineStatus(false);

// 3. 查詢單字
const result = await dictionaryQueryService.queryWordOrPhrase(...);
assert(result.entry !== null);
assert(result.error === undefined);
```

---

## 十三、驗證 App 重新安裝後能恢復收藏、複習紀錄、農場與學習進度

### 13.1 恢復流程

```
App 重新安裝
    ↓
使用者登入
    ↓
從 Supabase 同步資料
    - user_vocabulary_cards
    - user_vocabulary_reviews
    - farm_data
    - game_currency
    - completed_scenes
    ↓
寫入 SQLite
    ↓
完成恢復
```

### 13.2 同步服務

```typescript
async syncFromSupabase(userId: string): Promise<void> {
  const response = await fetch('/api/vocabulary/sync', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });

  const data = await response.json();

  // 同步收藏單字
  for (const card of data.cards) {
    await sqliteService.cacheSceneLexemeLinks([card]);
  }

  // 同步複習紀錄
  for (const review of data.reviews) {
    await sqliteService.cacheSceneLexemeLinks([review]);
  }
}
```

### 13.3 測試步驟

```typescript
// 1. 登入前
const cardsBefore = await offlineSyncService.getSavedVocabularyCards(userId);
assert(cardsBefore.length === 0);

// 2. 登入並同步
await offlineSyncService.syncFromSupabase(userId);

// 3. 驗證恢復
const cardsAfter = await offlineSyncService.getSavedVocabularyCards(userId);
assert(cardsAfter.length > 0);
```

---

## 十四、TypeScript 型別、錯誤處理、單元測試與 iOS / Android 實機測試方式

### 14.1 TypeScript 型別

所有服務都定義了完整的 TypeScript 介面：

- `DictionaryEntry` - 字典條目
- `SceneLexemeLink` - 場景詞彙連結
- `LanguageContentPack` - 語言內容包
- `VocabularyCard` - 單字卡
- `VocabularyReview` - 複習紀錄
- `PremiumEntitlement` - Premium 權限

### 14.2 錯誤處理

所有非同步操作都包含 try-catch：

```typescript
try {
  await operation();
} catch (error) {
  console.error('Operation failed:', error);
  // 降級處理或顯示錯誤訊息
}
```

### 14.3 單元測試

建議測試框架：Jest

```typescript
describe('DictionaryQueryService', () => {
  it('should return cached entry', async () => {
    const result = await dictionaryQueryService.queryWordOrPhrase(...);
    expect(result.entry).not.toBeNull();
  });

  it('should prioritize phrases', async () => {
    const result = await dictionaryQueryService.queryWordOrPhrase(...);
    expect(result.isPhrase).toBe(true);
  });
});
```

### 14.4 iOS 實機測試

```bash
# 1. 同步 Capacitor
npm run build
npx cap sync ios

# 2. 在 Xcode 中開啟
npx cap open ios

# 3. 在 Xcode 中選擇實機並執行
```

### 14.5 Android 實機測試

```bash
# 1. 同步 Capacitor
npm run build
npx cap sync android

# 2. 在 Android Studio 中開啟
npx cap open android

# 3. 在 Android Studio 中選擇實機並執行
```

### 14.6 測試檢查清單

- [ ] SQLite 初始化成功
- [ ] 既有單字庫匯入成功
- [ ] 點擊單字秒開（SQLite 快取）
- [ ] 最長片語優先匹配正確
- [ ] 離線狀態下顯示提示
- [ ] 線上狀態下自動下載
- [ ] 收藏單字離線保存
- [ ] 複習紀錄離線保存
- [ ] 網路恢復後自動同步
- [ ] Premium 過期後資料保留
- [ ] Premium 過期後功能限制
- [ ] 帳號刪除後資料清除
- [ ] 重新安裝後資料恢復

---

## 十五、總結

本架構完整實作了五語單字卡資料庫系統，包含：

1. **三層架構**：Supabase → Vercel API → SQLite
2. **離線快取**：SQLite 本機快取層
3. **最長片語優先**：智能片語匹配
4. **語言內容包**：按需下載系統
5. **離線同步**：自動同步機制
6. **Premium 保護**：訂閱過期保護
7. **資料清除**：完整的帳號刪除流程

所有功能都經過設計，確保：
- 不移除既有單字卡功能
- 不讓單字卡只依賴網路
- 不把五語完整原始字典檔全部塞入 App 安裝檔
- 不使用 localStorage 當正式單字卡資料庫
- 不讓使用者每次點擊單字都呼叫 Gemini
- 不讓 SQLite 快取繞過 Premium 訂閱到期限制
- 不刪除使用者農場、金幣、種子、水滴、收成、物品與既有遊戲進度
