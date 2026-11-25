import type { Member, Task } from "../types";

export type QueuedTaskOperation = {
  key: string;
  ownerId: string;
  workspaceId: string;
  operation: "upsert" | "remove";
  task: Task;
  members?: Member[];
  queuedAt: string;
  attempts: number;
  nextAttemptAt: string;
  lastError?: string;
  blocked?: boolean;
};

const storageKey = (ownerId: string) =>
  `taskboard-remote-task-queue-v2:${encodeURIComponent(ownerId)}`;
const maxQueueItems = 500;
const maxBackoffMs = 15 * 60 * 1000;

export const isRemoteConflict = (message: string) =>
  /đã (được )?cập nhật|đã thay đổi/i.test(message);

export const isRemotePermanentError = (message: string) =>
  /row-level security|permission denied|not authorized|unauthorized|forbidden|không có quyền|không được phép/i.test(
    message,
  );

const readQueue = (ownerId = "anonymous"): QueuedTaskOperation[] => {
  if (typeof globalThis.window === "undefined") return [];
  try {
    const value = JSON.parse(
      globalThis.window.localStorage.getItem(storageKey(ownerId)) || "[]",
    );
    return Array.isArray(value)
      ? value.filter(
          (item): item is QueuedTaskOperation =>
            item &&
            typeof item.key === "string" &&
            typeof item.ownerId === "string" &&
            typeof item.workspaceId === "string" &&
            (item.operation === "upsert" || item.operation === "remove") &&
            item.task &&
            typeof item.task.id === "string" &&
            typeof item.queuedAt === "string" &&
            Number.isInteger(item.attempts) &&
            typeof item.nextAttemptAt === "string",
        )
      : [];
  } catch {
    return [];
  }
};

const writeQueue = (items: QueuedTaskOperation[], ownerId = "anonymous") => {
  try {
    globalThis.window.localStorage.setItem(
      storageKey(ownerId),
      JSON.stringify(items.slice(-maxQueueItems)),
    );
    return true;
  } catch {
    return false;
  }
};

export const remoteSyncQueue = {
  listDue(now = new Date(), ownerId = "anonymous"): QueuedTaskOperation[] {
    const timestamp = now.getTime();
    return readQueue(ownerId).filter(
      (item) => !item.blocked && new Date(item.nextAttemptAt).getTime() <= timestamp,
    );
  },
  enqueue(
    task: Task,
    operation: "upsert" | "remove",
    workspaceId = "default",
    now = new Date(),
    error?: string,
    members?: Member[],
    ownerId = "anonymous",
  ) {
    const items = readQueue(ownerId);
    const key = `${workspaceId}:${task.id}`;
    const existing = items.find((item) => item.key === key);
    const next: QueuedTaskOperation = {
      key,
      ownerId,
      workspaceId,
      operation,
      task,
      ...(members?.length ? { members } : {}),
      queuedAt: existing?.queuedAt || now.toISOString(),
      attempts: existing?.attempts || 0,
      nextAttemptAt: now.toISOString(),
      blocked: false,
      ...(error ? { lastError: error } : {}),
    };
    return writeQueue([...items.filter((item) => item.key !== key), next], ownerId);
  },
  acknowledge(key: string, ownerId = "anonymous") {
    return writeQueue(
      readQueue(ownerId).filter((item) => item.key !== key),
      ownerId,
    );
  },
  reschedule(
    item: QueuedTaskOperation,
    error: string,
    now = new Date(),
    ownerId = item.ownerId,
  ) {
    const attempts = item.attempts + 1;
    const delay = Math.min(1000 * 2 ** Math.min(attempts, 10), maxBackoffMs);
    const next = {
      ...item,
      attempts,
      nextAttemptAt: new Date(now.getTime() + delay).toISOString(),
      lastError: error,
      blocked: false,
    };
    return writeQueue(
      readQueue(ownerId).map((entry) => (entry.key === item.key ? next : entry)),
      ownerId,
    );
  },
  block(item: QueuedTaskOperation, error: string, ownerId = item.ownerId) {
    return writeQueue(
      readQueue(ownerId).map((entry) =>
        entry.key === item.key ? { ...entry, blocked: true, lastError: error } : entry,
      ),
      ownerId,
    );
  },
  clear(ownerId = "anonymous") {
    return writeQueue([], ownerId);
  },
};
