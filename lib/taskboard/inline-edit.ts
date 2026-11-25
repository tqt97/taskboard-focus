import type { Task } from "../types";

export function updateTaskTitleInline(
  task: Task,
  title: string,
  timestamp = new Date().toISOString(),
): Task | null {
  const nextTitle = title.trim();
  if (!nextTitle || nextTitle.length > 500 || nextTitle === task.title) return null;
  return {
    ...task,
    title: nextTitle,
    updated_at: timestamp,
    activity: [
      ...(task.activity || []),
      {
        id: crypto.randomUUID(),
        type: "updated" as const,
        at: timestamp,
        summary: "Đã sửa nhanh tiêu đề task",
        changes: [{ field: "Tiêu đề", from: task.title, to: nextTitle }],
      },
    ].slice(-200),
  };
}
