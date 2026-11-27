import { boardSchemaVersion, parseBoardDataWithError } from "../data.ts";
import type { BoardData, Task } from "../types";

type ParseBoardResult = { data: BoardData | null; error?: string };

export function parseBoardBackupText(text: string): ParseBoardResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { data: null, error: "File backup không phải JSON hợp lệ." };
  }
  if (
    value &&
    typeof value === "object" &&
    "schema_version" in value &&
    value.schema_version !== 1 &&
    value.schema_version !== 2 &&
    value.schema_version !== boardSchemaVersion
  ) {
    return {
      data: null,
      error: `File không đúng schema Taskboard v1/v${boardSchemaVersion} (đang dùng ${String(value.schema_version)}).`,
    };
  }
  return parseBoardDataWithError(value);
}

export function restoreBoardSnapshot(
  snapshot: BoardData,
  currentTasks: Task[],
  timestamp: string,
) {
  const restoredTasks = snapshot.tasks.map((task) => ({
    ...task,
    updated_at: timestamp,
  }));
  const restoredIds = new Set(restoredTasks.map((task) => task.id));
  const remoteOnlyTasks = currentTasks
    .filter((task) => !restoredIds.has(task.id))
    .map((task) => ({
      ...task,
      archived_at: task.archived_at || timestamp,
      updated_at: timestamp,
    }));
  return {
    data: { ...snapshot, tasks: restoredTasks },
    restoredTasks,
    remoteOnlyTasks,
  };
}
