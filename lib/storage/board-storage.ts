import { demoData, parseBoardDataWithError } from "../data.ts";
import type { BoardData } from "../types";

export type StorageResult = { ok: true } | { ok: false; error: string };
export type BoardLoadResult = { data: BoardData; error?: string };

export interface BoardStorage {
  load(workspaceId?: string): BoardData;
  loadWithError(workspaceId?: string): BoardLoadResult;
  save(data: BoardData, workspaceId?: string): StorageResult;
}

const storageKey = "taskboard-focus-v1";
const scopedStorageKey = (workspaceId: string) => `${storageKey}:${workspaceId}`;

export const localBoardStorage: BoardStorage = {
  load(workspaceId = "default") {
    return this.loadWithError(workspaceId).data;
  },
  loadWithError(workspaceId = "default") {
    if (typeof window === "undefined") return { data: demoData };
    try {
      const scoped = window.localStorage.getItem(scopedStorageKey(workspaceId));
      const legacy =
        workspaceId === "default" ? window.localStorage.getItem(storageKey) : null;
      const raw = scoped || legacy;
      if (!raw) return { data: demoData };
      const result = parseBoardDataWithError(JSON.parse(raw));
      if (!result.data)
        return { data: demoData, error: result.error || "Dữ liệu local không hợp lệ." };
      if (!scoped && legacy) {
        try {
          window.localStorage.setItem(scopedStorageKey(workspaceId), legacy);
        } catch {}
      }
      return { data: result.data };
    } catch {
      return {
        data: demoData,
        error: "Không thể đọc dữ liệu local. Dữ liệu mẫu đang được hiển thị.",
      };
    }
  },
  save(data, workspaceId = "default") {
    try {
      window.localStorage.setItem(scopedStorageKey(workspaceId), JSON.stringify(data));
      return { ok: true };
    } catch {
      return { ok: false, error: "Không thể lưu dữ liệu vào bộ nhớ trình duyệt." };
    }
  },
};
