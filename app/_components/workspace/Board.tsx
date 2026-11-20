"use client";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileUp,
  Filter,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  Moon,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings2,
  Sun,
  Trash2,
  Users,
  X,
  Link2,
  ListFilter,
} from "lucide-react";
import {
  demoData,
  maxBackupBytes,
  parseBoardDataWithError,
  readLocal,
  writeLocal,
} from "@/lib/data";
import type {
  BoardData,
  Member,
  Priority,
  Severity,
  SortMode,
  Status,
  Task,
} from "@/lib/types";
import { TaskModal as StructuredTaskModal } from "./TaskModal";
import { NotificationPopover, type BoardNotification } from "./NotificationPopover";

const labels: Record<Status, string> = {
  todo: "Chưa làm",
  in_progress: "Đang làm",
  blocked: "Đang review",
  done: "Hoàn tất",
};
const priorityLabels: Record<Priority, string> = {
  urgent: "Khẩn cấp",
  high: "Cao",
  medium: "Vừa",
  low: "Thấp",
};
const priorityRank: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};
const severityRank: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};
const reminderLabels = ["Deadline", "Dev up", "Staging up", "Release"] as const;
type ReminderLabel = (typeof reminderLabels)[number];
const milestoneDefinitions = [
  ["Deadline", "deadline"],
  ["Dev up", "dev_up"],
  ["Staging up", "staging_up"],
  ["Release", "release_at"],
] as const satisfies ReadonlyArray<readonly [ReminderLabel, keyof Task]>;
const taskMilestones = (task: Task) =>
  milestoneDefinitions.map(([label, key]) => ({ task, label, date: task[key] }));
type ReminderSettings = {
  browserEnabled: boolean;
  leadDays: Record<ReminderLabel, number>;
};
const defaultReminderSettings: ReminderSettings = {
  browserEnabled: false,
  leadDays: { Deadline: 3, "Dev up": 1, "Staging up": 1, Release: 1 },
};
const reminderSettingsKey = "taskboard-reminder-settings-v1";
const browserReminderKey = "taskboard-browser-reminders-v1";
const allowedLeadDays = [0, 1, 3, 7];
const safeSetLocalStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};
const readReminderSettings = (): ReminderSettings => {
  if (typeof window === "undefined") return defaultReminderSettings;
  try {
    const value = JSON.parse(localStorage.getItem(reminderSettingsKey) || "null");
    const leadDays = { ...defaultReminderSettings.leadDays };
    reminderLabels.forEach((label) => {
      if (allowedLeadDays.includes(value?.leadDays?.[label])) {
        leadDays[label] = value.leadDays[label];
      }
    });
    return {
      ...defaultReminderSettings,
      browserEnabled: value?.browserEnabled === true,
      leadDays,
    };
  } catch {
    return defaultReminderSettings;
  }
};
const saveReminderSettings = (settings: ReminderSettings) =>
  safeSetLocalStorage(reminderSettingsKey, JSON.stringify(settings));
const safeRemoveLocalStorage = (key: string) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};
const emptyTask = (prefix = "MENSQZIN-"): Task => ({
  id: crypto.randomUUID(),
  code: prefix,
  custom_code: false,
  title: "",
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
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});
const dateOnly = (s: string) => (s ? new Date(s).toISOString().slice(0, 10) : "");
const stamp = (s: string) => (s ? new Date(s).toISOString() : "");
const taskAssigneeIds = (task: Task) =>
  task.assignee_ids?.length
    ? task.assignee_ids
    : task.assignee_id
      ? [task.assignee_id]
      : [];
const displayNameStorageKey = "taskboard-display-name-v1";
const readDisplayName = () => {
  try {
    return (
      (typeof window !== "undefined"
        ? localStorage.getItem(displayNameStorageKey)?.trim()
        : "") || "Tuấn"
    );
  } catch {
    return "Tuấn";
  }
};
function dueText(s: string) {
  if (!s) return "Chưa đặt";
  const days = Math.ceil(
    (new Date(s).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000,
  );
  return days < 0
    ? `Quá hạn ${Math.abs(days)} ngày`
    : days === 0
      ? "Hôm nay"
      : `Còn ${days} ngày`;
}
function dueState(s: string) {
  if (!s) return "";
  const days = Math.ceil(
    (new Date(s).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000,
  );
  return days < 0 ? "overdue" : days <= 3 ? "soon" : "";
}
function formatDate(s: string) {
  return s
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "short",
      }).format(new Date(s))
    : "—";
}
function initial(): BoardData {
  return readLocal();
}
function greetingForHour(hour: number) {
  if (hour < 12) return "Chào buổi sáng";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}
export default function Board() {
  const router = useRouter(),
    pathname = usePathname(),
    view = pathname.startsWith("/tasks") ? "tasks" : "overview";
  const [data, setData] = useState<BoardData>(demoData),
    [now, setNow] = useState(new Date()),
    [ready, setReady] = useState(false),
    [search, setSearch] = useState(""),
    [statusFilter, setStatusFilter] = useState("all"),
    [priorityFilter, setPriorityFilter] = useState("all"),
    [modal, setModal] = useState<"task" | "settings" | "lock" | null>(null),
    [edit, setEdit] = useState<Task | null>(null),
    [confirm, setConfirm] = useState<string | null>(null),
    [settingsTab, setSettingsTab] = useState("members"),
    [dark, setDark] = useState(false),
    [toast, setToast] = useState(""),
    [dragId, setDragId] = useState<string | null>(null),
    [clock, setClock] = useState(""),
    [sortMode, setSortMode] = useState<SortMode>("smart"),
    [notificationsOpen, setNotificationsOpen] = useState(false),
    notificationRef = useRef<HTMLDivElement>(null),
    [readNotificationIds, setReadNotificationIds] = useState<string[]>([]),
    [reminderSettings, setReminderSettings] = useState<ReminderSettings>(
      defaultReminderSettings,
    ),
    [browserPermission, setBrowserPermission] = useState<
      NotificationPermission | "unsupported"
    >("default"),
    [sidebarCollapsed, setSidebarCollapsed] = useState(false),
    [displayName, setDisplayName] = useState("Tuấn");
  const greeting = greetingForHour(now.getHours());
  useEffect(() => {
    const saved = initial();
    setData(saved);
    setSortMode(saved.sort_mode || "smart");
    setReady(true);
    let storedDark = false;
    try {
      storedDark = localStorage.getItem("taskboard-dark") === "1";
    } catch {}
    setDark(storedDark);
    setDisplayName(readDisplayName());
    setReminderSettings(readReminderSettings());
    if ("Notification" in window) setBrowserPermission(Notification.permission);
    else setBrowserPermission("unsupported");
    const syncDisplayName = () => setDisplayName(readDisplayName());
    window.addEventListener("storage", syncDisplayName);
    window.addEventListener("focus", syncDisplayName);
    try {
      const storedRead = JSON.parse(
        localStorage.getItem("taskboard-notifications-read-v1") || "[]",
      );
      setReadNotificationIds(Array.isArray(storedRead) ? storedRead : []);
    } catch {}
    const tick = () => {
      setNow(new Date());
      setClock(
        new Intl.DateTimeFormat("vi-VN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()),
      );
    };
    tick();
    const timer = setInterval(tick, 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", syncDisplayName);
      window.removeEventListener("focus", syncDisplayName);
    };
  }, []);
  useEffect(() => {
    if (ready && !writeLocal(data)) {
      setToast(
        "Không thể lưu local; hãy export backup và kiểm tra dung lượng trình duyệt.",
      );
    }
  }, [data, ready]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    safeSetLocalStorage("taskboard-dark", dark ? "1" : "0");
  }, [dark]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!modal) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModal(null);
        setEdit(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [modal]);
  useEffect(() => {
    if (!notificationsOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !notificationRef.current?.contains(target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [notificationsOpen]);
  const ordered = useMemo(
    () => [...data.tasks].sort((a, b) => a.order_index - b.order_index),
    [data.tasks],
  );
  const smartCompare = (a: Task, b: Task) =>
    priorityRank[a.priority] - priorityRank[b.priority] ||
    severityRank[a.severity] - severityRank[b.severity] ||
    new Date(a.deadline || "9999-12-31").getTime() -
      new Date(b.deadline || "9999-12-31").getTime() ||
    a.order_index - b.order_index;
  const sorted = useMemo(
    () =>
      sortMode === "manual"
        ? ordered
        : [...ordered].sort(
            sortMode === "deadline"
              ? (a, b) =>
                  new Date(a.deadline || "9999-12-31").getTime() -
                    new Date(b.deadline || "9999-12-31").getTime() || smartCompare(a, b)
              : smartCompare,
          ),
    [ordered, sortMode],
  );
  const deferredSearch = useDeferredValue(search);
  const filtered = useMemo(
    () =>
      sorted.filter(
        (t) =>
          (statusFilter === "all" || t.status === statusFilter) &&
          (priorityFilter === "all" || t.priority === priorityFilter) &&
          `${t.code} ${t.title} ${t.description}`
            .toLowerCase()
            .includes(deferredSearch.toLowerCase()),
      ),
    [sorted, statusFilter, priorityFilter, deferredSearch],
  );
  const active = useMemo(
    () => data.tasks.filter((t) => t.status !== "done"),
    [data.tasks],
  );
  const nowMs = now.getTime();
  const isInReminderWindow = (date: string, label: ReminderLabel) => {
    const diff = new Date(date).getTime() - nowMs;
    return diff >= -86400000 && diff <= reminderSettings.leadDays[label] * 86400000;
  };
  const reminderItems = useMemo(
    () =>
      active
        .flatMap(taskMilestones)
        .filter(({ date, label }) => date && isInReminderWindow(date, label))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [active, nowMs, reminderSettings],
  );
  const upcomingGroups = useMemo(
    () =>
      reminderLabels.map((label) => ({
        label,
        items: reminderItems.filter((item) => item.label === label).slice(0, 3),
      })),
    [reminderItems],
  );
  const notifications = useMemo<BoardNotification[]>(
    () =>
      reminderItems.slice(0, 8).map((item) => {
        const overdue = new Date(item.date).getTime() < nowMs;
        return {
          id: `${item.task.id}-${item.label}`,
          title: `${item.label}: ${item.task.title}`,
          detail: `${item.task.code || "TASK"} · ${dueText(item.date)}`,
          overdue,
          read: readNotificationIds.includes(`${item.task.id}-${item.label}`),
        };
      }),
    [nowMs, readNotificationIds, reminderItems],
  );
  useEffect(() => {
    if (!ready || !reminderSettings.browserEnabled || browserPermission !== "granted")
      return;
    let sent: string[] = [];
    try {
      const stored = JSON.parse(localStorage.getItem(browserReminderKey) || "[]");
      sent = Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : [];
    } catch {}
    const nextSent = [...sent];
    active.forEach((task) => {
      taskMilestones(task).forEach(({ label, date }) => {
        if (!date) return;
        const diff = new Date(date).getTime() - nowMs;
        if (diff < -86400000 || diff > reminderSettings.leadDays[label] * 86400000)
          return;
        const id = `${task.id}-${label}-${date.slice(0, 10)}`;
        if (nextSent.includes(id)) return;
        try {
          new Notification(`${label}: ${task.title}`, {
            body: `${task.code || "TASK"} · ${dueText(date)}`,
            tag: id,
          });
          nextSent.push(id);
        } catch {
          return;
        }
      });
    });
    if (nextSent.length !== sent.length) {
      safeSetLocalStorage(browserReminderKey, JSON.stringify(nextSent.slice(-200)));
    }
  }, [active, browserPermission, nowMs, ready, reminderSettings]);
  const unreadNotificationCount = notifications.filter((item) => !item.read).length;
  const markNotificationRead = (id: string) => {
    setReadNotificationIds((ids) => {
      const next = ids.includes(id) ? ids : [...ids, id];
      safeSetLocalStorage("taskboard-notifications-read-v1", JSON.stringify(next));
      return next;
    });
  };
  const markAllNotificationsRead = () => {
    const ids = notifications.map((item) => item.id);
    setReadNotificationIds(ids);
    safeSetLocalStorage("taskboard-notifications-read-v1", JSON.stringify(ids));
  };
  const updateReminderSettings = (next: ReminderSettings) => {
    setReminderSettings(next);
    if (!saveReminderSettings(next)) {
      setToast("Không thể lưu cài đặt; hãy kiểm tra quyền lưu của trình duyệt.");
    }
  };
  const requestBrowserNotifications = async () => {
    if (!("Notification" in window)) {
      setToast("Trình duyệt này không hỗ trợ thông báo.");
      return false;
    }
    let permission: NotificationPermission;
    try {
      permission = await Notification.requestPermission();
    } catch {
      setToast("Không thể xin quyền thông báo từ trình duyệt.");
      return false;
    }
    setBrowserPermission(permission);
    if (permission !== "granted") {
      setToast("Bạn chưa cấp quyền thông báo cho trình duyệt.");
      return false;
    }
    updateReminderSettings({ ...reminderSettings, browserEnabled: true });
    setToast("Đã bật thông báo trình duyệt.");
    return true;
  };
  const statusSummary = useMemo(
    () =>
      Object.entries(labels).map(([status, label]) => ({
        status: status as Status,
        label,
        count: data.tasks.filter((t) => t.status === status).length,
      })),
    [data.tasks],
  );
  const creationActivity = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => {
        const day = new Date(now);
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() - (13 - index));
        const next = new Date(day);
        next.setDate(next.getDate() + 1);
        const count = data.tasks.filter((task) => {
          const created = new Date(task.created_at).getTime();
          return created >= day.getTime() && created < next.getTime();
        }).length;
        return {
          key: day.toISOString(),
          label: new Intl.DateTimeFormat("vi-VN", { weekday: "short" })
            .format(day)
            .replace(".", ""),
          date: new Intl.DateTimeFormat("vi-VN", {
            day: "2-digit",
            month: "2-digit",
          }).format(day),
          count,
        };
      }),
    [data.tasks, now],
  );
  const maxCreated = Math.max(...creationActivity.map((item) => item.count), 1);
  const attentionTasks = useMemo(
    () =>
      [...active]
        .sort(
          (a, b) =>
            priorityRank[a.priority] - priorityRank[b.priority] ||
            new Date(a.deadline || "9999-12-31").getTime() -
              new Date(b.deadline || "9999-12-31").getTime(),
        )
        .slice(0, 4),
    [active],
  );
  const saveTask = (task: Task) => {
    setData((d) => ({
      ...d,
      code_prefix: d.code_prefix || "MENSQZIN-",
      sort_mode: d.sort_mode || sortMode,
      tasks: edit
        ? d.tasks.map((t) =>
            t.id === task.id ? { ...task, updated_at: new Date().toISOString() } : t,
          )
        : [{ ...task, order_index: d.tasks.length }, ...d.tasks],
    }));
    setModal(null);
    setEdit(null);
    setToast(edit ? "Đã cập nhật task" : "Đã tạo task");
  };
  const removeTask = (id: string) => {
    setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
    setConfirm(null);
    setModal(null);
    setToast("Đã xóa task");
  };
  const reorder = (target: string) => {
    if (!dragId || dragId === target) return;
    const list = [...ordered],
      from = list.findIndex((t) => t.id === dragId),
      to = list.findIndex((t) => t.id === target);
    if (from < 0 || to < 0) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    setData((d) => ({
      ...d,
      sort_mode: "manual",
      tasks: list.map((t, i) => ({ ...t, order_index: i })),
    }));
    setSortMode("manual");
    setDragId(null);
  };
  const dropOnStatus = (status: Status, target?: string) => {
    if (!dragId) return;
    const list = [...ordered],
      from = list.findIndex((t) => t.id === dragId);
    if (from < 0) return;
    const [item] = list.splice(from, 1);
    const moved = { ...item, status, updated_at: new Date().toISOString() };
    let insertAt = target ? list.findIndex((t) => t.id === target) : -1;
    if (insertAt < 0) {
      const same = list
        .map((t) => (t.status === status ? list.indexOf(t) : -1))
        .filter((i) => i >= 0);
      insertAt = same.length ? same[same.length - 1] + 1 : list.length;
    }
    list.splice(insertAt, 0, moved);
    setData((d) => ({
      ...d,
      sort_mode: "manual",
      tasks: list.map((t, i) => ({ ...t, order_index: i })),
    }));
    setSortMode("manual");
    setDragId(null);
    setToast(
      status === item.status
        ? "Đã đổi vị trí task"
        : `Đã chuyển sang ${labels[status]}`,
    );
  };
  const dropTask = (target: Task) => {
    if (!dragId || dragId === target.id) return;
    const source = ordered.find((t) => t.id === dragId);
    if (!source) return;
    source.status === target.status
      ? reorder(target.id)
      : dropOnStatus(target.status, target.id);
  };
  const exportData = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { schema_version: 1, exported_at: new Date().toISOString(), ...data },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `taskboard-backup-${dateOnly(new Date().toISOString())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setToast("Đã xuất bản sao dữ liệu");
  };
  const importData = (file?: File) => {
    if (!file) return;
    if (file.size > maxBackupBytes) {
      setToast("File backup quá lớn; giới hạn là 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || parsed.schema_version !== 1) {
          throw new Error("File không đúng schema Taskboard v1.");
        }
        const result = parseBoardDataWithError(parsed);
        if (!result.data)
          throw new Error(result.error || "Dữ liệu backup không hợp lệ.");
        setData(result.data);
        setSortMode(result.data.sort_mode || "smart");
        setToast("Đã nhập dữ liệu");
      } catch (e) {
        setToast(e instanceof Error ? e.message : "Không thể đọc file");
      }
    };
    reader.onerror = () => setToast("Không thể đọc file backup từ thiết bị.");
    reader.readAsText(file);
  };
  const setMember = (m: Member) =>
    setData((d) => ({
      ...d,
      members: d.members.some((x) => x.id === m.id)
        ? d.members.map((x) => (x.id === m.id ? m : x))
        : [...d.members, m],
    }));
  const taskCard = (t: Task) => (
    <article
      className={`task-card task-status-${t.status}`}
      key={t.id}
      role="button"
      tabIndex={0}
      aria-label={`Mở task ${t.code || "TASK"}: ${t.title}`}
      draggable
      onDragStart={() => setDragId(t.id)}
      onDragEnd={() => setDragId(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.stopPropagation();
        dropTask(t);
      }}
      onClick={() => {
        setEdit(t);
        setModal("task");
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEdit(t);
          setModal("task");
        }
      }}
    >
      <div className="task-top">
        <span
          className={`urgency-dot ${t.priority}`}
          title={`Ưu tiên ${priorityLabels[t.priority]}`}
        />
        <span className="task-code">{t.code || "TASK"}</span>
        {(t.priority === "urgent" || t.priority === "high") && (
          <span
            className={`priority-badge priority-badge-${t.priority}`}
            title={`Mức ưu tiên ${priorityLabels[t.priority]}`}
          >
            {t.priority === "urgent" ? "KHẨN" : "CAO"}
          </span>
        )}
        <button
          className="icon-button mini"
          aria-label="Mở task"
          onClick={(e) => {
            e.stopPropagation();
            setEdit(t);
            setModal("task");
          }}
        >
          <MoreHorizontal size={17} />
        </button>
      </div>
      <h3>{t.title}</h3>
      <div className="task-meta">
        <span className="assignee" title="Người phụ trách">
          {(() => {
            const assignees = taskAssigneeIds(t)
              .map((id) => data.members.find((member) => member.id === id))
              .filter((member): member is Member => Boolean(member));
            return assignees.length ? (
              <>
                <span className="assignee-avatars" aria-hidden="true">
                  {assignees.slice(0, 3).map((member) => (
                    <span
                      className={`avatar avatar-${member.color}`}
                      key={member.id}
                      title={member.name}
                    >
                      {member.name.slice(0, 1)}
                    </span>
                  ))}
                </span>
                <span>
                  {assignees
                    .slice(0, 2)
                    .map((member) => member.name)
                    .join(", ")}
                  {assignees.length > 2 ? ` +${assignees.length - 2}` : ""}
                </span>
              </>
            ) : (
              <>
                <span className="avatar avatar-blue">?</span>
                <span>Chưa giao</span>
              </>
            );
          })()}
        </span>
        <span className={`due ${dueState(t.deadline)}`}>
          <CalendarDays size={13} />
          {t.deadline ? dueText(t.deadline) : "Chưa hạn"}
        </span>
      </div>
    </article>
  );
  if (!ready) {
    return (
      <main className="app-shell loading-shell" aria-busy="true">
        <div className="loading-card">
          <div className="loading-mark" aria-hidden="true" />
          <span>Đang tải workspace…</span>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className={sidebarCollapsed ? "sidebar collapsed" : "sidebar"}>
        <div className="brand">
          <div className="brand-mark">
            <ListTodo size={21} />
          </div>
          <div>
            <strong>Taskboard</strong>
            <small>PERSONAL WORKSPACE</small>
          </div>
        </div>
        <nav>
          <button
            className={view === "overview" ? "nav-item active" : "nav-item"}
            onClick={() => router.push("/")}
          >
            <LayoutDashboard size={18} />
            Tổng quan
          </button>
          <button
            className={view === "tasks" ? "nav-item active" : "nav-item"}
            onClick={() => router.push("/tasks")}
          >
            <ListTodo size={18} />
            Danh sách task<span className="nav-count">{active.length}</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="profile">
            <span className="avatar avatar-blue">T</span>
            <span>
              <b>{displayName}</b>
              <small>Local workspace</small>
            </span>
            <button
              className="icon-button"
              title="Khóa màn hình"
              onClick={() => setModal("lock")}
            >
              <LockKeyhole size={16} />
            </button>
          </div>
        </div>
      </aside>
      <section className="main-area">
        <header className="topbar">
          <button
            className="sidebar-collapse"
            aria-label={sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            title={sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <div className="mobile-brand">
            <div className="brand-mark">
              <ListTodo size={19} />
            </div>
            <strong>Taskboard</strong>
          </div>
          <div className="breadcrumbs">
            Workspace <span>/</span>{" "}
            {view === "overview" ? "Tổng quan" : "Danh sách task"}
          </div>
          <div className="top-actions">
            <div className="live-date">
              <span className="live-dot" />
              {clock}
            </div>
            <button
              className="icon-button"
              aria-label="Tải dữ liệu"
              title="Tải dữ liệu"
              onClick={exportData}
            >
              <Download size={18} />
            </button>
            <div className="notification-wrap" ref={notificationRef}>
              <button
                className={
                  unreadNotificationCount ? "icon-button has-unread" : "icon-button"
                }
                aria-label="Thông báo"
                title="Thông báo"
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={18} />
                {unreadNotificationCount > 0 && (
                  <span className="notification-badge">
                    {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <NotificationPopover
                  items={notifications}
                  onRead={markNotificationRead}
                  onReadAll={markAllNotificationsRead}
                  onClose={() => setNotificationsOpen(false)}
                />
              )}
            </div>
            <button
              className="icon-button"
              aria-label="Đổi giao diện"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-button"
              aria-label="Cài đặt"
              onClick={() => setModal("settings")}
            >
              <Settings2 size={18} />
            </button>
            <span className="avatar avatar-blue">T</span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "overview"
                  ? "THỨ NĂM · WORKSPACE CỦA BẠN"
                  : "WORKSPACE · QUẢN LÝ CÔNG VIỆC"}
              </div>
              <h1>
                {view === "overview" ? (
                  <>
                    {greeting}, <span className="display-name">{displayName}</span>
                  </>
                ) : (
                  "Danh sách task"
                )}{" "}
                <span>✦</span>
              </h1>
              <p>
                {view === "overview"
                  ? "Một cái nhìn nhanh về tiến độ, rủi ro và các mốc sắp tới."
                  : "Tìm, lọc, tạo và cập nhật mọi task trong workspace."}
              </p>
            </div>
            {view === "tasks" && (
              <button
                className="primary-button"
                onClick={() => {
                  setEdit(null);
                  setModal("task");
                }}
              >
                <Plus size={17} /> Tạo task
              </button>
            )}
          </div>
          {view === "overview" && (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">
                    Đang thực hiện{" "}
                    <span className="stat-icon blue-bg">
                      <Activity size={17} />
                    </span>
                  </div>
                  <strong>
                    {active.filter((t) => t.status === "in_progress").length}
                    <small> task</small>
                  </strong>
                  <span className="stat-foot">trên {data.tasks.length} công việc</span>
                </div>
                <div className="stat-card">
                  <div className="stat-label">
                    Cần chú ý{" "}
                    <span className="stat-icon orange-bg">
                      <AlertTriangle size={17} />
                    </span>
                  </div>
                  <strong>
                    {
                      active.filter(
                        (t) =>
                          t.priority === "urgent" ||
                          t.severity === "critical" ||
                          taskAssigneeIds(t).length === 0 ||
                          (t.deadline && new Date(t.deadline).getTime() < Date.now()),
                      ).length
                    }
                    <small> task</small>
                  </strong>
                  <span className="stat-foot">khẩn, quá hạn hoặc chưa giao</span>
                </div>
                <div className="stat-card">
                  <div className="stat-label">
                    Sắp đến hạn{" "}
                    <span className="stat-icon purple-bg">
                      <Clock3 size={17} />
                    </span>
                  </div>
                  <strong>
                    {
                      active.filter(
                        (t) =>
                          t.deadline &&
                          new Date(t.deadline).getTime() - Date.now() < 4 * 86400000,
                      ).length
                    }
                    <small> task</small>
                  </strong>
                  <span className="stat-foot">trong 3 ngày tới hoặc quá hạn</span>
                </div>
                <div className="stat-card">
                  <div className="stat-label">
                    Đã hoàn tất{" "}
                    <span className="stat-icon green-bg">
                      <CheckCheck size={17} />
                    </span>
                  </div>
                  <strong>
                    {data.tasks.filter((t) => t.status === "done").length}
                    <small> task</small>
                  </strong>
                  <span className="stat-foot">hoàn thành tổng thể</span>
                </div>
              </div>
              <div className="overview-grid">
                <section className="panel status-chart">
                  <div className="panel-heading">
                    <div>
                      <h2>Tiến độ công việc</h2>
                      <p>Phân bổ task theo trạng thái</p>
                    </div>
                    <span className="round-icon">
                      <Activity size={17} />
                    </span>
                  </div>
                  <div className="chart-bars">
                    {statusSummary.map((item) => (
                      <div className="chart-row" key={item.status}>
                        <div className="chart-label">
                          <span className={`status status-${item.status}`}>
                            <i />
                            {item.label}
                          </span>
                          <b>{item.count}</b>
                        </div>
                        <div className="chart-track">
                          <span
                            className={`chart-fill fill-${item.status}`}
                            style={{
                              width: `${data.tasks.length ? Math.max((item.count / data.tasks.length) * 100, item.count ? 8 : 0) : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel creation-chart">
                  <div className="panel-heading">
                    <div>
                      <h2>Nhịp tạo task</h2>
                      <p>Số task được tạo trong 14 ngày gần nhất</p>
                    </div>
                    <span className="round-icon">
                      <Activity size={17} />
                    </span>
                  </div>
                  <div className="creation-chart-grid">
                    {creationActivity.map((item) => (
                      <div
                        className="creation-bar-wrap"
                        key={item.key}
                        title={item.date + " : " + item.count + " task"}
                      >
                        <span
                          className="creation-bar"
                          style={{
                            height:
                              Math.max(
                                (item.count / maxCreated) * 100,
                                item.count ? 8 : 2,
                              ) + "%",
                          }}
                        />
                        <small>{item.label}</small>
                        <em>{item.count || ""}</em>
                      </div>
                    ))}
                  </div>
                  <div className="creation-chart-foot">
                    <span>
                      <b>
                        {creationActivity.reduce((sum, item) => sum + item.count, 0)}
                      </b>{" "}
                      task mới trong 14 ngày
                    </span>
                    <span>
                      Ngày cao nhất:{" "}
                      <b>{Math.max(...creationActivity.map((item) => item.count))}</b>
                    </span>
                  </div>
                </section>
                <section className="panel attention-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Cần xử lý trước</h2>
                      <p>Ưu tiên cao và task đang mở</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => router.push("/tasks")}
                    >
                      Mở danh sách <ArrowDownUp size={15} />
                    </button>
                  </div>
                  {attentionTasks.length ? (
                    <div className="attention-list">
                      {attentionTasks.map((t) => (
                        <button
                          className="attention-row"
                          key={t.id}
                          onClick={() => {
                            setEdit(t);
                            setModal("task");
                          }}
                        >
                          <span className={`pill priority-${t.priority}`}>
                            {priorityLabels[t.priority]}
                          </span>
                          <span>
                            <b>
                              {t.code || "TASK"} · {t.title}
                            </b>
                            <small>
                              {labels[t.status]} ·{" "}
                              {t.deadline ? dueText(t.deadline) : "Chưa đặt hạn"}
                            </small>
                          </span>
                          <ChevronDown size={15} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-small">Không có task cần xử lý.</div>
                  )}
                </section>
              </div>
            </>
          )}
          <div className={view === "tasks" ? "tasks-layout" : "overview-layout"}>
            {view === "tasks" && (
              <section className="tasks-panel panel">
                <div className="panel-heading">
                  <div>
                    <h2>Ưu tiên công việc</h2>
                    <p>{filtered.length} task · trạng thái đi từ trái sang phải</p>
                  </div>
                  <div className="view-switch">
                    <button className="selected">Kanban</button>
                    <span className="view-switch-note">
                      {sortMode === "manual" ? "Thứ tự kéo thả" : "Ưu tiên → deadline"}
                    </span>
                  </div>
                </div>
                <div className="filters">
                  <label className="search-box">
                    <Search size={16} />
                    <input
                      placeholder="Tìm task, mã, mô tả..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <kbd>⌘ K</kbd>
                  </label>
                  <label className="select-wrap">
                    <Filter size={15} />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">Mọi trạng thái</option>
                      {Object.entries(labels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} />
                  </label>
                  <label className="select-wrap priority-filter">
                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                    >
                      <option value="all">Mọi ưu tiên</option>
                      {Object.entries(priorityLabels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} />
                  </label>
                </div>
                <div className="priority-guide">
                  <span className="guide-note">
                    <i className="urgent" />
                    Trên cùng = cần xử lý trước
                  </span>
                  <span className="guide-note">
                    <ArrowDownUp size={13} /> Kanban: tiến độ trái → phải
                  </span>
                  <div className="legend-group">
                    <b>Priority</b>
                    <span>
                      <i className="legend-swatch urgent" />
                      Khẩn
                    </span>
                    <span>
                      <i className="legend-swatch high" />
                      Cao
                    </span>
                    <span>
                      <i className="legend-swatch medium" />
                      Vừa
                    </span>
                    <span>
                      <i className="legend-swatch low" />
                      Thấp
                    </span>
                  </div>
                  <div className="legend-group">
                    <b>Severity</b>
                    <span>
                      <i className="legend-swatch severity-critical" />
                      Nghiêm trọng
                    </span>
                    <span>
                      <i className="legend-swatch severity-high" />
                      Cao
                    </span>
                    <span>
                      <i className="legend-swatch severity-medium" />
                      Vừa
                    </span>
                    <span>
                      <i className="legend-swatch severity-low" />
                      Thấp
                    </span>
                  </div>
                </div>
                <div className="kanban-board">
                  {filtered.length ? (
                    Object.entries(labels).map(([status, label]) => (
                      <section
                        className="kanban-column"
                        key={status}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => dropOnStatus(status as Status)}
                      >
                        <header>
                          <span className={`status status-${status}`}>
                            <i />
                            {label}
                          </span>
                          <b>{filtered.filter((t) => t.status === status).length}</b>
                        </header>
                        <div className="kanban-cards">
                          {filtered.filter((t) => t.status === status).map(taskCard)}
                        </div>
                      </section>
                    ))
                  ) : (
                    <div className="empty-state">
                      <ListTodo size={28} />
                      <b>Chưa tìm thấy task</b>
                      <span>Thử đổi bộ lọc hoặc tạo công việc mới.</span>
                    </div>
                  )}
                </div>
              </section>
            )}
            {view === "overview" && (
              <aside className="right-rail">
                <section className="panel timeline-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Mốc sắp tới</h2>
                      <p>Trong 7 ngày tiếp theo</p>
                    </div>
                    <span className="round-icon">
                      <CalendarDays size={17} />
                    </span>
                  </div>
                  {reminderItems.length ? (
                    <div className="timeline-groups">
                      {upcomingGroups.map((group) => (
                        <section
                          className={`timeline-group timeline-group-${group.label
                            .toLowerCase()
                            .replaceAll(" ", "-")}`}
                          key={group.label}
                        >
                          <div className="timeline-group-heading">
                            <i className="timeline-group-marker" />
                            <b>{group.label}</b>
                            <span>{group.items.length}</span>
                          </div>
                          {group.items.length ? (
                            <div className="timeline">
                              {group.items.map((item) => (
                                <div
                                  className="timeline-row"
                                  key={`${item.task.id}-${item.label}`}
                                >
                                  <div
                                    className={`timeline-marker ${dueState(item.date)}`}
                                  >
                                    <i />
                                  </div>
                                  <div className="timeline-copy">
                                    <div className="timeline-title">
                                      <b>{item.task.code || "TASK"}</b>
                                      <span className={dueState(item.date)}>
                                        {dueText(item.date)}
                                      </span>
                                    </div>
                                    <p>{item.task.title}</p>
                                    <small>{formatDate(item.date)}</small>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="timeline-group-empty">Chưa có mốc</p>
                          )}
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-small">
                      Mọi thứ đang yên ắng. Chưa có mốc gần.
                    </div>
                  )}
                </section>
                <section className="panel team-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Đội ngũ</h2>
                      <p>
                        {data.members.filter((m) => m.active).length} thành viên hoạt
                        động
                      </p>
                    </div>
                    <button
                      className="icon-button"
                      onClick={() => {
                        setSettingsTab("members");
                        setModal("settings");
                      }}
                    >
                      <Users size={17} />
                    </button>
                  </div>
                  <div className="member-list">
                    {data.members
                      .filter((m) => m.active)
                      .map((m) => (
                        <div className="member-row" key={m.id}>
                          <span className={`avatar avatar-${m.color}`}>
                            {m.name.slice(0, 1)}
                          </span>
                          <span>
                            <b>{m.name}</b>
                            <small>{m.role}</small>
                          </span>
                          <span className="member-work">
                            {
                              data.tasks.filter(
                                (t) =>
                                  taskAssigneeIds(t).includes(m.id) &&
                                  t.status !== "done",
                              ).length
                            }{" "}
                            task
                          </span>
                        </div>
                      ))}
                  </div>
                  <button
                    className="manage-button"
                    onClick={() => {
                      setSettingsTab("members");
                      setModal("settings");
                    }}
                  >
                    Quản lý thành viên <span>→</span>
                  </button>
                </section>
              </aside>
            )}
          </div>
          <footer className="footer">
            <span>
              Taskboard <span className="footer-dot">·</span> Cá nhân, rõ ràng, đúng
              hạn.
            </span>
            <span>
              Lưu trên thiết bị <Check size={13} />
            </span>
          </footer>
        </div>
      </section>
      {modal === "task" && (
        <StructuredTaskModal
          task={edit || emptyTask(data.code_prefix || "MENSQZIN-")}
          prefix={data.code_prefix || "MENSQZIN-"}
          members={data.members}
          isNew={!edit}
          onClose={() => {
            setModal(null);
            setEdit(null);
          }}
          onSave={saveTask}
          onPrefixChange={(prefix) => setData((d) => ({ ...d, code_prefix: prefix }))}
          onDelete={() => setConfirm("delete")}
        />
      )}
      {modal === "settings" && (
        <SettingsModal
          data={data}
          tab={settingsTab}
          setTab={setSettingsTab}
          onMember={setMember}
          onClose={() => setModal(null)}
          onExport={exportData}
          onImport={importData}
          onClear={() => {
            setModal(null);
            setConfirm("clear");
          }}
          displayName={displayName}
          onDisplayName={(name) => {
            const nextName = name.trim();
            setDisplayName(nextName || "Tuấn");
            const saved = nextName
              ? safeSetLocalStorage(displayNameStorageKey, nextName)
              : safeRemoveLocalStorage(displayNameStorageKey);
            if (!saved) {
              setToast("Không thể lưu tên hiển thị; hãy kiểm tra quyền lưu.");
            }
          }}
          reminderSettings={reminderSettings}
          browserPermission={browserPermission}
          onReminderSettings={updateReminderSettings}
          onRequestBrowserNotifications={requestBrowserNotifications}
          onToast={setToast}
        />
      )}
      {modal === "lock" && (
        <LockModal onClose={() => setModal(null)} onToast={setToast} />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm === "delete" ? "Xóa task này?" : "Xóa toàn bộ dữ liệu local?"}
          body={
            confirm === "delete"
              ? "Task sẽ bị xóa khỏi workspace hiện tại. Hành động này không thể hoàn tác."
              : "Dữ liệu lưu trên trình duyệt này sẽ bị xóa. Hãy xuất bản sao trước nếu cần."
          }
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            confirm === "delete" && edit
              ? removeTask(edit.id)
              : (setData((d) => ({ ...d, tasks: [], members: [] })),
                setConfirm(null),
                setToast("Đã xóa dữ liệu local"))
          }
        />
      )}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <Check size={16} />
          {toast}
        </div>
      )}
    </main>
  );
}
function SettingsModal({
  data,
  tab,
  setTab,
  onMember,
  onClose,
  onExport,
  onImport,
  onClear,
  displayName,
  onDisplayName,
  reminderSettings,
  browserPermission,
  onReminderSettings,
  onRequestBrowserNotifications,
  onToast,
}: {
  data: BoardData;
  tab: string;
  setTab: (s: string) => void;
  onMember: (m: Member) => void;
  onClose: () => void;
  onExport: () => void;
  onImport: (f?: File) => void;
  onClear: () => void;
  displayName: string;
  onDisplayName: (name: string) => void;
  reminderSettings: ReminderSettings;
  browserPermission: NotificationPermission | "unsupported";
  onReminderSettings: (settings: ReminderSettings) => void;
  onRequestBrowserNotifications: () => Promise<boolean>;
  onToast: (message: string) => void;
}) {
  const [newName, setNewName] = useState(""),
    [newRole, setNewRole] = useState("Developer"),
    [room, setRoom] = useState(() =>
      (() => {
        try {
          return typeof window === "undefined"
            ? ""
            : localStorage.getItem("taskboard-chatwork-room-id-v1") || "";
        } catch {
          return "";
        }
      })(),
    ),
    [chatworkTestState, setChatworkTestState] = useState<
      "idle" | "sending" | "success" | "error"
    >("idle"),
    [passcode, setPasscode] = useState(() =>
      (() => {
        try {
          return typeof window === "undefined"
            ? ""
            : localStorage.getItem("taskboard-lock-passcode-v1") || "";
        } catch {
          return "";
        }
      })(),
    );
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">WORKSPACE</span>
            <h2 id="settings-modal-title">Cài đặt</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        <div className="settings-tabs">
          {[
            ["members", "Đội ngũ"],
            ["notifications", "Thông báo"],
            ["integrations", "Tích hợp"],
            ["data", "Dữ liệu"],
            ["appearance", "Giao diện"],
          ].map(([k, v]) => (
            <button
              className={tab === k ? "selected" : ""}
              key={k}
              onClick={() => setTab(k)}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="settings-content">
          {tab === "members" && (
            <>
              <div className="setting-intro">
                <h3>Thành viên nhóm</h3>
                <p>Danh sách này dùng để gán người phụ trách task.</p>
              </div>
              {data.members.map((m) => (
                <div className="setting-member" key={m.id}>
                  <span className={`avatar avatar-${m.color}`}>
                    {m.name.slice(0, 1)}
                  </span>
                  <input
                    value={m.name}
                    onChange={(e) => onMember({ ...m, name: e.target.value })}
                  />
                  <input
                    value={m.role}
                    onChange={(e) => onMember({ ...m, role: e.target.value })}
                  />
                  <button
                    className={m.active ? "tiny-toggle on" : "tiny-toggle"}
                    onClick={() => onMember({ ...m, active: !m.active })}
                  >
                    {m.active ? "Đang hoạt động" : "Đã ẩn"}
                  </button>
                </div>
              ))}
              <div className="add-member">
                <input
                  placeholder="Tên thành viên"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <input
                  placeholder="Vai trò"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                />
                <button
                  className="secondary-button"
                  onClick={() => {
                    if (newName.trim()) {
                      onMember({
                        id: crypto.randomUUID(),
                        name: newName.trim(),
                        role: newRole,
                        color: ["blue", "violet", "orange", "green"][
                          data.members.length % 4
                        ],
                        active: true,
                      });
                      setNewName("");
                    }
                  }}
                >
                  <Plus size={15} /> Thêm
                </button>
              </div>
            </>
          )}
          {tab === "notifications" && (
            <>
              <div className="setting-intro">
                <h3>Nhắc mốc công việc</h3>
                <p>
                  Notification center luôn hiển thị mốc sắp đến. Browser reminder chỉ
                  chạy khi workspace đang mở và bạn đã cấp quyền trình duyệt.
                </p>
              </div>
              {reminderLabels.map((x) => (
                <div className="setting-row" key={x}>
                  <span>
                    <b>{x}</b>
                    <small>Nhắc trước khi đến hạn</small>
                  </span>
                  <select
                    value={reminderSettings.leadDays[x]}
                    onChange={(e) =>
                      onReminderSettings({
                        ...reminderSettings,
                        leadDays: {
                          ...reminderSettings.leadDays,
                          [x]: Number(e.target.value),
                        },
                      })
                    }
                  >
                    <option value="0">Đúng ngày</option>
                    <option value="1">1 ngày</option>
                    <option value="3">3 ngày</option>
                    <option value="7">7 ngày</option>
                  </select>
                </div>
              ))}
              <div className="setting-row notification-setting-row">
                <span>
                  <b>Thông báo trình duyệt</b>
                  <small>
                    {browserPermission === "unsupported"
                      ? "Trình duyệt không hỗ trợ"
                      : browserPermission === "denied"
                        ? "Đang bị chặn trong cài đặt trình duyệt"
                        : "Nhắc một lần cho mỗi mốc task"}
                  </small>
                </span>
                <button
                  className={
                    reminderSettings.browserEnabled
                      ? "toggle-switch on"
                      : "toggle-switch"
                  }
                  aria-label="Bật hoặc tắt thông báo trình duyệt"
                  aria-pressed={reminderSettings.browserEnabled}
                  disabled={
                    browserPermission === "denied" ||
                    browserPermission === "unsupported"
                  }
                  onClick={async () => {
                    if (reminderSettings.browserEnabled) {
                      onReminderSettings({
                        ...reminderSettings,
                        browserEnabled: false,
                      });
                    } else {
                      await onRequestBrowserNotifications();
                    }
                  }}
                />
              </div>
              <p className="muted-note">
                Chatwork test và gửi định kỳ cần token server-side. Cấu hình trong tab
                Tích hợp; lịch định kỳ production cần Cron/worker và kho dữ liệu remote.
              </p>
            </>
          )}
          {tab === "integrations" && (
            <>
              <div className="setting-intro">
                <h3>Kết nối dịch vụ</h3>
                <p>
                  Thông tin nhạy cảm phải đặt trong Environment Variables trên Vercel.
                </p>
              </div>
              <div className="integration-card">
                <div className="integration-logo chatwork">C</div>
                <div>
                  <b>Chatwork</b>
                  <small>Gửi thông báo mốc task đến room</small>
                </div>
                <span className="connection-status">Chưa cấu hình</span>
              </div>
              <label className="field">
                <span>
                  Room ID <small>(chỉ lưu tạm trên giao diện này)</small>
                </span>
                <input
                  value={room}
                  onChange={(e) => {
                    setRoom(e.target.value);
                    safeSetLocalStorage(
                      "taskboard-chatwork-room-id-v1",
                      e.target.value.trim(),
                    );
                  }}
                  placeholder="Ví dụ: 123456789"
                />
              </label>
              <button
                className="secondary-button integration-test-button"
                disabled={chatworkTestState === "sending" || !room.trim()}
                onClick={async () => {
                  setChatworkTestState("sending");
                  try {
                    const response = await fetch("/api/notifications/chatwork-test", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ roomId: room.trim() }),
                    });
                    const result = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(result.error || "Gửi thất bại");
                    setChatworkTestState("success");
                    onToast("Đã gửi thông báo test đến Chatwork.");
                  } catch (error) {
                    setChatworkTestState("error");
                    onToast(
                      error instanceof Error ? error.message : "Gửi Chatwork thất bại.",
                    );
                  }
                }}
              >
                <Send size={15} />
                {chatworkTestState === "sending" ? "Đang gửi..." : "Gửi thông báo test"}
              </button>
              {chatworkTestState === "success" && (
                <p className="integration-feedback success">Đã gửi thành công.</p>
              )}
              {chatworkTestState === "error" && (
                <p className="integration-feedback error">
                  Không gửi được. Kiểm tra token và Room ID.
                </p>
              )}
              <div className="integration-card">
                <div className="integration-logo gmail">G</div>
                <div>
                  <b>Gmail</b>
                  <small>Thông báo email (để sau MVP)</small>
                </div>
                <span className="connection-status later">Chưa kết nối</span>
              </div>
              <p className="muted-note">
                Không nhập API token vào đây. Thêm CHATWORK_API_TOKEN và
                CHATWORK_ROOM_ID vào Vercel Environment Variables để tích hợp ở server.
              </p>
            </>
          )}
          {tab === "data" && (
            <>
              <div className="setting-intro">
                <h3>Sao lưu và khôi phục</h3>
                <p>Chuyển dữ liệu workspace giữa máy tính bằng JSON.</p>
              </div>
              <div className="data-actions">
                <button className="secondary-button" onClick={onExport}>
                  <Download size={16} /> Xuất bản sao JSON
                </button>
                <label className="secondary-button upload-button">
                  <FileUp size={16} /> Nhập JSON
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => onImport(e.target.files?.[0])}
                  />
                </label>
              </div>
              <div className="data-summary">
                <span>
                  Task<strong>{data.tasks.length}</strong>
                </span>
                <span>
                  Thành viên<strong>{data.members.length}</strong>
                </span>
                <span>
                  Lưu trữ<strong>Local browser</strong>
                </span>
              </div>
              <button className="danger-button ghost" onClick={onClear}>
                <Trash2 size={15} /> Xóa toàn bộ dữ liệu local
              </button>
              <p className="muted-note">
                Nhập file thay thế toàn bộ dữ liệu đang có trên trình duyệt này. Hãy
                xuất backup trước.
              </p>
            </>
          )}
          {tab === "appearance" && (
            <>
              <div className="setting-intro">
                <h3>Hiển thị và bảo mật</h3>
                <p>
                  Tùy chỉnh thông tin hiển thị và passcode khóa màn hình trên thiết bị
                  này.
                </p>
              </div>
              <label className="field">
                <span>Tên hiển thị</span>
                <input
                  value={displayName}
                  onChange={(e) => onDisplayName(e.target.value)}
                  placeholder="Ví dụ: Tuấn"
                />
              </label>
              <label className="field settings-passcode">
                <span>
                  Passcode khóa màn hình{" "}
                  <small>Để trống để không yêu cầu mật khẩu</small>
                </span>
                <div className="passcode-row">
                  <input
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Để trống"
                  />
                  <button
                    className="secondary-button"
                    onClick={() => {
                      if (safeSetLocalStorage("taskboard-lock-passcode-v1", passcode)) {
                        onClose();
                      } else {
                        onToast("Không thể lưu passcode; hãy kiểm tra quyền lưu.");
                      }
                    }}
                  >
                    Lưu passcode
                  </button>
                </div>
              </label>
              <div className="setting-row">
                <span>
                  <b>Ngôn ngữ</b>
                  <small>Ngôn ngữ ứng dụng</small>
                </span>
                <select defaultValue="vi">
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English (sắp có)</option>
                </select>
              </div>
              <p className="muted-note">
                Dark mode có thể bật nhanh bằng biểu tượng mặt trăng ở thanh trên cùng.
              </p>
            </>
          )}
        </div>
        <footer className="modal-footer">
          <span />
          <button className="primary-button" onClick={onClose}>
            Hoàn tất
          </button>
        </footer>
      </section>
    </div>
  );
}
function ConfirmDialog({
  title,
  body,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="overlay confirm-overlay">
      <section
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="confirm-icon">
          <AlertTriangle size={22} />
        </div>
        <h3 id="confirm-dialog-title">{title}</h3>
        <p>{body}</p>
        <footer>
          <button className="secondary-button" onClick={onCancel}>
            Hủy
          </button>
          <button className="danger-button" onClick={onConfirm}>
            Xác nhận
          </button>
        </footer>
      </section>
    </div>
  );
}
function LockModal({
  onClose,
  onToast,
}: {
  onClose: () => void;
  onToast: (s: string) => void;
}) {
  const [pass, setPass] = useState("");
  return (
    <div className="overlay">
      <section
        className="confirm-dialog lock-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lock-dialog-title"
      >
        <div className="confirm-icon">
          <LockKeyhole size={22} />
        </div>
        <h3 id="lock-dialog-title">Khóa màn hình</h3>
        <p>
          Màn hình khóa tiện lợi phía client. Không thay thế đăng nhập và không bảo vệ
          dữ liệu API.
        </p>
        <input
          type="password"
          placeholder="Nhập passcode để mở"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
        <footer>
          <button className="secondary-button" onClick={onClose}>
            Đóng
          </button>
          <button
            className="primary-button"
            onClick={() => {
              const expected = localStorage.getItem("taskboard-lock-passcode-v1") || "";
              if (!expected || pass === expected) {
                sessionStorage.setItem(
                  "taskboard-unlocked-until",
                  String(Date.now() + 3600000),
                );
                onToast(
                  expected
                    ? "Đã mở khóa trong 1 giờ"
                    : "Đã mở khóa; passcode đang để trống",
                );
                onClose();
              } else onToast("Passcode chưa đúng");
            }}
          >
            Mở khóa
          </button>
        </footer>
      </section>
    </div>
  );
}
