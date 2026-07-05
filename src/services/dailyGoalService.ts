// Daily practice goals: lets learners pick how many word review / scene /
// dialogue sessions they want to complete each day, tracks actual progress
// in Supabase (via /api/daily-goals), and shows a "yesterday" recap the next
// time they log in.

import { KEYS, storageService } from "./storageService";

export type DailyGoalKind = "wordReview" | "scene" | "dialogue";

export interface DailyGoalRow {
  user_id: string;
  date: string;
  word_review_target: number;
  scene_target: number;
  dialogue_target: number;
  word_review_count: number;
  scene_count: number;
  dialogue_count: number;
}

interface DailyGoalCardState {
  dismissedForDate?: string;
  yesterdaySeenForDate?: string;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getCardState(): DailyGoalCardState {
  return storageService.get<DailyGoalCardState>(KEYS.dailyGoalCardState, {});
}

function setCardState(patch: Partial<DailyGoalCardState>) {
  storageService.set(KEYS.dailyGoalCardState, { ...getCardState(), ...patch });
}

export const dailyGoalService = {
  async fetchState(userId: string): Promise<{ today: DailyGoalRow | null; yesterday: DailyGoalRow | null }> {
    if (!isBrowser() || !userId) return { today: null, yesterday: null };
    try {
      const response = await fetch(`/api/daily-goals?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) return { today: null, yesterday: null };
      const data = await response.json();
      const state = { today: data.today || null, yesterday: data.yesterday || null };
      storageService.set(KEYS.dailyGoalCache, state);
      return state;
    } catch {
      return storageService.get(KEYS.dailyGoalCache, { today: null, yesterday: null });
    }
  },

  async setTargets(
    userId: string,
    targets: { wordReview: number; scene: number; dialogue: number }
  ): Promise<DailyGoalRow | null> {
    if (!isBrowser() || !userId) return null;
    try {
      const response = await fetch("/api/daily-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "setTargets", targets }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.today || null;
    } catch {
      return null;
    }
  },

  incrementProgress(userId: string, kind: DailyGoalKind): void {
    if (!isBrowser() || !userId) return;
    void fetch("/api/daily-goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "increment", kind }),
    }).catch(() => {
      /* best-effort; local stats already recorded via learningService */
    });
  },

  // ---- Dashboard card visibility ----
  isDismissedToday(): boolean {
    return getCardState().dismissedForDate === todayStr();
  },
  dismissToday(): void {
    setCardState({ dismissedForDate: todayStr() });
  },
  hasSeenYesterdayRecap(): boolean {
    return getCardState().yesterdaySeenForDate === todayStr();
  },
  markYesterdayRecapSeen(): void {
    setCardState({ yesterdaySeenForDate: todayStr() });
  },
};
