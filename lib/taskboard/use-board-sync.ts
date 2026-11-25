"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentUser } from "../auth";
import {
  createSupabaseRemoteTaskRepository,
  createSupabaseTaskRepository,
  fromRemoteEntityId,
  type SyncState,
} from "../repositories/task-repository";
import { supabase } from "../supabase";
import type { BoardData, Task } from "../types";
import {
  isRemoteConflict,
  isRemotePermanentError,
  remoteSyncQueue,
} from "./remote-sync-queue";

export function useBoardSync(
  data: BoardData,
  setData: React.Dispatch<React.SetStateAction<BoardData>>,
  workspaceId = "default",
) {
  const [syncState, setSyncState] = useState<SyncState>({ status: "local" });
  const revisionRef = useRef<string | undefined>(undefined);
  const flushQueuedTasks = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user) return;
    for (const item of remoteSyncQueue.listDue(new Date(), user.id)) {
      try {
        const repository = createSupabaseRemoteTaskRepository(
          user.id,
          item.workspaceId === "default" ? undefined : item.workspaceId,
        );
        if (item.operation === "remove")
          await repository.remove(item.task.id, item.task.updated_at);
        else await repository.upsert(item.task, item.members);
        remoteSyncQueue.acknowledge(item.key, user.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Đồng bộ task thất bại.";
        if (isRemoteConflict(message) || isRemotePermanentError(message))
          remoteSyncQueue.block(item, message, user.id);
        else remoteSyncQueue.reschedule(item, message, new Date(), user.id);
      }
    }
  }, [workspaceId]);
  useEffect(() => {
    if (!supabase) return;
    const flush = () => void flushQueuedTasks();
    flush();
    window.addEventListener("online", flush);
    const timer = window.setInterval(flush, 30000);
    return () => {
      window.removeEventListener("online", flush);
      window.clearInterval(timer);
    };
  }, [flushQueuedTasks]);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let channel: ReturnType<typeof client.channel> | undefined;
    let cancelled = false;
    void getCurrentUser().then((user) => {
      if (!user || cancelled) return;
      const refreshRemoteTask = (id: string) => {
        void (async () => {
          try {
            const repository = createSupabaseRemoteTaskRepository(
              user.id,
              workspaceId === "default" ? undefined : workspaceId,
            );
            const task = await repository.get(id);
            if (cancelled || !task?.title) return;
            setData((current) => ({
              ...current,
              tasks: current.tasks.some((item) => item.id === task.id)
                ? current.tasks.map((item) => {
                    if (item.id !== task.id) return item;
                    const localTime = new Date(item.updated_at).getTime();
                    const remoteTime = new Date(task.updated_at).getTime();
                    return localTime > remoteTime ? item : { ...item, ...task };
                  })
                : [...current.tasks, task],
            }));
          } catch {
            // A transient read failure will be recovered by the next realtime event or Pull.
          }
        })();
      };
      channel = client
        .channel(`taskboard-tasks-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tasks",
            filter:
              workspaceId === "default"
                ? `owner_id=eq.${user.id}`
                : `workspace_id=eq.${workspaceId}`,
          },
          (payload) => {
            if (payload.eventType === "DELETE") {
              const old = payload.old as { id?: string; updated_at?: string };
              const id = fromRemoteEntityId(
                String(old.id || ""),
                user.id,
                workspaceId === "default" ? undefined : workspaceId,
              );
              if (id)
                setData((current) => {
                  const localTask = current.tasks.find((task) => task.id === id);
                  const localTime = localTask
                    ? new Date(localTask.updated_at).getTime()
                    : 0;
                  const remoteTime = old.updated_at
                    ? new Date(old.updated_at).getTime()
                    : Number.MAX_SAFE_INTEGER;
                  return localTask && localTime > remoteTime
                    ? current
                    : {
                        ...current,
                        tasks: current.tasks.filter((task) => task.id !== id),
                      };
                });
              return;
            }
            const id = String((payload.new as { id?: string }).id || "");
            if (!id) return;
            refreshRemoteTask(id);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "task_assignees",
          },
          (payload) => {
            const next = payload.new as { task_id?: string };
            const previous = payload.old as { task_id?: string };
            const id = String(next.task_id || previous.task_id || "");
            if (!id) return;
            refreshRemoteTask(id);
          },
        )
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) void client.removeChannel(channel);
    };
  }, [setData, workspaceId]);
  const syncTask = useCallback(
    async (task: Task, operation: "upsert" | "remove" = "upsert") => {
      setSyncState({ status: "syncing" });
      let ownerId = "anonymous";
      try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Hãy đăng nhập Supabase trước khi đồng bộ task.");
        ownerId = user.id;
        const repository = createSupabaseRemoteTaskRepository(
          user.id,
          workspaceId === "default" ? undefined : workspaceId,
        );
        if (operation === "remove") await repository.remove(task.id, task.updated_at);
        else await repository.upsert(task, data.members);
        remoteSyncQueue.acknowledge(`${workspaceId}:${task.id}`, ownerId);
        setSyncState({ status: "synced", at: new Date().toISOString() });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Đồng bộ task thất bại.";
        if (ownerId === "anonymous") {
          setSyncState({ status: "error", message });
          return;
        }
        remoteSyncQueue.enqueue(
          task,
          operation,
          workspaceId,
          new Date(),
          message,
          data.members,
          ownerId,
        );
        if (isRemoteConflict(message) || isRemotePermanentError(message)) {
          const queued = remoteSyncQueue
            .listDue(new Date(), ownerId)
            .find((item) => item.key === `${workspaceId}:${task.id}`);
          if (queued) remoteSyncQueue.block(queued, message, ownerId);
        }
        setSyncState({
          status: "error",
          message: isRemoteConflict(message)
            ? `${message} Queue đã tạm dừng; hãy Pull phiên bản mới rồi lưu lại.`
            : isRemotePermanentError(message)
              ? `${message} Queue đã tạm dừng; hãy kiểm tra quyền workspace rồi thử lại.`
              : `${message} Thao tác đã được xếp hàng để thử lại.`,
        });
      }
    },
    [data.members, workspaceId],
  );
  const sync = useCallback(
    async (direction: "pull" | "push") => {
      setSyncState({ status: "syncing" });
      try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Hãy đăng nhập Supabase trước khi đồng bộ.");
        const repository = createSupabaseTaskRepository(
          user.id,
          workspaceId === "default" ? undefined : workspaceId,
        );
        if (direction === "pull") {
          const { data: remote, revision } = await repository.loadWithRevision();
          revisionRef.current = revision;
          setData(remote);
        } else {
          revisionRef.current = await repository.save(data, revisionRef.current);
        }
        setSyncState({ status: "synced", at: new Date().toISOString() });
      } catch (error) {
        setSyncState({
          status: "error",
          message: error instanceof Error ? error.message : "Đồng bộ thất bại.",
        });
      }
    },
    [data, setData, workspaceId],
  );
  return { syncState, sync, syncTask };
}
