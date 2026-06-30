// localStorage wrapper (SSR-safe). All persistence flows through here so the
// data layer can later be swapped for Supabase / Firebase without touching UI.

const PREFIX = "me_";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export const storageService = {
  get<T>(key: string, fallback: T): T {
    if (!isBrowser()) return fallback;
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  set<T>(key: string, value: T): void {
    if (!isBrowser()) return;
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* quota or serialization error – ignore for MVP */
    }
  },

  remove(key: string): void {
    if (!isBrowser()) return;
    window.localStorage.removeItem(PREFIX + key);
  },

  clearAll(): void {
    if (!isBrowser()) return;
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => window.localStorage.removeItem(k));
  },
};

export const KEYS = {
  users: "users",
  session: "session",
  onboarding: "onboarding",
  levelResult: "levelResult",
  plan: "plan",
  settings: "settings",
  stats: "stats",
  records: "records",
  savedWords: "savedWords",
  recentSceneWords: "recentSceneWords",
  savedSentences: "savedSentences",
  examResults: "examResults",
  wrongQuestions: "wrongQuestions",
  sceneProgress: "sceneProgress",
  sceneReviewCounter: "sceneReviewCounter",
  gardenStates: "gardenStates",
  customScenes: "customScenes",
  lastResult: "lastResult",
  feedbackReports: "feedbackReports",
  wordReviewMemory: "wordReviewMemory",
  deviceId: "deviceId",
} as const;
