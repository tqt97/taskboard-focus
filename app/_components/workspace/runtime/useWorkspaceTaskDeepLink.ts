"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import type { Task } from "@/lib/types";

/** Keeps task modal URLs addressable without leaking query-string logic into the runtime. */
export function useWorkspaceTaskDeepLink({
  tasks,
  ready,
  modal,
  onOpen,
  onClose,
}: {
  tasks: Task[];
  ready: boolean;
  modal: string | null;
  onOpen: (task: Task) => void;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const replaceTaskQuery = useCallback(
    (taskId?: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (taskId) params.set("task", taskId);
      else params.delete("task");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const openTask = useCallback(
    (task: Task) => {
      onOpen(task);
      replaceTaskQuery(task.id);
    },
    [onOpen, replaceTaskQuery],
  );

  const closeTask = useCallback(() => {
    onClose();
    replaceTaskQuery();
  }, [onClose, replaceTaskQuery]);

  useEffect(() => {
    if (!ready || modal) return;
    const taskId = searchParams.get("task");
    const task = tasks.find((item) => item.id === taskId);
    if (task) onOpen(task);
  }, [modal, onOpen, ready, searchParams, tasks]);

  return { openTask, closeTask };
}
