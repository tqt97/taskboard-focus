import type { Task } from "../types";
import { getDependencyState, isOverdue, isSnoozed } from "./selectors.ts";

export type NextActionKey =
  | "done"
  | "snoozed"
  | "resolve_dependency"
  | "follow_dependency"
  | "review"
  | "overdue"
  | "start"
  | "continue";
export type NextAction = { key: NextActionKey; score: number };

export function getNextAction(
  task: Task,
  tasks: ReadonlyArray<Task>,
  now = new Date(),
): NextAction {
  const state = getDependencyState(task, new Map(tasks.map((item) => [item.id, item])));
  if (task.status === "done") return { key: "done", score: -1 };
  if (isSnoozed(task, now)) return { key: "snoozed", score: 0 };
  if (task.status === "blocked") return { key: "resolve_dependency", score: 1 };
  if (state === "blocked") return { key: "resolve_dependency", score: 1 };
  if (state === "waiting") return { key: "follow_dependency", score: 2 };
  if (task.status === "review") return { key: "review", score: 5 };
  if (isOverdue(task, now)) return { key: "overdue", score: 6 };
  if (task.status === "todo") return { key: "start", score: 4 };
  return { key: "continue", score: 3 };
}
