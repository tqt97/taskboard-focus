import type { Task } from "../types";

export function createQuickCaptureTask(
  title: string,
  tasks: Task[],
  prefix: string,
  now = new Date(),
): Task {
  const nextNumber =
    tasks.reduce((maximum, task) => {
      if (!task.code?.startsWith(prefix)) return maximum;
      const suffix = Number(task.code.slice(prefix.length));
      return Number.isInteger(suffix) ? Math.max(maximum, suffix) : maximum;
    }, 0) + 1;
  const timestamp = now.toISOString();
  return {
    id: crypto.randomUUID(),
    code: `${prefix}${nextNumber}`,
    custom_code: false,
    title: title.trim().slice(0, 500),
    description: "",
    status: "todo",
    priority: "medium",
    severity: "medium",
    assignee_ids: [],
    assignee_id: "",
    dev_up: "",
    staging_up: "",
    release_at: "",
    deadline: "",
    order_index: 0,
    links: [],
    primary_links: [],
    secondary_links: [],
    inbox: true,
    created_at: timestamp,
    updated_at: timestamp,
    activity: [
      {
        id: crypto.randomUUID(),
        type: "created",
        at: timestamp,
        summary: "Đã ghi nhanh vào Inbox",
      },
    ],
  };
}
