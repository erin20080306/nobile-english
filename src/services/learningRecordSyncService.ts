import type { LearningRecord } from "@/types";
import { KEYS, storageService } from "./storageService";

type SyncQueue = Record<string, LearningRecord>;

function isBrowser() {
  return typeof window !== "undefined";
}

function currentUserId() {
  return storageService.get<string>(KEYS.session, "");
}

function queueRecord(record: LearningRecord) {
  const queue = storageService.get<SyncQueue>(KEYS.learningRecordSyncQueue, {});
  storageService.set(KEYS.learningRecordSyncQueue, { ...queue, [record.id]: record });
}

function clearQueued(ids: string[]) {
  if (!ids.length) return;
  const queue = storageService.get<SyncQueue>(KEYS.learningRecordSyncQueue, {});
  const next = { ...queue };
  ids.forEach((id) => delete next[id]);
  storageService.set(KEYS.learningRecordSyncQueue, next);
}

async function postRecords(userId: string, records: LearningRecord[]) {
  const response = await fetch("/api/learning-records/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, records }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Learning record sync failed (${response.status}): ${message.slice(0, 300)}`);
  }

  return response.json() as Promise<{ syncedIds?: string[] }>;
}

export const learningRecordSyncService = {
  syncRecord(record: LearningRecord, userId = currentUserId()): void {
    if (!isBrowser() || !userId) return;
    queueRecord(record);
    void this.flush(userId);
  },

  async flush(userId = currentUserId()): Promise<void> {
    if (!isBrowser() || !userId) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    const queue = storageService.get<SyncQueue>(KEYS.learningRecordSyncQueue, {});
    const records = Object.values(queue);
    if (!records.length) return;

    try {
      const result = await postRecords(userId, records);
      clearQueued(result.syncedIds?.length ? result.syncedIds : records.map((record) => record.id));
    } catch (error) {
      console.warn("[LEARNING_SYNC] failed", error instanceof Error ? error.message : String(error));
    }
  },

  async syncAll(records: LearningRecord[], userId = currentUserId()): Promise<void> {
    if (!isBrowser() || !userId || !records.length) return;
    records.forEach(queueRecord);
    await this.flush(userId);
  },
};
