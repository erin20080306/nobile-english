import type {
  OnboardingProfile,
  UserSettings,
  Stats,
  LearningRecord,
  LevelTestResult,
  LearningPlan,
  EnglishLevel,
  CEFRLevel,
  LearningLanguageCode,
} from "@/types";
import { storageService, KEYS } from "./storageService";
import { getLearningLanguage, languageFromLabel } from "@/data/learningLanguages";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string) {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

function clampSpeechRate(rate?: number) {
  if (!Number.isFinite(rate)) return 1;
  return Math.max(0.75, Math.min(1.25, Number(rate)));
}

const defaultStats: Stats = {
  xp: 0,
  streak: 0,
  lastActiveDate: "",
  todayMinutes: 0,
  completedDialogues: 0,
  completedScenes: 0,
};

export const learningService = {
  // ---- Onboarding profile ----
  getProfile(): Partial<OnboardingProfile> {
    return storageService.get<Partial<OnboardingProfile>>(KEYS.onboarding, {});
  },
  saveProfile(profile: Partial<OnboardingProfile>) {
    const merged = { ...this.getProfile(), ...profile };
    storageService.set(KEYS.onboarding, merged);
  },

  // ---- Settings ----
  getSettings(userId: string): UserSettings {
    const defaults: UserSettings = {
      userId,
      targetLanguage: "en",
      speechRateByLanguage: {
        en: 1,
        ja: 0.95,
        ko: 0.95,
        it: 1,
        es: 1,
      },
      pronunciationOn: true,
      showChineseGlobal: true,
      sceneChinese: true,
      dialogueChinese: true,
      wordReviewChinese: true,
      sentenceReviewChinese: true,
      examChinese: true,
    };
    const stored = storageService.get<Partial<UserSettings>>(KEYS.settings, {});
    return {
      ...defaults,
      ...stored,
      speechRateByLanguage: {
        ...defaults.speechRateByLanguage,
        ...(stored.speechRateByLanguage || {}),
      },
      userId,
    };
  },
  saveSettings(settings: UserSettings) {
    storageService.set(KEYS.settings, settings);
  },
  getCurrentLanguage(): LearningLanguageCode {
    const stored = storageService.get<Partial<UserSettings>>(KEYS.settings, {});
    if (stored.targetLanguage) return stored.targetLanguage;
    return languageFromLabel(this.getProfile().language);
  },
  setCurrentLanguage(code: LearningLanguageCode, userId = storageService.get<string>(KEYS.session, "")) {
    const settings = this.getSettings(userId);
    this.saveSettings({ ...settings, targetLanguage: code });
    this.saveProfile({ language: getLearningLanguage(code).label });
  },
  getSpeechRate(language?: LearningLanguageCode, userId = storageService.get<string>(KEYS.session, "")): number {
    const targetLanguage = language || this.getCurrentLanguage();
    const settings = this.getSettings(userId);
    return clampSpeechRate(settings.speechRateByLanguage?.[targetLanguage] ?? 1);
  },
  setSpeechRate(language: LearningLanguageCode, rate: number, userId = storageService.get<string>(KEYS.session, "")): UserSettings {
    const settings = this.getSettings(userId);
    const next: UserSettings = {
      ...settings,
      speechRateByLanguage: {
        ...settings.speechRateByLanguage,
        [language]: clampSpeechRate(rate),
      },
    };
    this.saveSettings(next);
    return next;
  },

  // ---- Stats / streak / xp ----
  getStats(): Stats {
    return storageService.get<Stats>(KEYS.stats, defaultStats);
  },
  saveStats(stats: Stats) {
    storageService.set(KEYS.stats, stats);
  },
  touchActivity(minutes: number, xp: number) {
    const stats = this.getStats();
    const today = todayStr();
    if (stats.lastActiveDate !== today) {
      const gap = stats.lastActiveDate ? daysBetween(stats.lastActiveDate, today) : 999;
      stats.streak = gap === 1 ? stats.streak + 1 : 1;
      stats.todayMinutes = 0;
      stats.lastActiveDate = today;
    }
    stats.todayMinutes += minutes;
    stats.xp += xp;
    this.saveStats(stats);
    return stats;
  },
  addDialogue() {
    const s = this.getStats();
    s.completedDialogues += 1;
    this.saveStats(s);
  },
  addScene() {
    const s = this.getStats();
    s.completedScenes += 1;
    this.saveStats(s);
  },

  // ---- Records ----
  getRecords(): LearningRecord[] {
    return storageService.get<LearningRecord[]>(KEYS.records, []);
  },
  addRecord(rec: Omit<LearningRecord, "id" | "date">) {
    const records = this.getRecords();
    const full: LearningRecord = {
      ...rec,
      targetLanguage: rec.targetLanguage || this.getCurrentLanguage(),
      id: Math.random().toString(36).slice(2),
      date: new Date().toISOString(),
    };
    records.unshift(full);
    storageService.set(KEYS.records, records);
    return full;
  },

  // ---- Level test scoring ----
  scoreLevelTest(score: number, total: number, dailyMinutes: number): LevelTestResult {
    const pct = (score / total) * 100;
    let level: EnglishLevel = "Beginner";
    let cefr: CEFRLevel = "A1";
    if (pct >= 90) {
      level = "Advanced";
      cefr = "C1";
    } else if (pct >= 75) {
      level = "Upper-Intermediate";
      cefr = "B2";
    } else if (pct >= 60) {
      level = "Intermediate";
      cefr = "B1";
    } else if (pct >= 40) {
      level = "Elementary";
      cefr = "A2";
    } else {
      level = "Beginner";
      cefr = "A1";
    }

    const suggestionMap: Record<EnglishLevel, string> = {
      Beginner: "從生活基礎句和常用單字開始，每天累積一點點，很快就會有感覺！",
      Elementary: "你已有基礎，建議多練習日常對話與場景句型，培養語感。",
      Intermediate: "可以挑戰職場與旅遊情境，加強文法精準度與表達流暢度。",
      "Upper-Intermediate": "建議練習簡報、面試與考試題型，擴充進階詞彙。",
      Advanced: "持續挑戰談判、寫作與口說，維持高階語感與精準用字。",
    };
    const topicsMap: Record<EnglishLevel, string[]> = {
      Beginner: ["生活基礎句", "咖啡廳點餐", "打招呼", "購物"],
      Elementary: ["旅遊問路", "社交閒聊", "機場報到", "電話預約"],
      Intermediate: ["職場會議", "英文面試", "旅館入住", "客戶溝通"],
      "Upper-Intermediate": ["商務簡報", "考試英文", "客訴處理", "進階口說"],
      Advanced: ["談判", "國際會議", "英文寫作", "進階口說挑戰"],
    };

    const result: LevelTestResult = {
      userId: storageService.get<string>(KEYS.session, ""),
      score,
      total,
      level,
      cefrLevel: cefr,
      suggestion: suggestionMap[level],
      recommendedTopics: topicsMap[level],
      dailyMinutes,
      completedAt: new Date().toISOString(),
    };
    storageService.set(KEYS.levelResult, result);
    return result;
  },
  getLevelResult(): LevelTestResult | null {
    return storageService.get<LevelTestResult | null>(KEYS.levelResult, null);
  },

  // ---- Learning plan ----
  buildPlan(level: EnglishLevel, topics: string[], dailyMinutes: number): LearningPlan {
    const themeByLevel: Record<EnglishLevel, string[]> = {
      Beginner: ["daily", "cafe", "shopping", "social"],
      Elementary: ["daily", "travel", "airport", "social"],
      Intermediate: ["work", "interview", "phone", "travel"],
      "Upper-Intermediate": ["work", "interview", "exam", "phone"],
      Advanced: ["work", "exam", "interview", "phone"],
    };
    const plan: LearningPlan = {
      userId: storageService.get<string>(KEYS.session, ""),
      level,
      focusTopics: topics,
      weeklyGoalMinutes: dailyMinutes * 7,
      recommendedThemeIds: themeByLevel[level],
      createdAt: new Date().toISOString(),
    };
    storageService.set(KEYS.plan, plan);
    return plan;
  },
  getPlan(): LearningPlan | null {
    return storageService.get<LearningPlan | null>(KEYS.plan, null);
  },
};
