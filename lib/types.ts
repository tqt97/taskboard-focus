export type Status = "todo" | "in_progress" | "blocked" | "done";
export type SortMode = "smart" | "deadline" | "manual";
export type Priority = "urgent" | "high" | "medium" | "low";
export type Severity = "critical" | "high" | "medium" | "low";
export type Member = {
  id: string;
  name: string;
  role: string;
  color: string;
  active: boolean;
};
export type TaskLink = { label: string; url: string };
export type TaskActivity = {
  id: string;
  type: "created" | "updated" | "status_changed" | "priority_changed" | "assigned";
  at: string;
  summary: string;
};
export type SavedView = {
  id: string;
  name: string;
  search: string;
  status: string;
  priority: string;
  assignee: string;
  due: string;
  focus: boolean;
  archive?: "active" | "archived";
};
export type DependencyState = "ready" | "waiting" | "blocked";
export type RecurrenceRule = {
  frequency: "daily" | "weekly" | "monthly";
  interval: number;
  until?: string;
};
export type TaskAttachment = {
  id: string;
  name: string;
  url: string;
  size?: number;
  mime_type?: string;
};
export type TaskTemplate = {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: Priority;
  severity: Severity;
  recurrence?: RecurrenceRule;
  created_at: string;
};
export type Task = {
  id: string;
  title: string;
  code: string;
  description: string;
  status: Status;
  priority: Priority;
  severity: Severity;
  /** Canonical assignment field. A task may have zero, one, or many assignees. */
  assignee_ids?: string[];
  /** Legacy single-assignee field kept for old imports and SQL compatibility. */
  assignee_id?: string;
  dev_up: string;
  staging_up: string;
  release_at: string;
  deadline: string;
  order_index: number;
  links: string[];
  primary_links?: TaskLink[];
  secondary_links?: TaskLink[];
  next_action?: string;
  review_note?: string;
  blocked_by?: string[];
  activity?: TaskActivity[];
  archived_at?: string;
  recurrence?: RecurrenceRule;
  template_id?: string;
  attachments?: TaskAttachment[];
  custom_code?: boolean;
  created_at: string;
  updated_at: string;
};
export type BoardData = {
  tasks: Task[];
  members: Member[];
  code_prefix?: string;
  sort_mode?: SortMode;
};
