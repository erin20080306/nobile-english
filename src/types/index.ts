export type EnglishLevel =
  | "Beginner"
  | "Elementary"
  | "Intermediate"
  | "Upper-Intermediate"
  | "Advanced";

export type LearningLanguageCode = "en" | "ja" | "ko" | "it" | "es";
export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type ExamType = "TOEIC" | "IELTS" | "TOEFL";
export type QuestionType =
  | "vocabulary"
  | "grammar"
  | "reading"
  | "situational"
  | "reorder"
  | "fill-blank";
export type PartOfSpeech =
  | "n."
  | "v."
  | "adj."
  | "adv."
  | "prep."
  | "conj."
  | "interj."
  | "pron.";
export type ChineseSetting = "always" | "on-demand" | "practice-hide" | "review-only";

export interface AccountProfile {
  id: string;
  name: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  provider?: "local" | "google";
  deviceId?: string;
  deviceName?: string;
  deviceBoundAt?: string;
  lastDeviceSeenAt?: string;
  profiles?: AccountProfile[];
  activeProfileId?: string;
  level: EnglishLevel;
  cefrLevel: CEFRLevel;
  createdAt: string;
  isDemo: boolean;
  onboarded: boolean;
}

export interface OnboardingProfile {
  userId: string;
  language: string;
  learningGoal: string;
  interests: string[];
  dailyGoalMinutes: number;
  chineseSetting: ChineseSetting;
  selfRatedLevel?: EnglishLevel;
}

export interface LevelTestQuestion {
  id: string;
  type: QuestionType;
  question: string;
  passage?: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface LevelTestResult {
  userId: string;
  score: number;
  total: number;
  level: EnglishLevel;
  cefrLevel: CEFRLevel;
  suggestion: string;
  recommendedTopics: string[];
  dailyMinutes: number;
  completedAt: string;
}

export interface LearningPlan {
  userId: string;
  level: EnglishLevel;
  focusTopics: string[];
  weeklyGoalMinutes: number;
  recommendedThemeIds: string[];
  createdAt: string;
}

export interface Word {
  word: string;
  language?: LearningLanguageCode;
  phonetic: string;
  pos: PartOfSpeech;
  enDef: string;
  zh: string;
  example: string;
  exampleZh?: string;
  synonyms?: string[];
  antonyms?: string[];
  related?: string[];
}

export interface DialogueLine {
  speaker: "tutor" | "user" | "system";
  en: string;
  zh: string;
}

export interface QuizItem {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface Scene {
  id: string;
  themeId: string;
  targetLanguage?: LearningLanguageCode;
  name: string;
  enName: string;
  intro: string;
  difficulty: EnglishLevel;
  minutes: number;
  goals: string[];
  keyWords: string[];
  keyPatterns: { en: string; zh: string }[];
  dialogue: DialogueLine[];
  quiz: QuizItem[];
}

export interface SceneTheme {
  id: string;
  name: string;
  enName: string;
  emoji: string;
  color: string;
  difficulty: EnglishLevel;
  minutes: number;
  description: string;
}

export interface ExamQuestion {
  id: string;
  exam: ExamType;
  type: QuestionType;
  category: "vocabulary" | "grammar" | "reading" | "listening";
  passage?: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanationZh: string;
  reviewWords?: string[];
}

export interface ExamResult {
  id: string;
  exam: ExamType;
  correct: number;
  total: number;
  percent: number;
  level: string;
  wrongQuestionIds: string[];
  reviewWords: string[];
  completedAt: string;
}

export interface SavedWord extends Word {
  savedAt: string;
  inReview: boolean;
  source?: string;
}

export interface SavedSentence {
  id: string;
  en: string;
  zh: string;
  savedAt: string;
  source?: string;
}

export interface DialogueTranscriptLine {
  role: "tutor" | "user";
  en: string;
  zh?: string;
  naturalness?: number;
  betterWay?: string;
  grammarTip?: string;
  zhExplain?: string;
}

export interface LearningRecord {
  id: string;
  type: "scene" | "dialogue" | "exam" | "custom";
  targetLanguage?: LearningLanguageCode;
  title: string;
  sceneName?: string;
  enContent?: string;
  zhContent?: string;
  userAnswer?: string;
  suggestion?: string;
  conversationWords?: string[];
  transcript?: DialogueTranscriptLine[];
  score: number;
  completed: boolean;
  minutes: number;
  date: string;
}

export interface UserSettings {
  userId: string;
  targetLanguage: LearningLanguageCode;
  speechRateByLanguage: Partial<Record<LearningLanguageCode, number>>;
  pronunciationOn: boolean;
  showChineseGlobal: boolean;
  sceneChinese: boolean;
  dialogueChinese: boolean;
  wordReviewChinese: boolean;
  sentenceReviewChinese: boolean;
  examChinese: boolean;
}

export interface Stats {
  xp: number;
  streak: number;
  lastActiveDate: string;
  todayMinutes: number;
  completedDialogues: number;
  completedScenes: number;
}

export interface GardenCrop {
  id: string;
  name: string;
  enName: string;
  emoji: string;
  color: string;
  description: string;
  rewardCoins: number;
}

export type GardenShopCategory = "house" | "item" | "outfit" | "accessory";

export interface GardenShopItem {
  id: string;
  category: GardenShopCategory;
  name: string;
  emoji: string;
  price: number;
  description: string;
  imageSrc?: string;
  dollImageSrc?: string;
}

export interface GardenLeagueEntry {
  id: string;
  name: string;
  avatar: string;
  dailyCoins: number;
  monthlyCoins: number;
  totalCoins: number;
  isCurrentUser?: boolean;
}

export interface GardenPlot {
  id: number;
  cropId?: string;
  growth: number;
  plantedAt?: string;
  wateredAt?: string;
  harvestReady?: boolean;
}

export interface GardenActivityLog {
  id: string;
  type: "learning" | "daily" | "plant" | "water" | "harvest" | "review";
  title: string;
  detail: string;
  at: string;
}

export interface GardenState {
  language: LearningLanguageCode;
  level: number;
  xp: number;
  water: number;
  seeds: number;
  coins: number;
  dailyCoins: number;
  monthlyCoins: number;
  leagueDay: string;
  leagueMonth: string;
  leagueRewardsClaimed: Partial<Record<"daily" | "monthly", string>>;
  harvests: number;
  harvestByCrop: Partial<Record<string, number>>;
  ownedItemIds: string[];
  equippedHouseId: string;
  equippedItemIds: string[];
  equippedOutfitId: string;
  equippedAccessoryIds: string[];
  lastDailyBonusAt?: string;
  plots: GardenPlot[];
  log: GardenActivityLog[];
}

export interface GardenReviewCard {
  id: string;
  word: string;
  meaning: string;
  language: LearningLanguageCode;
}

export interface CustomSceneStage {
  title: string;
  enTitle: string;
  tutorPrompt: string;
  learnerGoal: string;
  sampleUser: string;
}

export interface CustomScene {
  id: string;
  targetLanguage?: LearningLanguageCode;
  situation: string;
  role: string;
  place: string;
  difficulty: EnglishLevel;
  topic: string;
  pattern: string;
  showChinese: boolean;
  rounds: number;
  stages?: CustomSceneStage[];
  scene: Scene;
  createdAt: string;
}

export interface TutorFeedback {
  reply: string;
  replyZh: string;
  ttsCandidate?: string; // Text to be spoken by TTS (target language only, no Chinese)
  naturalness: number;
  grammarTip: string;
  betterWay: string;
  zhExplain: string;
  encouragement: string;
}

export interface DialogueSuggestion {
  area: string;
  tip: string;
  example?: string;
}

export interface DialogueReview {
  grammarPoints: string[];
  vocabularyUsed: string[];
  strengthenAreas: string[];
  nativeRewrites: string[];
}

export type SceneReviewTaskKind = "fill" | "reply" | "choice";

export interface SceneReviewTask {
  id: string;
  kind: SceneReviewTaskKind;
  prompt: string;
  answer: string;
  options?: string[];
  hint?: string;
}

export interface SceneReviewCheck {
  sceneName: string;
  language: LearningLanguageCode;
  tasks: SceneReviewTask[];
  advice: string[];
  strengthenAreas: string[];
}

export interface DialogueResult {
  total: number;
  vocab: number;
  grammar: number;
  fluency: number;
  taskCompletion: number;
  reviewSentences: string[];
  newWords: string[];
  conversationWords: string[];
  suggestions: DialogueSuggestion[];
  dialogueReview: DialogueReview;
  nextSceneId?: string;
}

// Daily Reading Articles Types

export type ArticleSource = "original_ai" | "editor_written" | "licensed_external" | "public_domain";
export type ArticleStatus = "draft" | "ready" | "published" | "archived" | "cancelled";
export type TopicStatus = "draft" | "ready" | "published" | "cancelled";
export type SentenceType = "title" | "body" | "summary" | "tip";
export type ArticleQuestionType = "multiple_choice" | "sentence_order" | "word_match" | "true_false" | "fill_in_blank";
export type AudioAssetStatus = "pending" | "processing" | "ready" | "failed";
export type RewardType = "coins" | "seeds" | "water" | "crop";

export interface ReadingArticleTopic {
  id: string;
  publish_date: string;
  topic_key: string;
  topic_title_zh_tw: string;
  topic_category: string;
  status: TopicStatus;
  created_at: string;
  updated_at: string;
}

export interface ReadingArticle {
  id: string;
  topic_id: string;
  language_code: LearningLanguageCode;
  title: string;
  title_zh_tw: string;
  article_text: string;
  difficulty_level: CEFRLevel;
  estimated_reading_seconds: number;
  source_type: ArticleSource;
  source_name?: string;
  source_url?: string;
  source_license?: string;
  source_attribution?: string;
  content_version: number;
  status: ArticleStatus;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ReadingArticleSentence {
  id: string;
  article_id: string;
  sentence_order: number;
  sentence_text: string;
  sentence_zh_tw: string;
  sentence_type: SentenceType;
  estimated_duration_ms: number;
  created_at: string;
  updated_at: string;
}

export interface ReadingArticleLexemeLink {
  id: string;
  article_id: string;
  sentence_id: string;
  language_code: LearningLanguageCode;
  start_index: number;
  end_index: number;
  display_text: string;
  dictionary_entry_id?: string;
  phrase_priority: number;
  created_at: string;
  updated_at: string;
}

export interface ReadingArticleAudioAsset {
  id: string;
  article_id: string;
  sentence_id?: string;
  language_code: LearningLanguageCode;
  tts_asset_id?: string;
  audio_path?: string;
  duration_ms?: number;
  audio_version: number;
  status: AudioAssetStatus;
  created_at: string;
  updated_at: string;
}

export interface ReadingArticleQuestion {
  id: string;
  article_id: string;
  question_order: number;
  question_type: ArticleQuestionType;
  question_text: string;
  options_json: any;
  correct_answer_json: any;
  explanation_zh_tw: string;
  created_at: string;
  updated_at: string;
}

export interface ReadingArticleProgress {
  id: string;
  user_id: string;
  article_id: string;
  language_code: LearningLanguageCode;
  started_at: string;
  completed_at?: string;
  last_sentence_order: number;
  reading_speed?: number;
  quiz_score?: number;
  is_reward_claimed: boolean;
  updated_at: string;
}

export interface ReadingArticleReward {
  id: string;
  article_id: string;
  language_code: LearningLanguageCode;
  reward_type: RewardType;
  reward_amount: number;
  crop_type?: string;
  created_at: string;
}

export interface DailyArticleGenerationLog {
  id: string;
  publish_date: string;
  language_code: LearningLanguageCode;
  article_id?: string;
  gemini_input_tokens: number;
  gemini_output_tokens: number;
  tts_character_count: number;
  tts_cache_hit_count: number;
  tts_cache_miss_count: number;
  word_audio_cache_miss_count: number;
  estimated_cost_usd: number;
  created_at: string;
}

// Gemini Article Generation Types

export interface GeminiArticleResponse {
  title: string;
  titleZhTw: string;
  difficultyLevel: CEFRLevel;
  topicCategory: string;
  articleText: string;
  sentences: {
    order: number;
    text: string;
    zhTw: string;
  }[];
  keyVocabulary: {
    surfaceText: string;
    lemma: string;
    reason: string;
  }[];
  questions: {
    type: ArticleQuestionType;
    question: string;
    options: string[];
    answer: string;
    explanationZhTw: string;
  }[];
}

// SQLite Cached Reading Articles Types

export interface CachedReadingArticle {
  id: string;
  topic_id: string;
  language_code: LearningLanguageCode;
  title: string;
  title_zh_tw: string;
  article_text: string;
  difficulty_level: CEFRLevel;
  estimated_reading_seconds: number;
  source_type: ArticleSource;
  content_version: number;
  status: ArticleStatus;
  published_at?: string;
  cached_at: string;
  expires_at: string;
}

export interface CachedReadingArticleSentence {
  id: string;
  article_id: string;
  sentence_order: number;
  sentence_text: string;
  sentence_zh_tw: string;
  sentence_type: SentenceType;
  estimated_duration_ms: number;
  cached_at: string;
}

export interface CachedReadingArticleLexemeLink {
  id: string;
  article_id: string;
  sentence_id: string;
  language_code: LearningLanguageCode;
  start_index: number;
  end_index: number;
  display_text: string;
  dictionary_entry_id?: string;
  phrase_priority: number;
  cached_at: string;
}

export interface CachedReadingArticleQuestion {
  id: string;
  article_id: string;
  question_order: number;
  question_type: ArticleQuestionType;
  question_text: string;
  options_json: string;
  correct_answer_json: string;
  explanation_zh_tw: string;
  cached_at: string;
}

export interface CachedReadingArticleAudioManifest {
  id: string;
  article_id: string;
  language_code: LearningLanguageCode;
  audio_manifest_json: string;
  cached_at: string;
  expires_at: string;
}

export interface CachedReadingArticleProgress {
  id: string;
  user_id: string;
  article_id: string;
  language_code: LearningLanguageCode;
  started_at: string;
  completed_at?: string;
  last_sentence_order: number;
  reading_speed?: number;
  quiz_score?: number;
  is_reward_claimed: boolean;
  is_synced: boolean;
  updated_at: string;
}

