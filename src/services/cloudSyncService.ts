import type { LearningRecord, User } from "@/types";
import { KEYS, setStorageSyncHook, storageService } from "./storageService";
import { supabaseBrowserClient } from "./supabaseBrowserClient";

// Generic per-key cloud sync for real (Supabase Auth) accounts. Local-only
// demo/email accounts are untouched — this only activates once a Supabase
// Auth session exists (see authService.hydrateFromSupabaseSession).

const PROFILE_KEY = "profile";

const SYNC_KEYS: string[] = [
  KEYS.onboarding,
  KEYS.levelResult,
  KEYS.plan,
  KEYS.settings,
  KEYS.stats,
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
  KEYS.customScenePlanCache,
  KEYS.lastResult,
  KEYS.feedbackReports,
  KEYS.wordReviewMemory,
  // Redundant backup of the full practice-history array. The dedicated
  // learning_records table sync (learningRecordSyncService) is queued and
  // can be lost if the app/local storage is wiped before it flushes (e.g.
  // iOS "Add to Home Screen" apps wipe local storage when the icon is
  // deleted). Mirroring KEYS.records here means it also rides the generic
  // per-key sync hook, which fires synchronously on every addRecord() call.
  KEYS.records,
];

let activeUserId: string | null = null;
let hydrating = false;
let hookRegistered = false;

async function pushKey(userId: string, key: string, value: unknown): Promise<void> {
  if (!supabaseBrowserClient || !userId || value === null || value === undefined) return;
  try {
    const { error } = await supabaseBrowserClient.from("user_app_data").upsert({
      user_id: userId,
      data_key: key,
      data_value: value,
      updated_at: new Date().toISOString(),
    });
    if (error) console.warn("[CLOUD_SYNC] push failed", key, error.message);
  } catch (error) {
    console.warn("[CLOUD_SYNC] push threw", key, error instanceof Error ? error.message : error);
  }
}

function mapRecordFromDb(row: Record<string, unknown>): LearningRecord {
  return {
    id: String(row.id),
    type: row.type as LearningRecord["type"],
    targetLanguage: (row.target_language as LearningRecord["targetLanguage"]) || undefined,
    title: String(row.title || ""),
    sceneName: (row.scene_name as string) || undefined,
    enContent: (row.en_content as string) || undefined,
    zhContent: (row.zh_content as string) || undefined,
    userAnswer: (row.user_answer as string) || undefined,
    suggestion: (row.suggestion as string) || undefined,
    conversationWords: Array.isArray(row.conversation_words)
      ? (row.conversation_words as string[])
      : undefined,
    transcript: Array.isArray(row.transcript)
      ? (row.transcript as LearningRecord["transcript"])
      : undefined,
    score: Number(row.score) || 0,
    completed: Boolean(row.completed),
    minutes: Number(row.minutes) || 0,
    date: String(row.date),
  };
}

export const cloudSyncService = {
  SYNC_KEYS,

  init(): void {
    if (hookRegistered || typeof window === "undefined") return;
    hookRegistered = true;
    setStorageSyncHook((key, value) => {
      if (hydrating || !activeUserId) return;
      if (!SYNC_KEYS.includes(key)) return;
      void pushKey(activeUserId, key, value);
    });
  },

  setActiveUser(userId: string | null): void {
    activeUserId = userId;
  },

  async pushProfile(userId: string, user: User): Promise<void> {
    const { password: _password, ...safe } = user;
    void _password;
    await pushKey(userId, PROFILE_KEY, safe);
  },

  async pullProfile(userId: string): Promise<User | null> {
    if (!supabaseBrowserClient || !userId) return null;
    const { data, error } = await supabaseBrowserClient
      .from("user_app_data")
      .select("data_value")
      .eq("user_id", userId)
      .eq("data_key", PROFILE_KEY)
      .maybeSingle();
    if (error || !data) return null;
    return data.data_value as User;
  },

  // Pushes everything currently on this device up to the cloud account.
  // Used the first time a real account logs in on a device that already had
  // local (possibly demo/local-only) data worth keeping.
  async pushAll(userId: string): Promise<void> {
    if (!supabaseBrowserClient || !userId) return;
    for (const key of SYNC_KEYS) {
      const value = storageService.get<unknown>(key, null);
      if (value !== null) await pushKey(userId, key, value);
    }
    const records = storageService.get<LearningRecord[]>(KEYS.records, []);
    if (records.length) {
      const { learningRecordSyncService } = await import("./learningRecordSyncService");
      await learningRecordSyncService.syncAll(records, userId);
    }
  },

  // Pulls everything from the cloud account down into localStorage. Returns
  // true if the account already had cloud data (returning user), false if
  // this is the account's first ever sync (nothing to restore yet).
  async pullAll(userId: string): Promise<boolean> {
    if (!supabaseBrowserClient || !userId) return false;
    hydrating = true;
    let foundAny = false;
    try {
      const { data, error } = await supabaseBrowserClient
        .from("user_app_data")
        .select("data_key, data_value")
        .eq("user_id", userId);
      if (!error && data) {
        data.forEach((row) => {
          if (row.data_key === PROFILE_KEY) return;
          foundAny = true;
          storageService.set(row.data_key as string, row.data_value, { skipSync: true });
        });
      }

      // Always pull from learning_records table to ensure all practice records
      // (scene, dialogue, exam, word) are restored. This is the authoritative
      // source for learning history, not user_app_data.
      const { data: records, error: recordsError } = await supabaseBrowserClient
        .from("learning_records")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(1000);
      if (!recordsError && records?.length) {
        foundAny = true;
        const cloudRecords = records.map(mapRecordFromDb);
        // Merge with local records to avoid losing any unsynced local data
        const localRecords = storageService.get<LearningRecord[]>(KEYS.records, []);
        const mergedRecords = this.mergeRecords(cloudRecords, localRecords);
        storageService.set(KEYS.records, mergedRecords, { skipSync: true });
      }
    } catch (error) {
      console.warn("[CLOUD_SYNC] pull failed", error instanceof Error ? error.message : error);
    } finally {
      hydrating = false;
    }
    return foundAny;
  },

  // Merge cloud and local records, keeping the most recent version of each record
  // by ID. This ensures local unsynced records are not lost when pulling from cloud.
  mergeRecords(cloudRecords: LearningRecord[], localRecords: LearningRecord[]): LearningRecord[] {
    const recordMap = new Map<string, LearningRecord>();
    // Add cloud records first
    cloudRecords.forEach((record) => recordMap.set(record.id, record));
    // Override with local records if they are newer (by date)
    localRecords.forEach((record) => {
      const existing = recordMap.get(record.id);
      if (!existing || record.date > existing.date) {
        recordMap.set(record.id, record);
      }
    });
    // Convert back to array and sort by date descending
    return Array.from(recordMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  },
};
