import type { DependencyState, Task } from "../types";

export const isArchived = (task: Task) => Boolean(task.archived_at);

export const isDraft = (task: Task) => task.is_draft === true;

export const getActiveTasks = (tasks: Task[]) =>
  tasks.filter((task) => !isArchived(task));

const sameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export const isDueToday = (task: Task, now = new Date()) =>
  Boolean(task.deadline) && sameDay(new Date(task.deadline), now);

export const isOverdue = (task: Task, now = new Date()) =>
  Boolean(task.deadline) &&
  new Date(task.deadline).getTime() < now.getTime() &&
  task.status !== "done";

export const isSnoozed = (task: Task, now = new Date()) =>
  task.status !== "done" &&
  Boolean(task.snoozed_until) &&
  new Date(task.snoozed_until as string).getTime() > now.getTime();

export const getDependencyState = (
  task: Task,
  tasksById: ReadonlyMap<string, Task>,
): DependencyState => {
  const dependencies = (task.blocked_by || []).map((id) => tasksById.get(id));
  if (!dependencies.length) return "ready";
  if (
    dependencies.some((dependency) => !dependency || dependency.status === "blocked")
  ) {
    return "blocked";
  }
  return dependencies.every((dependency) => dependency?.status === "done")
    ? "ready"
    : "waiting";
};

export const getTodayTasks = (tasks: Task[], now = new Date()) => {
  const active = getActiveTasks(tasks).filter(
    (task) =>
      task.status !== "done" &&
      !isDraft(task) &&
      !isSnoozed(task, now) &&
      (isDueToday(task, now) || isOverdue(task, now) || task.priority === "urgent"),
  );
  return [...active].sort(
    (a, b) =>
      Number(isOverdue(b, now)) - Number(isOverdue(a, now)) ||
      Number(b.priority === "urgent") - Number(a.priority === "urgent") ||
      new Date(a.deadline || "9999-12-31").getTime() -
        new Date(b.deadline || "9999-12-31").getTime(),
  );
};
