export type EnglishLevel =
  | "Beginner"
  | "Elementary"
  | "Intermediate"
  | "Upper-Intermediate"
  | "Advanced";

export type LearningLanguageCode = "en" | "ja" | "ko" | "it";
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
  transcript?: DialogueTranscriptLine[];
  score: number;
  completed: boolean;
  minutes: number;
  date: string;
}

export interface UserSettings {
  userId: string;
  targetLanguage: LearningLanguageCode;
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
