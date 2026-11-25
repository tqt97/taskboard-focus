import type { Task, TaskActivityChange } from "../types";

const fields: Array<keyof Task> = [
  "title",
  "description",
  "status",
  "priority",
  "severity",
  "deadline",
  "dev_up",
  "staging_up",
  "release_at",
  "next_action",
  "review_note",
  "assignee_ids",
  "blocked_by",
  "checklist",
  "attachments",
  "primary_links",
  "comments",
];

const stringify = (value: unknown) =>
  Array.isArray(value) ? JSON.stringify(value) : String(value ?? "");

export function diffTaskFields(
  previous: Task | undefined,
  next: Task,
): TaskActivityChange[] {
  if (!previous) return [];
  return fields.flatMap((field) => {
    const from = stringify(previous[field]);
    const to = stringify(next[field]);
    return from === to ? [] : [{ field: String(field), from, to }];
  });
}
