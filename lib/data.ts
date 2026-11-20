import type { BoardData, Member, Task } from "./types";
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const statuses = ["todo", "in_progress", "blocked", "done"];
const priorities = ["urgent", "high", "medium", "low"];
const severities = ["critical", "high", "medium", "low"];

const isMember = (value: unknown): value is Member =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.role === "string" &&
  typeof value.color === "string" &&
  typeof value.active === "boolean";

const isTask = (value: unknown): value is Task =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.title === "string" &&
  typeof value.code === "string" &&
  typeof value.description === "string" &&
  typeof value.status === "string" &&
  statuses.includes(value.status) &&
  typeof value.priority === "string" &&
  priorities.includes(value.priority) &&
  typeof value.severity === "string" &&
  severities.includes(value.severity) &&
  (value.assignee_ids === undefined ||
    (Array.isArray(value.assignee_ids) &&
      value.assignee_ids.every((id) => typeof id === "string"))) &&
  (value.assignee_id === undefined || typeof value.assignee_id === "string") &&
  typeof value.order_index === "number" &&
  Array.isArray(value.links) &&
  value.links.every((link) => typeof link === "string") &&
  typeof value.created_at === "string" &&
  typeof value.updated_at === "string";

export function parseBoardData(value: unknown): BoardData | null {
  if (!isRecord(value) || !Array.isArray(value.tasks) || !Array.isArray(value.members))
    return null;
  if (!value.tasks.every(isTask) || !value.members.every(isMember)) return null;
  const tasks = value.tasks.map((task) => {
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
    tasks,
    members: value.members,
    code_prefix:
      typeof value.code_prefix === "string" && value.code_prefix.trim()
        ? value.code_prefix.trim()
        : "MENSQZIN-",
    sort_mode:
      value.sort_mode === "deadline" || value.sort_mode === "manual"
        ? value.sort_mode
        : "smart",
  };
}

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
