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

async function fetchRemoteRecords(userId: string) {
  const params = new URLSearchParams({ userId });
  const response = await fetch(`/api/learning-records/sync?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Learning record restore failed (${response.status}): ${message.slice(0, 300)}`);
  }

  const body = (await response.json()) as { records?: LearningRecord[] };
  return Array.isArray(body.records) ? body.records : [];
}

function recordTime(record: LearningRecord) {
  const time = new Date(record.date).getTime();
  return Number.isFinite(time) ? time : 0;
}

function mergeRecords(local: LearningRecord[], remote: LearningRecord[]) {
  const byId = new Map<string, LearningRecord>();
  remote.forEach((record) => {
    if (record?.id) byId.set(record.id, record);
  });
  local.forEach((record) => {
    if (record?.id) byId.set(record.id, record);
  });
  return Array.from(byId.values()).sort((a, b) => recordTime(b) - recordTime(a));
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

  async restore(userId = currentUserId()): Promise<LearningRecord[]> {
    const local = storageService.get<LearningRecord[]>(KEYS.records, []);
    if (!isBrowser() || !userId) return local;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return local;

    try {
      const remote = await fetchRemoteRecords(userId);
      const merged = mergeRecords(local, remote);
      storageService.set(KEYS.records, merged);
      return merged;
    } catch (error) {
      console.warn("[LEARNING_RESTORE] failed", error instanceof Error ? error.message : String(error));
      return local;
    }
  },
};
