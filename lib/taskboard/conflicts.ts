import type { Task } from "../types";

export type ConflictField = {
  key: keyof Task;
  label: string;
  local: unknown;
  remote: unknown;
};

const conflictKeys: Array<[keyof Task, string]> = [
  ["title", "Tiêu đề"],
  ["description", "Mô tả"],
  ["status", "Trạng thái"],
  ["priority", "Độ ưu tiên"],
  ["severity", "Mức độ"],
  ["deadline", "Deadline"],
  ["dev_up", "Dev up"],
  ["staging_up", "Staging up"],
  ["release_at", "Release"],
  ["next_action", "Việc tiếp theo"],
  ["review_note", "Ghi chú review"],
  ["assignee_ids", "Người phụ trách"],
  ["blocked_by", "Phụ thuộc"],
  ["checklist", "Checklist"],
  ["attachments", "Tệp đính kèm"],
  ["primary_links", "Liên kết"],
  ["comments", "Thảo luận"],
];

const stable = (value: unknown) => JSON.stringify(value ?? null);

export function formatConflictValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "Chưa đặt";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return String(value);
  if (Array.isArray(value) && value.length === 0) return "Trống";
  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 320 ? `${serialized.slice(0, 317)}...` : serialized;
  } catch {
    return "Không thể hiển thị giá trị";
  }
}

export function getConflictFields(local: Task, remote: Task): ConflictField[] {
  return conflictKeys.flatMap(([key, label]) =>
    stable(local[key]) === stable(remote[key])
      ? []
      : [{ key, label, local: local[key], remote: remote[key] }],
  );
}

export function mergeConflictFields(
  local: Task,
  remote: Task,
  remoteFields: ReadonlySet<keyof Task>,
): Task {
  const merged = { ...local };
  for (const key of remoteFields) {
    if (key === "id" || key === "created_at" || key === "updated_at") continue;
    (merged as Record<string, unknown>)[key] = remote[key];
  }
  return { ...merged, updated_at: new Date().toISOString() };
}
