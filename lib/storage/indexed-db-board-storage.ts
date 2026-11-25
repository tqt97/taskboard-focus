import { parseBoardData } from "../data";
import type { BoardData } from "../types";

const databaseName = "taskboard-focus-v2";
const storeName = "workspace";
const legacyRecordKey = "current";
const defaultWorkspaceId = "default";
let writeQueue: Promise<boolean> = Promise.resolve(true);

export type LocalWorkspaceSummary = {
  id: string;
  name: string;
  updatedAt: string;
};
type WorkspaceRecord = LocalWorkspaceSummary & { data: BoardData };

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
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName);
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
