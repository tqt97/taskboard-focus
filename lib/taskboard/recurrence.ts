import type { RecurrenceRule, Task } from "../types";

export const getNextOccurrence = (date: string, rule: RecurrenceRule) => {
  const next = new Date(date);
  if (!Number.isFinite(next.getTime())) return null;
  if (rule.frequency === "daily") next.setDate(next.getDate() + rule.interval);
  if (rule.frequency === "weekly") next.setDate(next.getDate() + rule.interval * 7);
  if (rule.frequency === "monthly") {
    const originalDay = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + rule.interval);
    const lastDayOfTargetMonth = new Date(
      next.getFullYear(),
      next.getMonth() + 1,
      0,
    ).getDate();
    next.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  }
  if (rule.until && next > new Date(rule.until)) return null;
  return next.toISOString();
};

export const createNextRecurringTask = (task: Task, now = new Date()): Task | null => {
  if (!task.recurrence || task.status !== "done") return null;
  const nextDeadline = getNextOccurrence(
    task.deadline || now.toISOString(),
    task.recurrence,
  );
  if (!nextDeadline) return null;
  const timestamp = now.toISOString();
  return {
    ...task,
    id: crypto.randomUUID(),
    code: `${task.code}-NEXT`,
    status: "todo",
    deadline: nextDeadline,
    dev_up: "",
    staging_up: "",
    release_at: "",
    order_index: task.order_index + 1,
    created_at: timestamp,
    updated_at: timestamp,
    activity: [
      {
        id: crypto.randomUUID(),
        type: "created",
        at: timestamp,
        summary: `Tạo từ task lặp lại ${task.code}`,
      },
    ],
  };
};
