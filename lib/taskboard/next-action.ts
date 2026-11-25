import type { Task } from "../types";
import { getDependencyState, isOverdue, isSnoozed } from "./selectors.ts";

export type NextAction = { label: string; reason: string; score: number };

export function getNextAction(
  task: Task,
  tasks: ReadonlyArray<Task>,
  now = new Date(),
): NextAction {
  const state = getDependencyState(task, new Map(tasks.map((item) => [item.id, item])));
  if (task.status === "done")
    return { label: "Đã hoàn tất", reason: "Task đã hoàn tất", score: -1 };
  if (isSnoozed(task, now))
    return { label: "Chờ đến lúc nhắc", reason: "Task đang được hoãn", score: 0 };
  if (state === "blocked")
    return {
      label: "Gỡ dependency",
      reason: "Có dependency bị chặn hoặc không tồn tại",
      score: 1,
    };
  if (state === "waiting")
    return {
      label: "Theo dõi dependency",
      reason: "Đang chờ task phụ thuộc hoàn tất",
      score: 2,
    };
  if (task.status === "review")
    return { label: "Review task", reason: "Task đã sẵn sàng để kiểm tra", score: 5 };
  if (isOverdue(task, now))
    return { label: "Xử lý ngay", reason: "Task đã quá deadline", score: 6 };
  if (task.status === "todo")
    return { label: "Bắt đầu task", reason: "Task chưa được thực hiện", score: 4 };
  return {
    label: task.next_action?.trim() || "Tiếp tục task",
    reason: "Task đang được thực hiện",
    score: 3,
  };
}
