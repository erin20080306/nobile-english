import type { LearningRecord, User } from "@/types";
import { KEYS, storageService } from "./storageService";

type CloudUser = Pick<User, "id" | "email">;
type CloudPayload = Partial<Record<CloudStorageKey, unknown>>;

const CLOUD_STORAGE_KEYS = [
  KEYS.onboarding,
  KEYS.levelResult,
  KEYS.plan,
  KEYS.settings,
  KEYS.stats,
  KEYS.records,
  KEYS.savedWords,
  KEYS.recentSceneWords,
  KEYS.savedSentences,
  KEYS.examResults,
  KEYS.wrongQuestions,
  KEYS.sceneProgress,
  KEYS.sceneReviewCounter,
  KEYS.gardenStates,
  KEYS.themeCharacterState,
  KEYS.customScenes,
  KEYS.lastResult,
  KEYS.wordReviewMemory,
  KEYS.trialUsage,
] as const;

type CloudStorageKey = (typeof CLOUD_STORAGE_KEYS)[number];

const cloudKeySet = new Set<string>(CLOUD_STORAGE_KEYS);
const restoredUsers = new Set<string>();
let autoBackupStarted = false;
let restoring = false;
let backupTimer: number | null = null;
let backupInFlight = false;

function isBrowser() {
  return typeof window !== "undefined";
}

function currentUserFromLocal(): CloudUser | null {
  const userId = storageService.get<string>(KEYS.session, "");
  if (!userId) return null;
  const users = storageService.get<User[]>(KEYS.users, []);
  const user = users.find((item) => item.id === userId);
  if (!user?.email) return { id: userId, email: "" };
  return { id: user.id, email: user.email };
}

function recordTime(record: LearningRecord) {
  const time = new Date(record.date).getTime();
  return Number.isFinite(time) ? time : 0;
}

function mergeRecords(local: unknown, remote: unknown) {
  const byId = new Map<string, LearningRecord>();
  if (Array.isArray(remote)) {
    remote.forEach((record) => {
      if (record?.id) byId.set(String(record.id), record as LearningRecord);
    });
  }
  if (Array.isArray(local)) {
    local.forEach((record) => {
      if (record?.id) byId.set(String(record.id), record as LearningRecord);
    });
  }
  return Array.from(byId.values()).sort((a, b) => recordTime(b) - recordTime(a));
}

function collectPayload(): CloudPayload {
  const payload: CloudPayload = {};
  CLOUD_STORAGE_KEYS.forEach((key) => {
    if (storageService.has(key)) {
      payload[key] = storageService.get<unknown>(key, null);
    }
  });
  return payload;
}

function applyPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
  const data = payload as CloudPayload;
  restoring = true;
  try {
    CLOUD_STORAGE_KEYS.forEach((key) => {
      if (!(key in data)) return;
      if (key === KEYS.records) {
        const merged = mergeRecords(storageService.get<LearningRecord[]>(KEYS.records, []), data[key]);
        storageService.set(KEYS.records, merged);
        return;
      }
      storageService.set(key, data[key]);
    });
  } finally {
    restoring = false;
  }
  window.dispatchEvent(new Event("me:cloud-state-restored"));
}

async function requestJson(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Cloud app state request failed (${response.status}): ${message.slice(0, 300)}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

export const cloudAppStateService = {
  async restoreForUser(user: CloudUser): Promise<void> {
    if (!isBrowser() || !user.id) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    const params = new URLSearchParams({ userId: user.id });
    if (user.email) params.set("email", user.email);

    try {
      const body = await requestJson(`/api/account/app-state?${params.toString()}`);
      const snapshot = body.snapshot as { payload?: unknown } | null | undefined;
      if (snapshot?.payload) applyPayload(snapshot.payload);
      restoredUsers.add(user.id);
    } catch (error) {
      console.warn("[APP_STATE_RESTORE] failed", error instanceof Error ? error.message : String(error));
    }
  },

  async restoreCurrentUser(): Promise<void> {
    const user = currentUserFromLocal();
    if (!user) return;
    await this.restoreForUser(user);
  },

  async backup(user = currentUserFromLocal(), options?: { force?: boolean }): Promise<void> {
    if (!isBrowser() || !user?.id) return;
    if (!options?.force && !restoredUsers.has(user.id)) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    if (backupInFlight) return;

    backupInFlight = true;
    try {
      await requestJson("/api/account/app-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          email: user.email || "",
          payload: collectPayload(),
        }),
      });
    } catch (error) {
      console.warn("[APP_STATE_BACKUP] failed", error instanceof Error ? error.message : String(error));
    } finally {
      backupInFlight = false;
    }
  },

  scheduleBackup(delay = 1500): void {
    if (!isBrowser() || restoring) return;
    const user = currentUserFromLocal();
    if (!user || !restoredUsers.has(user.id)) return;
    if (backupTimer) window.clearTimeout(backupTimer);
    backupTimer = window.setTimeout(() => {
      backupTimer = null;
      void this.backup(user);
    }, delay);
  },

  startAutoBackup(): void {
    if (!isBrowser() || autoBackupStarted) return;
    autoBackupStarted = true;
    window.addEventListener("me:storage-changed", (event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (!key || !cloudKeySet.has(key)) return;
      this.scheduleBackup();
    });
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void this.backup(currentUserFromLocal());
    });
  },
};
