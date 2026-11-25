import { boardSchemaVersion, parseBoardData } from "../data";
import { supabase } from "../supabase";
import type { BoardData } from "../types";

export type SyncState =
  | { status: "local" }
  | { status: "syncing" }
  | { status: "synced"; at: string }
  | { status: "error"; message: string };

export interface TaskRepository {
  load(): Promise<BoardData>;
  save(data: BoardData): Promise<void>;
}

type SnapshotRow = { data: unknown; schema_version: number };

export function createSupabaseTaskRepository(ownerId: string): TaskRepository {
  if (!supabase) {
    throw new Error("Supabase chưa được cấu hình cho workspace này.");
  }
  const client = supabase;
  return {
    async load() {
      const { data, error } = await client
        .from("board_snapshots")
        .select("data, schema_version")
        .eq("owner_id", ownerId)
        .maybeSingle();
      if (error) throw new Error(`Không thể tải snapshot Supabase: ${error.message}`);
      if (!data) throw new Error("Workspace remote chưa có snapshot.");
      const snapshot = data as SnapshotRow;
      const parsed = parseBoardData(snapshot.data);
      if (!parsed) throw new Error("Snapshot remote không hợp lệ hoặc đã lỗi thời.");
      return parsed;
    },
    async save(board) {
      const { error } = await client.from("board_snapshots").upsert(
        {
          owner_id: ownerId,
          data: board,
          schema_version: boardSchemaVersion,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_id" },
      );
      if (error) throw new Error(`Không thể lưu snapshot Supabase: ${error.message}`);
    },
  };
}
