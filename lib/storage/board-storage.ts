import { demoData, parseBoardDataWithError, writeLocal } from "../data";
import type { BoardData } from "../types";

export type StorageResult = { ok: true } | { ok: false; error: string };
export type BoardLoadResult = { data: BoardData; error?: string };

export interface BoardStorage {
  load(): BoardData;
  loadWithError(): BoardLoadResult;
  save(data: BoardData): StorageResult;
}

const storageKey = "taskboard-focus-v1";

export const localBoardStorage: BoardStorage = {
  load() {
    return this.loadWithError().data;
  },
  loadWithError() {
    if (typeof window === "undefined") return { data: demoData };
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return { data: demoData };
      const result = parseBoardDataWithError(JSON.parse(raw));
      return result.data
        ? { data: result.data }
        : {
            data: demoData,
            error: result.error || "Dữ liệu local không hợp lệ.",
          };
    } catch {
      return {
        data: demoData,
        error: "Không thể đọc dữ liệu local. Dữ liệu mẫu đang được hiển thị.",
      };
    }
  },
  save(data) {
    return writeLocal(data)
      ? { ok: true }
      : { ok: false, error: "Không thể lưu dữ liệu vào bộ nhớ trình duyệt." };
  },
};
