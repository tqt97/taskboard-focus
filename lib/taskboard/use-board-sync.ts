"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadCloudModules, isSupabaseConfigured } from "../supabase-config";
import type { SyncState } from "../repositories/task-repository";
import { fromRemoteEntityId } from "./remote-identifiers";
import type { BoardData, Member, Task } from "../types";
import { mergeConflictFields } from "./conflicts";
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
  const [conflict, setConflict] = useState<{
    local: Task;
    remote: Task;
    message: string;
  } | null>(null);
  const [conflictCount, setConflictCount] = useState(0);
  const revisionRef = useRef<string | undefined>(undefined);
  const flushQueuedTasks = useCallback(async () => {
    const { auth, repository } = await loadCloudModules();
    const user = await auth.getCurrentUser();
    if (!user) return;
    for (const item of remoteSyncQueue.listDue(new Date(), user.id)) {
      try {
        const remoteRepository = repository.createSupabaseRemoteTaskRepository(
          user.id,
          item.workspaceId === "default" ? undefined : item.workspaceId,
        );
        if (item.operation === "remove")
          await remoteRepository.remove(item.task.id, item.task.updated_at);
        else await remoteRepository.upsert(item.task, item.members);
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
    if (!isSupabaseConfigured) return;
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
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    void (async () => {
      const { auth, repository } = await loadCloudModules();
      const user = await auth.getCurrentUser();
      if (!user || cancelled) return;
      const blockedItems = remoteSyncQueue
        .listBlocked(user.id)
        .filter((item) => item.workspaceId === workspaceId);
      setConflictCount(blockedItems.length);
      const blocked = blockedItems[0];
      if (!blocked) return;
      const local = data.tasks.find((task) => task.id === blocked.task.id);
      if (!local) return;
      try {
        const remoteRepository = repository.createSupabaseRemoteTaskRepository(
          user.id,
          workspaceId === "default" ? undefined : workspaceId,
        );
        const remote = await remoteRepository.get(local.id);
        if (!cancelled && remote) {
          setConflict({
            local,
            remote,
            message: blocked.lastError || "Task đang conflict trên cloud.",
          });
        }
      } catch {
        // Keep the blocked queue item; the next online/sync attempt can retry the read.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data.tasks, workspaceId]);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let client: Awaited<ReturnType<typeof loadCloudModules>>["client"]["supabase"];
    let channel: ReturnType<NonNullable<typeof client>["channel"]> | undefined;
    let cancelled = false;
    void loadCloudModules().then(({ auth, repository, client: modules }) => {
      const cloudClient = modules.supabase;
      if (!cloudClient) return;
      client = cloudClient;
      return auth.getCurrentUser().then((user) => {
        if (!user || cancelled) return;
        const refreshRemoteTask = (id: string) => {
          void (async () => {
            try {
              const remoteRepository = repository.createSupabaseRemoteTaskRepository(
                user.id,
                workspaceId === "default" ? undefined : workspaceId,
              );
              const task = await remoteRepository.get(id);
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
        channel = cloudClient
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
    });
    return () => {
      cancelled = true;
      if (channel && client) void client.removeChannel(channel);
    };
  }, [setData, workspaceId]);
  const syncTask = useCallback(
    async (
      task: Task,
      operation: "upsert" | "remove" = "upsert",
      members: Member[] = data.members,
    ) => {
      setSyncState({ status: "syncing" });
      let ownerId = "anonymous";
      let cloudRepository:
        Awaited<ReturnType<typeof loadCloudModules>>["repository"] | null = null;
      try {
        const { auth, repository } = await loadCloudModules();
        cloudRepository = repository;
        const user = await auth.getCurrentUser();
        if (!user) throw new Error("Hãy đăng nhập Supabase trước khi đồng bộ task.");
        ownerId = user.id;
        const remoteRepository = repository.createSupabaseRemoteTaskRepository(
          user.id,
          workspaceId === "default" ? undefined : workspaceId,
        );
        if (operation === "remove")
          await remoteRepository.remove(task.id, task.updated_at);
        else await remoteRepository.upsert(task, members);
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
          members,
          ownerId,
        );
        if (isRemoteConflict(message) || isRemotePermanentError(message)) {
          const queued = remoteSyncQueue
            .listDue(new Date(), ownerId)
            .find((item) => item.key === `${workspaceId}:${task.id}`);
          if (queued) remoteSyncQueue.block(queued, message, ownerId);
          setConflictCount(
            remoteSyncQueue
              .listBlocked(ownerId)
              .filter((item) => item.workspaceId === workspaceId).length,
          );
          if (isRemoteConflict(message)) {
            try {
              const remoteRepository =
                cloudRepository?.createSupabaseRemoteTaskRepository(
                  ownerId,
                  workspaceId === "default" ? undefined : workspaceId,
                );
              const remote = remoteRepository
                ? await remoteRepository.get(task.id)
                : null;
              if (remote) setConflict({ local: task, remote, message });
            } catch {
              // The sync error remains visible even when the comparison read fails.
            }
          }
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
        const { auth, repository } = await loadCloudModules();
        const user = await auth.getCurrentUser();
        if (!user) throw new Error("Hãy đăng nhập Supabase trước khi đồng bộ.");
        const taskRepository = repository.createSupabaseTaskRepository(
          user.id,
          workspaceId === "default" ? undefined : workspaceId,
        );
        if (direction === "pull") {
          const { data: remote, revision } = await taskRepository.loadWithRevision();
          revisionRef.current = revision;
          setData(remote);
        } else {
          revisionRef.current = await taskRepository.save(data, revisionRef.current);
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
  const resolveConflict = useCallback(
    async (
      resolution: "local" | "remote" | "merge",
      remoteFields: ReadonlySet<keyof Task> = new Set(),
    ) => {
      if (!conflict) return;
      const { auth, repository } = await loadCloudModules();
      const user = await auth.getCurrentUser();
      if (!user) throw new Error("Hãy đăng nhập Supabase trước khi xử lý conflict.");
      const remoteRepository = repository.createSupabaseRemoteTaskRepository(
        user.id,
        workspaceId === "default" ? undefined : workspaceId,
      );
      const nextBase =
        resolution === "remote"
          ? conflict.remote
          : resolution === "merge"
            ? mergeConflictFields(conflict.local, conflict.remote, remoteFields)
            : { ...conflict.local, updated_at: new Date().toISOString() };
      const resolvedAt = new Date().toISOString();
      const next = {
        ...nextBase,
        updated_at: resolvedAt,
        activity: [
          ...(nextBase.activity || []),
          {
            id: crypto.randomUUID(),
            type: "updated" as const,
            at: resolvedAt,
            summary: `Đã xử lý conflict: ${resolution} bởi ${user.email || user.id}`,
          },
        ].slice(-200),
      };
      await remoteRepository.resolveConflict(next, data.members);
      remoteSyncQueue.acknowledge(`${workspaceId}:${next.id}`, user.id);
      setConflictCount((count) => Math.max(0, count - 1));
      setData((current) => ({
        ...current,
        tasks: current.tasks.some((task) => task.id === next.id)
          ? current.tasks.map((task) => (task.id === next.id ? next : task))
          : [...current.tasks, next],
      }));
      setConflict(null);
      setSyncState({ status: "synced", at: new Date().toISOString() });
    },
    [conflict, data.members, setData, workspaceId],
  );
  return {
    syncState,
    sync,
    syncTask,
    conflict,
    conflictCount,
    resolveConflict,
    dismissConflict: () => setConflict(null),
  };
}
