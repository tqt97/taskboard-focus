"use client";

import { useCallback, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { BoardData, TaskComment } from "@/lib/types";

type SyncTasks = (tasks: BoardData["tasks"]) => void;

/**
 * Task-level mutations that are shared by the modal and the board.
 * Keeping the persistence side effect behind this seam prevents UI components
 * from having to know whether the workspace is local-first or cloud-backed.
 */
export function useTaskMutations({
  data,
  setData,
  canEdit,
  syncTasks,
  onError,
}: {
  data: BoardData;
  setData: Dispatch<SetStateAction<BoardData>>;
  canEdit: boolean;
  syncTasks: SyncTasks;
  onError: (message: string) => void;
}) {
  const addComment = useCallback(
    (taskId: string, comment: TaskComment) => {
      if (!canEdit) {
        onError("Bạn không có quyền comment trong workspace này.");
        return;
      }
      const updatedAt = new Date().toISOString();
      const current = dataRef.current;
      const nextTasks = current.tasks.map((task) =>
        task.id !== taskId
          ? task
          : {
              ...task,
              comments: [...(task.comments || []), comment].slice(-500),
              updated_at: updatedAt,
              activity: [
                ...(task.activity || []),
                {
                  id: crypto.randomUUID(),
                  type: "updated" as const,
                  at: updatedAt,
                  summary: "Đã thêm comment",
                },
              ].slice(-200),
            },
      );
      const nextTask = nextTasks.find((task) => task.id === taskId);
      if (!nextTask) return;
      dataRef.current = { ...current, tasks: nextTasks };
      setData((latest) => ({
        ...latest,
        tasks: latest.tasks.map((task) => (task.id === taskId ? nextTask : task)),
      }));
      syncTasks([nextTask]);
    },
    [canEdit, onError, setData, syncTasks],
  );

  const toggleCommentPin = useCallback(
    (taskId: string, commentId: string) => {
      if (!canEdit) return;
      const updatedAt = new Date().toISOString();
      const current = dataRef.current;
      const tasks = current.tasks.map((task) =>
        task.id !== taskId
          ? task
          : {
              ...task,
              activity: [
                ...(task.activity || []),
                {
                  id: crypto.randomUUID(),
                  type: "updated" as const,
                  at: updatedAt,
                  summary: (task.comments || []).find(
                    (comment) => comment.id === commentId,
                  )?.pinned
                    ? "Đã bỏ ghim comment"
                    : "Đã ghim comment",
                },
              ].slice(-200),
              comments: (task.comments || []).map((comment) =>
                comment.id === commentId
                  ? { ...comment, pinned: !comment.pinned }
                  : comment,
              ),
              updated_at: updatedAt,
            },
      );
      const nextTask = tasks.find((task) => task.id === taskId);
      if (!nextTask) return;
      dataRef.current = { ...current, tasks };
      setData((latest) => ({
        ...latest,
        tasks: latest.tasks.map((task) => (task.id === taskId ? nextTask : task)),
      }));
      syncTasks([nextTask]);
    },
    [canEdit, setData, syncTasks],
  );

  const dataRef = useRef(data);
  dataRef.current = data;

  return { addComment, toggleCommentPin };
}
