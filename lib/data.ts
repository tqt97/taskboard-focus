import type {
  BoardData,
  Member,
  RecurrenceRule,
  Task,
  TaskAttachment,
  TaskChecklistItem,
} from "./types";
import { validateBoardRelations } from "./taskboard/constraints.ts";
export const demoData: BoardData = {
  code_prefix: "MENSQZIN-",
  members: [
    { id: "m1", name: "Tuấn", role: "Developer", color: "blue", active: true },
    { id: "m2", name: "Linh", role: "QA", color: "violet", active: true },
    { id: "m3", name: "Minh", role: "Product", color: "orange", active: true },
  ],
  tasks: [
    {
      id: "t1",
      code: "MENSQZIN-248",
      title: "Hoàn thiện luồng thanh toán",
      description:
        "Kiểm tra lại xử lý trạng thái giao dịch, retry và hiển thị lỗi cho người dùng.",
      status: "in_progress",
      priority: "urgent",
      severity: "critical",
      assignee_id: "m1",
      dev_up: iso(1),
      staging_up: iso(2),
      release_at: iso(5),
      deadline: iso(3),
      order_index: 0,
      links: [],
      primary_links: [
        { label: "Redmine", url: "https://example.com/redmine/248" },
        { label: "Spec", url: "https://example.com/spec" },
      ],
      secondary_links: [{ label: "Design", url: "https://example.com/design" }],
      created_at: iso(-3),
      updated_at: iso(0),
    },
    {
      id: "t2",
      code: "WEB-251",
      title: "Kiểm thử hồi quy trang đặt hàng",
      description:
        "Tập trung vào mobile, coupon và các trường hợp thanh toán thất bại.",
      status: "todo",
      priority: "high",
      severity: "high",
      assignee_id: "m2",
      dev_up: iso(2),
      staging_up: iso(4),
      release_at: iso(7),
      deadline: iso(6),
      order_index: 1,
      links: [],
      created_at: iso(-2),
      updated_at: iso(-1),
    },
    {
      id: "t3",
      code: "OPS-039",
      title: "Cập nhật tài liệu vận hành",
      description: "Bổ sung quy trình rollback và checklist sau deploy.",
      status: "blocked",
      priority: "medium",
      severity: "medium",
      assignee_id: "m3",
      dev_up: "",
      staging_up: "",
      release_at: "",
      deadline: iso(9),
      order_index: 2,
      links: [],
      created_at: iso(-5),
      updated_at: iso(-2),
    },
    {
      id: "t4",
      code: "WEB-239",
      title: "Tối ưu truy vấn danh sách đơn",
      description: "Đã merge và xác nhận kết quả trên production.",
      status: "done",
      priority: "low",
      severity: "low",
      assignee_id: "m1",
      dev_up: iso(-8),
      staging_up: iso(-7),
      release_at: iso(-5),
      deadline: iso(-5),
      order_index: 3,
      links: [],
      created_at: iso(-12),
      updated_at: iso(-5),
    },
  ],
};
function iso(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(17, 0, 0, 0);
  return d.toISOString();
}
const key = "taskboard-focus-v1";
export const boardSchemaVersion = 2;
const maxBackupBytes = 5 * 1024 * 1024;
const colors = ["blue", "violet", "orange", "green"];
const maxLengths = {
  id: 100,
  code: 100,
  title: 500,
  description: 10000,
  name: 120,
  role: 120,
  linkLabel: 120,
  url: 2048,
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const statuses = ["todo", "in_progress", "review", "blocked", "done"];
const priorities = ["urgent", "high", "medium", "low"];
const severities = ["critical", "high", "medium", "low"];
const isBoundedString = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length <= max;
const isDateValue = (value: unknown) =>
  typeof value === "string" && (!value || Number.isFinite(new Date(value).getTime()));
const isRequiredDateValue = (value: unknown) =>
  typeof value === "string" &&
  Boolean(value) &&
  Number.isFinite(new Date(value).getTime());
const isLink = (value: unknown): value is { label: string; url: string } =>
  isRecord(value) &&
  isBoundedString(value.label, maxLengths.linkLabel) &&
  Boolean(value.label.trim()) &&
  isBoundedString(value.url, maxLengths.url) &&
  /^https?:\/\//i.test(value.url.trim());
const isActivity = (value: unknown) =>
  isRecord(value) &&
  isBoundedString(value.id, maxLengths.id) &&
  Boolean(value.id.trim()) &&
  [
    "created",
    "updated",
    "status_changed",
    "priority_changed",
    "assigned",
    "snoozed",
    "checklist_changed",
  ].includes(String(value.type)) &&
  isRequiredDateValue(value.at) &&
  isBoundedString(value.summary, 500) &&
  Boolean(value.summary.trim()) &&
  (value.changes === undefined ||
    (Array.isArray(value.changes) &&
      value.changes.length <= 20 &&
      value.changes.every(
        (change) =>
          isRecord(change) &&
          isBoundedString(change.field, 120) &&
          isBoundedString(change.from, 500) &&
          isBoundedString(change.to, 500),
      )));
const isChecklistItem = (value: unknown): value is TaskChecklistItem =>
  isRecord(value) &&
  isBoundedString(value.id, maxLengths.id) &&
  Boolean(value.id.trim()) &&
  isBoundedString(value.title, 500) &&
  Boolean(value.title.trim()) &&
  typeof value.done === "boolean";
const isRecurrence = (value: unknown): value is RecurrenceRule =>
  isRecord(value) &&
  ["daily", "weekly", "monthly"].includes(String(value.frequency)) &&
  Number.isInteger(value.interval) &&
  Number(value.interval) >= 1 &&
  Number(value.interval) <= 365 &&
  (value.until === undefined || isDateValue(value.until));
const isAttachment = (value: unknown): value is TaskAttachment =>
  isRecord(value) &&
  isBoundedString(value.id, maxLengths.id) &&
  Boolean(value.id.trim()) &&
  isBoundedString(value.name, 255) &&
  Boolean(value.name.trim()) &&
  isBoundedString(value.url, maxLengths.url) &&
  /^https?:\/\//i.test(value.url.trim()) &&
  (value.storage_path === undefined ||
    (isBoundedString(value.storage_path, maxLengths.url) &&
      Boolean(value.storage_path.trim()))) &&
  (value.size === undefined ||
    (Number.isSafeInteger(value.size) && Number(value.size) >= 0)) &&
  (value.mime_type === undefined || isBoundedString(value.mime_type, 120));

const isMember = (value: unknown): value is Member =>
  isRecord(value) &&
  isBoundedString(value.id, maxLengths.id) &&
  Boolean(value.id.trim()) &&
  isBoundedString(value.name, maxLengths.name) &&
  Boolean(value.name.trim()) &&
  isBoundedString(value.role, maxLengths.role) &&
  (value.access_role === undefined ||
    ["owner", "admin", "member", "viewer"].includes(String(value.access_role))) &&
  colors.includes(String(value.color)) &&
  typeof value.active === "boolean";

const isTask = (value: unknown): value is Task =>
  isRecord(value) &&
  isBoundedString(value.id, maxLengths.id) &&
  Boolean(value.id.trim()) &&
  isBoundedString(value.title, maxLengths.title) &&
  Boolean(value.title.trim()) &&
  isBoundedString(value.code, maxLengths.code) &&
  isBoundedString(value.description, maxLengths.description) &&
  typeof value.status === "string" &&
  statuses.includes(value.status) &&
  typeof value.priority === "string" &&
  priorities.includes(value.priority) &&
  typeof value.severity === "string" &&
  severities.includes(value.severity) &&
  (value.assignee_ids === undefined ||
    (Array.isArray(value.assignee_ids) &&
      value.assignee_ids.length <= 100 &&
      value.assignee_ids.every(
        (id) => isBoundedString(id, maxLengths.id) && Boolean(id.trim()),
      ))) &&
  (value.assignee_id === undefined ||
    value.assignee_id === "" ||
    (typeof value.assignee_id === "string" &&
      isBoundedString(value.assignee_id, maxLengths.id) &&
      Boolean(value.assignee_id.trim()))) &&
  Number.isSafeInteger(value.order_index) &&
  Array.isArray(value.links) &&
  value.links.length <= 100 &&
  value.links.every(
    (link) =>
      isBoundedString(link, maxLengths.url) && /^https?:\/\//i.test(link.trim()),
  ) &&
  (value.primary_links === undefined ||
    (Array.isArray(value.primary_links) &&
      value.primary_links.length <= 100 &&
      value.primary_links.every(isLink))) &&
  (value.secondary_links === undefined ||
    (Array.isArray(value.secondary_links) &&
      value.secondary_links.length <= 100 &&
      value.secondary_links.every(isLink))) &&
  isDateValue(value.dev_up) &&
  isDateValue(value.staging_up) &&
  isDateValue(value.release_at) &&
  isDateValue(value.deadline) &&
  isRequiredDateValue(value.created_at) &&
  isRequiredDateValue(value.updated_at) &&
  (value.custom_code === undefined || typeof value.custom_code === "boolean") &&
  (value.next_action === undefined || isBoundedString(value.next_action, 1000)) &&
  (value.review_note === undefined || isBoundedString(value.review_note, 2000)) &&
  (value.blocked_by === undefined ||
    (Array.isArray(value.blocked_by) &&
      value.blocked_by.length <= 100 &&
      value.blocked_by.every(
        (id) => isBoundedString(id, maxLengths.id) && Boolean(id.trim()),
      ))) &&
  (value.activity === undefined ||
    (Array.isArray(value.activity) &&
      value.activity.length <= 200 &&
      value.activity.every(isActivity))) &&
  (value.archived_at === undefined || isRequiredDateValue(value.archived_at)) &&
  (value.recurrence === undefined || isRecurrence(value.recurrence)) &&
  (value.template_id === undefined ||
    (isBoundedString(value.template_id, maxLengths.id) &&
      Boolean(value.template_id.trim()))) &&
  (value.attachments === undefined ||
    (Array.isArray(value.attachments) &&
      value.attachments.length <= 50 &&
      value.attachments.every(isAttachment))) &&
  (value.checklist === undefined ||
    (Array.isArray(value.checklist) &&
      value.checklist.length <= 100 &&
      value.checklist.every(isChecklistItem))) &&
  (value.inbox === undefined || typeof value.inbox === "boolean") &&
  (value.snoozed_until === undefined || isDateValue(value.snoozed_until));

type ParseBoardResult = { data: BoardData | null; error?: string };

export function migrateBoardData(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const tasks = Array.isArray(value.tasks)
    ? value.tasks.map((task) =>
        isRecord(task)
          ? {
              ...task,
              blocked_by: task.blocked_by ?? [],
              attachments: task.attachments ?? [],
              checklist: task.checklist ?? [],
            }
          : task,
      )
    : value.tasks;
  return {
    ...value,
    schema_version: value.schema_version ?? boardSchemaVersion,
    tasks,
  };
}

export function parseBoardDataWithError(value: unknown): ParseBoardResult {
  if (isRecord(value)) {
    const schemaVersion = value.schema_version;
    if (
      schemaVersion !== undefined &&
      schemaVersion !== 1 &&
      schemaVersion !== boardSchemaVersion
    ) {
      return {
        data: null,
        error: `Backup không hỗ trợ schema version ${String(schemaVersion)}.`,
      };
    }
  }
  value = migrateBoardData(value);
  if (!isRecord(value)) {
    return { data: null, error: "Backup phải là một object JSON hợp lệ." };
  }
  if (!Array.isArray(value.tasks) || !Array.isArray(value.members)) {
    return { data: null, error: "Backup phải có hai danh sách tasks và members." };
  }
  if (value.tasks.length > 10000 || value.members.length > 1000) {
    return { data: null, error: "Backup vượt quá giới hạn số lượng dữ liệu cho phép." };
  }
  if (!value.members.every(isMember)) {
    return {
      data: null,
      error: "Backup có thành viên thiếu dữ liệu hoặc không hợp lệ.",
    };
  }
  if (!value.tasks.every(isTask)) {
    return { data: null, error: "Backup có task thiếu dữ liệu hoặc không hợp lệ." };
  }
  const members = value.members;
  const tasks = value.tasks;
  const memberIds = new Set(members.map((member) => member.id));
  if (memberIds.size !== members.length) {
    return { data: null, error: "Backup có ID thành viên bị trùng." };
  }
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length) {
    return { data: null, error: "Backup có ID task bị trùng." };
  }
  const relationError = validateBoardRelations(tasks, members);
  if (relationError) return { data: null, error: relationError };
  const normalizedTasks = tasks.map((task) => {
    const assigneeIds = task.assignee_ids?.length
      ? task.assignee_ids
      : task.assignee_id
        ? [task.assignee_id]
        : [];
    return {
      ...task,
      assignee_ids: assigneeIds,
      assignee_id: assigneeIds[0] || "",
    };
  });
  return {
    data: {
      tasks: normalizedTasks,
      members: members.map((member) => ({
        ...member,
        access_role: member.access_role || "member",
      })),
      code_prefix:
        typeof value.code_prefix === "string" && value.code_prefix.trim()
          ? value.code_prefix.trim().slice(0, maxLengths.code)
          : "MENSQZIN-",
      sort_mode:
        value.sort_mode === "deadline" || value.sort_mode === "manual"
          ? value.sort_mode
          : "smart",
    },
  };
}

export function parseBoardData(value: unknown): BoardData | null {
  return parseBoardDataWithError(value).data;
}

export { maxBackupBytes };

export function readLocal(): BoardData {
  if (typeof window === "undefined") return demoData;
  try {
    const raw = localStorage.getItem(key);
    return raw ? parseBoardData(JSON.parse(raw)) || demoData : demoData;
  } catch {
    return demoData;
  }
}
export function writeLocal(data: BoardData): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
