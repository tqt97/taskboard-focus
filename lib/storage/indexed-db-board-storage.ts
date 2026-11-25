import { parseBoardData } from "../data";
import type { BoardData } from "../types";

const databaseName = "taskboard-focus-v2";
const storeName = "workspace";
const backupStoreName = "daily-backups";
const legacyRecordKey = "current";
const defaultWorkspaceId = "default";
let writeQueue: Promise<boolean> = Promise.resolve(true);

export type LocalWorkspaceSummary = {
  id: string;
  name: string;
  updatedAt: string;
};
type WorkspaceRecord = LocalWorkspaceSummary & { data: BoardData };
export type LocalBackupSummary = { key: string; createdAt: string };
type LocalBackupRecord = LocalBackupSummary & {
  workspaceId: string;
  data: BoardData;
};

const requestResult = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("IndexedDB request failed"));
  });

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB không khả dụng."));
      return;
    }
    const request = indexedDB.open(databaseName, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName);
      }
      if (!request.result.objectStoreNames.contains(backupStoreName)) {
        request.result.createObjectStore(backupStoreName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Không thể mở IndexedDB."));
  });

export const indexedDbBoardStorage = {
  async load(workspaceId = defaultWorkspaceId): Promise<BoardData | null> {
    try {
      await writeQueue;
      const database = await openDatabase();
      const value = await requestResult(
        database
          .transaction(storeName, "readonly")
          .objectStore(storeName)
          .get(workspaceId),
      );
      database.close();
      const record = value as Partial<WorkspaceRecord> | undefined;
      if (record?.data) return parseBoardData(record.data);
      return workspaceId === defaultWorkspaceId
        ? indexedDbBoardStorage.readLegacyRecord()
        : null;
    } catch {
      return null;
    }
  },
  save(
    data: BoardData,
    workspaceId = defaultWorkspaceId,
    name = "Workspace cá nhân",
  ): Promise<boolean> {
    const nextWrite = writeQueue.then(async () => {
      try {
        const database = await openDatabase();
        const record: WorkspaceRecord = {
          id: workspaceId,
          name,
          updatedAt: new Date().toISOString(),
          data,
        };
        await requestResult(
          database
            .transaction(storeName, "readwrite")
            .objectStore(storeName)
            .put(record, workspaceId),
        );
        database.close();
        return true;
      } catch {
        return false;
      }
    });
    writeQueue = nextWrite.catch(() => false);
    return nextWrite;
  },
  async list(): Promise<LocalWorkspaceSummary[]> {
    try {
      await writeQueue;
      const database = await openDatabase();
      const values = await requestResult(
        database.transaction(storeName, "readonly").objectStore(storeName).getAll(),
      );
      database.close();
      const summaries = (values as Array<Partial<WorkspaceRecord>>)
        .filter((value) => value && typeof value.id === "string" && value.data)
        .map((value) => ({
          id: value.id as string,
          name: typeof value.name === "string" ? value.name : "Workspace",
          updatedAt:
            typeof value.updatedAt === "string"
              ? value.updatedAt
              : new Date(0).toISOString(),
        }));
      if (!summaries.some((summary) => summary.id === defaultWorkspaceId)) {
        const legacy = await indexedDbBoardStorage.readLegacyRecord();
        if (legacy) {
          summaries.unshift({
            id: defaultWorkspaceId,
            name: "Workspace cá nhân",
            updatedAt: new Date().toISOString(),
          });
        }
      }
      return summaries;
    } catch {
      return [];
    }
  },
  async saveDailyBackup(
    data: BoardData,
    workspaceId = defaultWorkspaceId,
  ): Promise<boolean> {
    try {
      const database = await openDatabase();
      const localNow = new Date();
      const date = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, "0")}-${String(localNow.getDate()).padStart(2, "0")}`;
      const key = `${workspaceId}:${date}`;
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(backupStoreName, "readwrite");
        const backups = transaction.objectStore(backupStoreName);
        const existing = backups.get(key);
        existing.onsuccess = () => {
          if (!existing.result) {
            backups.put(
              { key, workspaceId, createdAt: new Date().toISOString(), data },
              key,
            );
          }
          const all = backups.getAll();
          all.onsuccess = () => {
            const own = (all.result as LocalBackupRecord[])
              .filter((record) => record.workspaceId === workspaceId)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            own.slice(7).forEach((record) => backups.delete(record.key));
          };
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      database.close();
      return true;
    } catch {
      return false;
    }
  },
  async listBackups(workspaceId = defaultWorkspaceId): Promise<LocalBackupSummary[]> {
    try {
      await writeQueue;
      const database = await openDatabase();
      const records = (await requestResult(
        database
          .transaction(backupStoreName, "readonly")
          .objectStore(backupStoreName)
          .getAll(),
      )) as LocalBackupRecord[];
      database.close();
      return records
        .filter((record) => record.workspaceId === workspaceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(({ key, createdAt }) => ({ key, createdAt }));
    } catch {
      return [];
    }
  },
  async loadBackup(key: string): Promise<LocalBackupRecord | null> {
    try {
      const database = await openDatabase();
      const record = (await requestResult(
        database
          .transaction(backupStoreName, "readonly")
          .objectStore(backupStoreName)
          .get(key),
      )) as LocalBackupRecord | undefined;
      database.close();
      if (!record?.data) return null;
      const parsed = parseBoardData(record.data);
      return parsed ? { ...record, data: parsed } : null;
    } catch {
      return null;
    }
  },
  async readLegacyRecord(): Promise<BoardData | null> {
    try {
      const database = await openDatabase();
      const value = await requestResult(
        database
          .transaction(storeName, "readonly")
          .objectStore(storeName)
          .get(legacyRecordKey),
      );
      database.close();
      return parseBoardData(value);
    } catch {
      return null;
    }
  },
};
