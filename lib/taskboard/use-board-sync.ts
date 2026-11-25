"use client";

import { useCallback, useState } from "react";
import { getCurrentUser } from "../auth";
import {
  createSupabaseTaskRepository,
  type SyncState,
} from "../repositories/task-repository";
import type { BoardData } from "../types";

export function useBoardSync(
  data: BoardData,
  setData: React.Dispatch<React.SetStateAction<BoardData>>,
) {
  const [syncState, setSyncState] = useState<SyncState>({ status: "local" });
  const sync = useCallback(
    async (direction: "pull" | "push") => {
      setSyncState({ status: "syncing" });
      try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Hãy đăng nhập Supabase trước khi đồng bộ.");
        const repository = createSupabaseTaskRepository(user.id);
        if (direction === "pull") setData(await repository.load());
        else await repository.save(data);
        setSyncState({ status: "synced", at: new Date().toISOString() });
      } catch (error) {
        setSyncState({
          status: "error",
          message: error instanceof Error ? error.message : "Đồng bộ thất bại.",
        });
      }
    },
    [data, setData],
  );
  return { syncState, sync };
}
