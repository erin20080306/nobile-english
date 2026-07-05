import type { Scene, SceneTheme } from "@/types";
import { authService } from "./authService";
import { KEYS, storageService } from "./storageService";
import type { AccessState } from "./trialAccessService";

export type TrialUsageKey =
  | "dialoguePractice"
  | "wordReview"
  | "grammarPractice"
  | "readingArticle"
  | "gardenDailyBonus"
  | "gardenPurchase"
  | "customScene";

interface TrialUsageState {
  userId: string;
  daily: Record<string, Partial<Record<TrialUsageKey, number>>>;
  lifetime: Partial<Record<TrialUsageKey, number>>;
}

export const TRIAL_DIALOGUE_DAILY_LIMIT = 2;
export const TRIAL_WORD_REVIEW_DAILY_LIMIT = 1;
export const TRIAL_GRAMMAR_PRACTICE_LIMIT = 10;
export const TRIAL_READING_ARTICLE_LIMIT = 1;
export const TRIAL_SCENES_PER_BEGINNER_THEME = 3;

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currentUserId() {
  return authService.getCurrentUser()?.id || "anonymous";
}

function blankState(userId = currentUserId()): TrialUsageState {
  return { userId, daily: {}, lifetime: {} };
}

function loadState(): TrialUsageState {
  const userId = currentUserId();
  const stored = storageService.get<TrialUsageState | null>(KEYS.trialUsage, null);
  if (!stored || stored.userId !== userId) return blankState(userId);
  return {
    userId,
    daily: stored.daily || {},
    lifetime: stored.lifetime || {},
  };
}

function saveState(state: TrialUsageState) {
  storageService.set(KEYS.trialUsage, state);
}

function isLimited(access?: AccessState | null) {
  return Boolean(access && !access.isSubscribed);
}

export const trialUsageService = {
  todayKey,
  isLimited,

  getDailyCount(key: TrialUsageKey) {
    const state = loadState();
    return state.daily[todayKey()]?.[key] || 0;
  },

  canUseDaily(key: TrialUsageKey, limit: number) {
    return this.getDailyCount(key) < limit;
  },

  useDaily(key: TrialUsageKey, limit: number) {
    if (!this.canUseDaily(key, limit)) return false;
    const state = loadState();
    const day = todayKey();
    state.daily[day] = {
      ...(state.daily[day] || {}),
      [key]: (state.daily[day]?.[key] || 0) + 1,
    };
    saveState(state);
    return true;
  },

  getLifetimeCount(key: TrialUsageKey) {
    return loadState().lifetime[key] || 0;
  },

  canUseLifetime(key: TrialUsageKey, limit: number) {
    return this.getLifetimeCount(key) < limit;
  },

  useLifetime(key: TrialUsageKey, limit: number) {
    if (!this.canUseLifetime(key, limit)) return false;
    const state = loadState();
    state.lifetime[key] = (state.lifetime[key] || 0) + 1;
    saveState(state);
    return true;
  },

  canUseScene(scene: Scene, theme: SceneTheme | undefined, indexInTheme: number) {
    return theme?.difficulty === "Beginner" && indexInTheme >= 0 && indexInTheme < TRIAL_SCENES_PER_BEGINNER_THEME;
  },
};
