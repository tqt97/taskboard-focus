"use client";

import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { BoardData } from "@/lib/types";
import { localBoardStorage } from "@/lib/storage/board-storage";
import {
  indexedDbBoardStorage,
  type LocalWorkspaceSummary,
} from "@/lib/storage/indexed-db-board-storage";

export function useWorkspacePersistence({
  data,
  workspaceId,
  localWorkspaces,
  ready,
  persistenceReady,
  setSaveStatus,
  onError,
}: {
  data: BoardData;
  workspaceId: string;
  localWorkspaces: LocalWorkspaceSummary[];
  ready: boolean;
  persistenceReady: boolean;
  setSaveStatus: Dispatch<SetStateAction<"saved" | "saving" | "error">>;
  onError: (message: string) => void;
}) {
  const backupFailureNotified = useRef(false);
  useEffect(() => {
    if (!ready || !persistenceReady) return;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      const localResult = localBoardStorage.save(data, workspaceId);
      void indexedDbBoardStorage
        .saveDailyBackup(data, workspaceId)
        .then((backupSaved) => {
          if (backupSaved) {
            backupFailureNotified.current = false;
          } else if (!backupFailureNotified.current) {
            backupFailureNotified.current = true;
            onError(
              "Workspace đã lưu, nhưng chưa tạo được bản sao tự động. Hãy xuất JSON.",
            );
          }
        });
      const workspaceName =
        localWorkspaces.find((workspace) => workspace.id === workspaceId)?.name ||
        "Workspace cá nhân";
      void indexedDbBoardStorage
        .save(data, workspaceId, workspaceName)
        .then((indexedSaved) => {
          if (localResult.ok || indexedSaved) {
            setSaveStatus("saved");
            return;
          }
          setSaveStatus("error");
          onError(
            "Không thể lưu local; hãy export backup và kiểm tra dung lượng trình duyệt.",
          );
        });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [
    data,
    localWorkspaces,
    onError,
    persistenceReady,
    ready,
    setSaveStatus,
    workspaceId,
  ]);
}
