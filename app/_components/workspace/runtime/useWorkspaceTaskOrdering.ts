import type { Dispatch, SetStateAction } from "react";
import type { BoardData, SortMode, Status, Task } from "@/lib/types";
import { resolveStatusTransition } from "@/lib/taskboard/status-transitions";

type Toast = (message: string) => void;

export function useWorkspaceTaskOrdering({
  canEditWorkspace,
  data,
  ordered,
  dragId,
  setData,
  setDragId,
  setSortMode,
  rememberUndo,
  syncRemoteTasks,
  setToast,
}: {
  canEditWorkspace: boolean;
  data: BoardData;
  ordered: Task[];
  dragId: string | null;
  setData: Dispatch<SetStateAction<BoardData>>;
  setDragId: Dispatch<SetStateAction<string | null>>;
  setSortMode: (mode: SortMode) => void;
  rememberUndo: (label: string) => void;
  syncRemoteTasks: (tasks: Task[]) => void;
  setToast: Toast;
}) {
  const reorder = (target: string, sourceId = dragId) => {
    if (!canEditWorkspace) {
      setToast("Bạn chỉ có quyền xem workspace này.");
      return;
    }
    if (!sourceId || sourceId === target) return;
    rememberUndo("đổi thứ tự task");
    const list = [...ordered];
    const from = list.findIndex((task) => task.id === sourceId);
    const to = list.findIndex((task) => task.id === target);
    if (from < 0 || to < 0) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    const timestamp = new Date().toISOString();
    const previousOrder = new Map(
      data.tasks.map((task) => [task.id, task.order_index]),
    );
    const nextTasks = list.map((task, index) =>
      previousOrder.get(task.id) === index
        ? { ...task, order_index: index }
        : { ...task, order_index: index, updated_at: timestamp },
    );
    setData((current) => ({ ...current, sort_mode: "manual", tasks: nextTasks }));
    syncRemoteTasks(nextTasks.filter((task) => task.updated_at === timestamp));
    setSortMode("manual");
    setDragId(null);
  };

  const dropOnStatus = (status: Status, target?: string) => {
    if (!canEditWorkspace) {
      setToast("Bạn chỉ có quyền xem workspace này.");
      return;
    }
    if (!dragId) return;
    const list = [...ordered];
    const from = list.findIndex((task) => task.id === dragId);
    if (from < 0) return;
    const source = list[from];
    const transition = resolveStatusTransition(
      source.status,
      status,
      source.blocked_from,
    );
    if (!transition.allowed) {
      setToast(`⚠️ ${transition.warning || "Không thể chuyển trạng thái task."}`);
      return;
    }
    rememberUndo(
      transition.target === "done" ? "hoàn tất task" : "chuyển trạng thái task",
    );
    const [item] = list.splice(from, 1);
    const timestamp = new Date().toISOString();
    const moved = {
      ...item,
      status: transition.target,
      snoozed_until: transition.target === "done" ? undefined : item.snoozed_until,
      ...(transition.target === "blocked"
        ? { blocked_from: transition.blocked_from }
        : { blocked_from: undefined }),
      updated_at: timestamp,
      activity:
        transition.target === item.status
          ? item.activity
          : [
              ...(item.activity || []),
              {
                id: crypto.randomUUID(),
                type: "status_changed" as const,
                at: timestamp,
                summary: transition.summary,
              },
            ].slice(-200),
    };
    let insertAt = target ? list.findIndex((task) => task.id === target) : -1;
    if (insertAt < 0) {
      const sameStatusIndexes = list
        .map((task, index) => (task.status === status ? index : -1))
        .filter((index) => index >= 0);
      insertAt = sameStatusIndexes.length
        ? sameStatusIndexes[sameStatusIndexes.length - 1] + 1
        : list.length;
    }
    list.splice(insertAt, 0, moved);
    const previousOrder = new Map(
      data.tasks.map((task) => [task.id, task.order_index]),
    );
    const nextTasks = list.map((task, index) => {
      const changed = task.id === moved.id || previousOrder.get(task.id) !== index;
      return changed
        ? { ...task, order_index: index, updated_at: timestamp }
        : { ...task, order_index: index };
    });
    setData((current) => ({ ...current, sort_mode: "manual", tasks: nextTasks }));
    syncRemoteTasks(nextTasks.filter((task) => task.updated_at === timestamp));
    setSortMode("manual");
    setDragId(null);
    setToast(status === item.status ? "Đã đổi vị trí task" : transition.summary);
  };

  const dropTask = (target: Task) => {
    if (!canEditWorkspace || !dragId || dragId === target.id) return;
    const source = ordered.find((task) => task.id === dragId);
    if (!source) return;
    source.status === target.status
      ? reorder(target.id)
      : dropOnStatus(target.status, target.id);
  };

  const moveTaskByKeyboard = (task: Task, direction: "up" | "down") => {
    if (!canEditWorkspace) {
      setToast("Bạn chỉ có quyền xem workspace này.");
      return;
    }
    const siblings = ordered.filter((candidate) => candidate.status === task.status);
    const currentIndex = siblings.findIndex((candidate) => candidate.id === task.id);
    const target = siblings[currentIndex + (direction === "up" ? -1 : 1)];
    if (!target) {
      setToast(direction === "up" ? "Task đã ở đầu cột." : "Task đã ở cuối cột.");
      return;
    }
    reorder(target.id, task.id);
    setToast(`Đã đưa ${task.code || "task"} ${direction === "up" ? "lên" : "xuống"}.`);
  };

  return { reorder, dropOnStatus, dropTask, moveTaskByKeyboard };
}
