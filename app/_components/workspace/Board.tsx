"use client";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  CloudDownload,
  CloudUpload,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Filter,
  LogIn,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  Moon,
  MoreHorizontal,
  Menu,
  Plus,
  Play,
  RotateCcw,
  Search,
  Save,
  Settings2,
  Sun,
  Users,
  X,
  Link2,
  ListFilter,
} from "lucide-react";
import {
  boardSchemaVersion,
  demoData,
  maxBackupBytes,
  parseBoardDataWithError,
} from "@/lib/data";
import type {
  BoardData,
  Member,
  Priority,
  Severity,
  SavedView,
  SortMode,
  Status,
  Task,
  TaskActivity,
  TaskTemplate,
} from "@/lib/types";
import { NotificationPopover, type BoardNotification } from "./NotificationPopover";
import type { ReminderSettings } from "./WorkspaceDialogs";
import {
  getTodayTasks,
  isArchived,
  isDueToday,
  isSnoozed,
} from "@/lib/taskboard/selectors";
import { toDateInputValue } from "@/lib/taskboard/dates";
import {
  getUiCopy,
  intlLocale,
  readStoredLocale,
  writeStoredLocale,
  type AppLocale,
} from "@/lib/i18n";
import { localBoardStorage } from "@/lib/storage/board-storage";
import {
  indexedDbBoardStorage,
  type LocalWorkspaceSummary,
} from "@/lib/storage/indexed-db-board-storage";
import { localTemplateStorage } from "@/lib/storage/template-storage";
import { matchesTaskSearch } from "@/lib/taskboard/search";
import { isWithinQuietHours } from "@/lib/taskboard/notifications";
import { useBoardSync } from "@/lib/taskboard/use-board-sync";
import {
  createTaskFromTemplate,
  createTemplateFromTask,
} from "@/lib/taskboard/templates";
import { TaskBoardColumns } from "./TaskBoardColumns";
import { getAccessToken, getCurrentUser } from "@/lib/auth";
import {
  deleteTaskAttachment,
  resolveTaskAttachmentUrl,
  uploadTaskAttachment,
} from "@/lib/storage/attachment-storage";
import { supabase } from "@/lib/supabase";
import {
  createSupabaseTaskRepository,
  createSupabaseWorkspaceRepository,
  type RemoteWorkspaceMember,
} from "@/lib/repositories/task-repository";
import { can, type WorkspaceRole } from "@/lib/taskboard/permissions";
import {
  getPrimaryStatusAction,
  resolveStatusTransition,
} from "@/lib/taskboard/status-transitions";

const StructuredTaskModal = dynamic(
  () => import("./TaskModal").then((module) => module.TaskModal),
  {
    ssr: false,
    loading: () => <div className="overlay" aria-label="Đang mở biểu mẫu" />,
  },
);
const SettingsModal = dynamic(
  () => import("./WorkspaceDialogs").then((module) => module.SettingsModal),
  { ssr: false },
);
const ConfirmDialog = dynamic(
  () => import("./WorkspaceDialogs").then((module) => module.ConfirmDialog),
  { ssr: false },
);
const LockModal = dynamic(
  () => import("./WorkspaceDialogs").then((module) => module.LockModal),
  { ssr: false },
);

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
const defaultReminderSettings: ReminderSettings = {
  browserEnabled: false,
  leadDays: { Deadline: 3, "Dev up": 1, "Staging up": 1, Release: 1 },
  quietHours: { start: "22:00", end: "07:00" },
};
const reminderSettingsKey = "taskboard-reminder-settings-v1";
const browserReminderKey = "taskboard-browser-reminders-v1";
const savedViewsKey = "taskboard-saved-views-v1";
const savedViewsStorageKey = (workspaceId: string) => `${savedViewsKey}:${workspaceId}`;
const wideWorkspaceBreakpoint = 1440;
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
      quietHours: {
        start: /^\d{2}:\d{2}$/.test(value?.quietHours?.start)
          ? value.quietHours.start
          : defaultReminderSettings.quietHours.start,
        end: /^\d{2}:\d{2}$/.test(value?.quietHours?.end)
          ? value.quietHours.end
          : defaultReminderSettings.quietHours.end,
      },
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
  inbox: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});
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
function dueText(s: string, copy: ReturnType<typeof getUiCopy>) {
  if (!s) return copy.due.unset;
  const days = Math.ceil(
    (new Date(s).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000,
  );
  return days < 0
    ? copy.due.overdue(Math.abs(days))
    : days === 0
      ? copy.due.today
      : copy.due.remaining(days);
}
function dueState(s: string) {
  if (!s) return "";
  const days = Math.ceil(
    (new Date(s).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000,
  );
  return days < 0 ? "overdue" : days <= 3 ? "soon" : "";
}
function formatDate(s: string, locale: AppLocale) {
  return s
    ? new Intl.DateTimeFormat(intlLocale[locale], {
        day: "2-digit",
        month: "short",
      }).format(new Date(s))
    : "—";
}
export default function Board() {
  const router = useRouter(),
    pathname = usePathname(),
    view = pathname.startsWith("/tasks")
      ? "tasks"
      : pathname.startsWith("/inbox")
        ? "inbox"
        : pathname.startsWith("/today")
          ? "today"
          : "overview";
  const [data, setData] = useState<BoardData>(demoData),
    [now, setNow] = useState(new Date()),
    [ready, setReady] = useState(false),
    [persistenceReady, setPersistenceReady] = useState(false),
    [workspaceId, setWorkspaceId] = useState("default"),
    [localWorkspaces, setLocalWorkspaces] = useState<LocalWorkspaceSummary[]>([]),
    [remoteWorkspaceIds, setRemoteWorkspaceIds] = useState<string[]>([]),
    [remoteWorkspaceRoles, setRemoteWorkspaceRoles] = useState<
      Record<string, WorkspaceRole>
    >({}),
    [remoteMembers, setRemoteMembers] = useState<RemoteWorkspaceMember[]>([]),
    [search, setSearch] = useState(""),
    [statusFilter, setStatusFilter] = useState("all"),
    [priorityFilter, setPriorityFilter] = useState("all"),
    [assigneeFilter, setAssigneeFilter] = useState("all"),
    [dueFilter, setDueFilter] = useState("all"),
    [archiveFilter, setArchiveFilter] = useState<"active" | "archived">("active"),
    [modal, setModal] = useState<"task" | "settings" | "lock" | null>(null),
    [edit, setEdit] = useState<Task | null>(null),
    [confirm, setConfirm] = useState<string | null>(null),
    [importPreview, setImportPreview] = useState<BoardData | null>(null),
    [settingsTab, setSettingsTab] = useState("members"),
    [dark, setDark] = useState(false),
    [toast, setToast] = useState(""),
    [dragId, setDragId] = useState<string | null>(null),
    [clock, setClock] = useState(""),
    [sortMode, setSortMode] = useState<SortMode>("smart"),
    [focusMode, setFocusMode] = useState(false),
    [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]),
    [selectionMode, setSelectionMode] = useState(false),
    [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false),
    [mobileMenuOpen, setMobileMenuOpen] = useState(false),
    [savedViews, setSavedViews] = useState<SavedView[]>([]),
    [templates, setTemplates] = useState<TaskTemplate[]>([]),
    [templateCreateMode, setTemplateCreateMode] = useState(false),
    [undoState, setUndoState] = useState<{ data: BoardData; message: string } | null>(
      null,
    ),
    [notificationsOpen, setNotificationsOpen] = useState(false),
    notificationRef = useRef<HTMLDivElement>(null),
    searchRef = useRef<HTMLInputElement>(null),
    [readNotificationIds, setReadNotificationIds] = useState<string[]>([]),
    [reminderSettings, setReminderSettings] = useState<ReminderSettings>(
      defaultReminderSettings,
    ),
    [browserPermission, setBrowserPermission] = useState<
      NotificationPermission | "unsupported"
    >("default"),
    [sidebarCollapsed, setSidebarCollapsed] = useState(false),
    [displayName, setDisplayName] = useState("Tuấn"),
    [locale, setLocale] = useState<AppLocale>("vi"),
    [cloudUserEmail, setCloudUserEmail] = useState(""),
    [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const { syncState, sync, syncTask } = useBoardSync(data, setData, workspaceId);
  const cloudConfigured = Boolean(supabase);
  const copy = getUiCopy(locale);
  const currentWorkspaceRole = remoteWorkspaceRoles[workspaceId] || "owner";
  const canEditWorkspace =
    !remoteWorkspaceIds.includes(workspaceId) ||
    can(currentWorkspaceRole, "edit_tasks");
  const canManageMembers =
    !remoteWorkspaceIds.includes(workspaceId) ||
    can(currentWorkspaceRole, "manage_members");
  const labels = copy.status;
  const priorityLabels = copy.priority;
  const greeting =
    now.getHours() < 12
      ? copy.greeting.morning
      : now.getHours() < 18
        ? copy.greeting.afternoon
        : copy.greeting.evening;
  useEffect(() => {
    const loaded = localBoardStorage.loadWithError();
    const saved = loaded.data;
    setData(saved);
    setSortMode(saved.sort_mode || "smart");
    void indexedDbBoardStorage.load().then((indexedData) => {
      if (indexedData) {
        setData(indexedData);
        setSortMode(indexedData.sort_mode || "smart");
      } else {
        void indexedDbBoardStorage.save(saved);
      }
      setPersistenceReady(true);
    });
    void indexedDbBoardStorage.list().then(setLocalWorkspaces);
    if (loaded.error) {
      setToast(
        `${loaded.error} Hãy export backup nếu bạn còn bản dữ liệu cũ trước khi tiếp tục.`,
      );
    }
    setAdvancedFiltersOpen(window.innerWidth > wideWorkspaceBreakpoint);
    setReady(true);
    let storedDark = false;
    try {
      storedDark = localStorage.getItem("taskboard-dark") === "1";
    } catch {}
    setDark(storedDark);
    setDisplayName(readDisplayName());
    setLocale(readStoredLocale());
    setReminderSettings(readReminderSettings());
    if (cloudConfigured) {
      void getCurrentUser().then((user) => {
        setCloudUserEmail(user?.email || "");
        if (!user) return;
        void createSupabaseWorkspaceRepository(user.id)
          .list()
          .then((workspaces) => {
            setRemoteWorkspaceIds(workspaces.map((workspace) => workspace.id));
            setRemoteWorkspaceRoles(
              Object.fromEntries(
                workspaces.map((workspace) => [workspace.id, workspace.role]),
              ),
            );
            setLocalWorkspaces((current) => [
              ...current.filter(
                (item) => !workspaces.some((workspace) => workspace.id === item.id),
              ),
              ...workspaces.map((workspace) => ({
                id: workspace.id,
                name: workspace.name,
                updatedAt: workspace.updated_at,
              })),
            ]);
          })
          .catch(() => {
            // Local mode remains usable when the remote workspace catalog is unavailable.
          });
      });
    }
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
    return () => {
      window.removeEventListener("storage", syncDisplayName);
      window.removeEventListener("focus", syncDisplayName);
    };
  }, [cloudConfigured]);
  useEffect(() => {
    if (!ready) return;
    try {
      const scopedKey = savedViewsStorageKey(workspaceId);
      const stored = localStorage.getItem(scopedKey);
      const legacy =
        workspaceId === "default" ? localStorage.getItem(savedViewsKey) : null;
      const storedViews = JSON.parse(stored || legacy || "[]");
      const validViews = Array.isArray(storedViews)
        ? storedViews.filter(
            (view): view is SavedView =>
              view &&
              typeof view.id === "string" &&
              typeof view.name === "string" &&
              typeof view.search === "string" &&
              typeof view.status === "string" &&
              typeof view.priority === "string" &&
              typeof view.assignee === "string" &&
              typeof view.due === "string" &&
              typeof view.focus === "boolean",
          )
        : [];
      setSavedViews(validViews);
      if (!stored && legacy) safeSetLocalStorage(scopedKey, JSON.stringify(validViews));
    } catch {
      setSavedViews([]);
    }
  }, [ready, workspaceId]);
  useEffect(() => {
    if (ready) setTemplates(localTemplateStorage.load(workspaceId));
  }, [ready, workspaceId]);
  useEffect(() => {
    document.documentElement.lang = locale;
    writeStoredLocale(locale);
  }, [locale]);
  useEffect(() => {
    const tick = () => {
      const current = new Date();
      setNow(current);
      setClock(
        new Intl.DateTimeFormat(intlLocale[locale], {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(current),
      );
    };
    tick();
    const timer = setInterval(tick, 15000);
    return () => clearInterval(timer);
  }, [locale]);
  useEffect(() => {
    if (!ready || !persistenceReady) return;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      const localResult = localBoardStorage.save(data, workspaceId);
      const workspaceName =
        localWorkspaces.find((workspace) => workspace.id === workspaceId)?.name ||
        "Workspace cá nhân";
      void indexedDbBoardStorage
        .save(data, workspaceId, workspaceName)
        .then((indexedSaved) => {
          if (localResult.ok || indexedSaved) {
            setSaveStatus("saved");
            return;
          }
          setSaveStatus("error");
          setToast(
            "Không thể lưu local; hãy export backup và kiểm tra dung lượng trình duyệt.",
          );
        });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [data, localWorkspaces, persistenceReady, ready, workspaceId]);
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
    if (!undoState) return;
    const timer = setTimeout(() => setUndoState(null), 10000);
    return () => clearTimeout(timer);
  }, [undoState]);
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
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (!typing && !modal && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setEdit(null);
        setModal("task");
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
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
  const nowMs = now.getTime();
  const deferredSearch = useDeferredValue(search);
  const filtered = useMemo(
    () =>
      sorted.filter(
        (t) =>
          (archiveFilter === "active" ? !isArchived(t) : isArchived(t)) &&
          (view !== "inbox" || t.inbox === true) &&
          (statusFilter === "all" || t.status === statusFilter) &&
          (priorityFilter === "all" || t.priority === priorityFilter) &&
          (assigneeFilter === "all" ||
            (assigneeFilter === "__unassigned"
              ? !taskAssigneeIds(t).length
              : taskAssigneeIds(t).includes(assigneeFilter))) &&
          (dueFilter === "all" ||
            (dueFilter === "overdue" && dueState(t.deadline) === "overdue") ||
            (dueFilter === "today" && isDueToday(t, now)) ||
            (dueFilter === "week" &&
              Boolean(t.deadline) &&
              new Date(t.deadline).getTime() - nowMs >= 0 &&
              new Date(t.deadline).getTime() - nowMs <= 7 * 86400000)) &&
          matchesTaskSearch(t, deferredSearch, now),
      ),
    [
      sorted,
      statusFilter,
      priorityFilter,
      assigneeFilter,
      dueFilter,
      archiveFilter,
      view,
      deferredSearch,
      nowMs,
    ],
  );
  const visibleTasks = useMemo(
    () =>
      focusMode
        ? filtered.filter(
            (task) =>
              task.status !== "done" &&
              (task.priority === "urgent" ||
                task.priority === "high" ||
                task.status === "blocked" ||
                !taskAssigneeIds(task).length ||
                Boolean(dueState(task.deadline))),
          )
        : filtered,
    [filtered, focusMode],
  );
  const active = useMemo(
    () => data.tasks.filter((t) => t.status !== "done" && !isArchived(t)),
    [data.tasks],
  );
  const inboxTasks = useMemo(
    () => data.tasks.filter((task) => task.inbox === true && !isArchived(task)),
    [data.tasks],
  );
  const todayTasks = useMemo(() => getTodayTasks(data.tasks, now), [data.tasks, now]);
  const isInReminderWindow = (date: string, label: ReminderLabel) => {
    const diff = new Date(date).getTime() - nowMs;
    return diff >= -86400000 && diff <= reminderSettings.leadDays[label] * 86400000;
  };
  const isQuietHours = (date = now) => {
    return isWithinQuietHours(
      date,
      reminderSettings.quietHours.start,
      reminderSettings.quietHours.end,
    );
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
          detail: `${item.task.code || "TASK"} · ${dueText(item.date, copy)}`,
          overdue,
          read: readNotificationIds.includes(`${item.task.id}-${item.label}`),
        };
      }),
    [copy, nowMs, readNotificationIds, reminderItems],
  );
  useEffect(() => {
    if (
      !ready ||
      !reminderSettings.browserEnabled ||
      browserPermission !== "granted" ||
      isQuietHours()
    )
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
            body: `${task.code || "TASK"} · ${dueText(date, copy)}`,
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
  }, [active, browserPermission, copy, nowMs, ready, reminderSettings]);
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
  const switchWorkspace = async (nextId: string) => {
    if (!nextId || nextId === workspaceId) return;
    const currentName =
      localWorkspaces.find((workspace) => workspace.id === workspaceId)?.name ||
      "Workspace cá nhân";
    const localSaved = localBoardStorage.save(data, workspaceId);
    await indexedDbBoardStorage.save(data, workspaceId, currentName);
    if (!localSaved.ok) {
      setToast("Không thể lưu fallback workspace; IndexedDB vẫn sẽ được dùng.");
    }
    let nextData: BoardData | null = null;
    if (remoteWorkspaceIds.includes(nextId) && cloudUserEmail) {
      const user = await getCurrentUser();
      if (user) {
        try {
          const workspaceRepository = createSupabaseWorkspaceRepository(user.id);
          const [snapshot, memberships, taskMembers] = await Promise.all([
            createSupabaseTaskRepository(user.id, nextId).loadWithRevision(),
            workspaceRepository.listMembers(nextId),
            workspaceRepository.listTaskMembers(nextId),
          ]);
          nextData = {
            ...snapshot.data,
            members: taskMembers.length ? taskMembers : snapshot.data.members,
          };
          setRemoteMembers(memberships);
        } catch (error) {
          setToast(
            error instanceof Error ? error.message : "Không thể mở workspace cloud.",
          );
          return;
        }
      }
    } else {
      nextData = await indexedDbBoardStorage.load(nextId);
      setRemoteMembers([]);
    }
    if (!nextData) {
      setToast("Không thể mở workspace này; dữ liệu có thể đã bị xóa hoặc hỏng.");
      return;
    }
    setWorkspaceId(nextId);
    setData(nextData);
    setSortMode(nextData.sort_mode || "smart");
    setSelectedTaskIds([]);
    setSelectionMode(false);
    setToast(
      `Đã chuyển sang ${localWorkspaces.find((workspace) => workspace.id === nextId)?.name || "workspace"}`,
    );
  };
  const createWorkspace = async () => {
    const name = window.prompt("Tên workspace mới", "Workspace mới")?.trim();
    if (!name) return;
    if (cloudConfigured && cloudUserEmail) {
      const user = await getCurrentUser();
      if (user) {
        try {
          const workspaceRepository = createSupabaseWorkspaceRepository(user.id);
          const workspace = await workspaceRepository.create(name);
          const initialData: BoardData = {
            ...demoData,
            tasks: [],
            members: [],
            code_prefix: data.code_prefix || "MENSQZIN-",
            sort_mode: "smart",
          };
          try {
            await createSupabaseTaskRepository(user.id, workspace.id).save(initialData);
          } catch (snapshotError) {
            await workspaceRepository.remove(workspace.id).catch(() => undefined);
            throw snapshotError;
          }
          setRemoteWorkspaceIds((items) => [...items, workspace.id]);
          setRemoteWorkspaceRoles((items) => ({ ...items, [workspace.id]: "owner" }));
          setLocalWorkspaces((items) => [
            ...items,
            { id: workspace.id, name: workspace.name, updatedAt: workspace.updated_at },
          ]);
          setWorkspaceId(workspace.id);
          setRemoteMembers([
            {
              workspace_id: workspace.id,
              user_id: user.id,
              role: "owner",
              created_at: new Date().toISOString(),
            },
          ]);
          setData(initialData);
          setSortMode("smart");
          setSelectedTaskIds([]);
          setSelectionMode(false);
          setToast(`Đã tạo ${name} trên cloud`);
          return;
        } catch (error) {
          setToast(
            error instanceof Error ? error.message : "Không thể tạo workspace cloud.",
          );
          return;
        }
      }
    }
    const id = crypto.randomUUID();
    const emptyWorkspace: BoardData = {
      ...demoData,
      tasks: [],
      members: [],
      code_prefix: data.code_prefix || "MENSQZIN-",
      sort_mode: "smart",
    };
    const saved = await indexedDbBoardStorage.save(emptyWorkspace, id, name);
    if (!saved) {
      setToast("Không thể tạo workspace; hãy kiểm tra quyền lưu trên trình duyệt.");
      return;
    }
    setLocalWorkspaces((items) => [
      ...items,
      { id, name, updatedAt: new Date().toISOString() },
    ]);
    // Activate the newly-created record directly. Calling switchWorkspace here
    // would read localWorkspaces from the current render and can therefore save
    // the new workspace with a stale name or race the state update.
    setWorkspaceId(id);
    setData(emptyWorkspace);
    setSortMode("smart");
    setSelectedTaskIds([]);
    setSelectionMode(false);
    setToast(`Đã tạo ${name}`);
  };
  const updateRemoteMemberRole = async (
    userId: string,
    role: RemoteWorkspaceMember["role"],
  ) => {
    if (!remoteWorkspaceIds.includes(workspaceId) || !canManageMembers) {
      setToast("Bạn không có quyền quản lý thành viên workspace này.");
      return;
    }
    const user = await getCurrentUser();
    if (!user) return;
    try {
      await createSupabaseWorkspaceRepository(user.id).setMemberRole(
        workspaceId,
        userId,
        role,
      );
      setRemoteMembers((members) =>
        members.some((member) => member.user_id === userId)
          ? members.map((member) =>
              member.user_id === userId ? { ...member, role } : member,
            )
          : [
              ...members,
              {
                workspace_id: workspaceId,
                user_id: userId,
                role,
                created_at: new Date().toISOString(),
              },
            ],
      );
      setToast("Đã cập nhật quyền thành viên.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Không thể cập nhật quyền.");
    }
  };
  const removeRemoteMember = async (userId: string) => {
    if (!remoteWorkspaceIds.includes(workspaceId) || !canManageMembers) {
      setToast("Bạn không có quyền quản lý thành viên workspace này.");
      return;
    }
    const user = await getCurrentUser();
    if (!user) return;
    if (userId === user.id) {
      setToast("Không thể tự xóa owner khỏi workspace.");
      return;
    }
    try {
      await createSupabaseWorkspaceRepository(user.id).removeMember(
        workspaceId,
        userId,
      );
      setRemoteMembers((members) =>
        members.filter((member) => member.user_id !== userId),
      );
      setToast("Đã xóa thành viên khỏi workspace.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Không thể xóa thành viên.");
    }
  };
  const inviteRemoteMember = async (
    email: string,
    role: RemoteWorkspaceMember["role"],
  ) => {
    if (!remoteWorkspaceIds.includes(workspaceId) || !canManageMembers) {
      setToast("Bạn không có quyền mời thành viên workspace này.");
      return;
    }
    const token = await getAccessToken();
    if (!token) {
      setToast("Phiên cloud đã hết hạn; hãy đăng nhập lại rồi thử mời.");
      return;
    }
    try {
      const response = await fetch("/api/workspaces/invites", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workspaceId, email, role }),
      });
      const payload = (await response.json()) as {
        error?: string;
        user_id?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Không thể gửi lời mời.");
      const user = await getCurrentUser();
      if (user) {
        const members = await createSupabaseWorkspaceRepository(user.id).listMembers(
          workspaceId,
        );
        setRemoteMembers(members);
      }
      setToast(`Đã gửi lời mời tới ${email}.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Không thể gửi lời mời.");
    }
  };
  const toggleTaskSelection = (id: string) => {
    setSelectedTaskIds((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  };
  const toggleSelectionMode = () => {
    setSelectionMode((enabled) => {
      if (enabled) setSelectedTaskIds([]);
      return !enabled;
    });
  };
  const copyTaskCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setToast(`Đã copy mã ${code}`);
    } catch {
      setToast("Không thể copy mã task; hãy thử lại trên HTTPS.");
    }
  };
  const saveCurrentView = () => {
    const name = window.prompt("Tên view cần lưu", focusMode ? "Focus" : "Kanban");
    if (!name?.trim()) return;
    const view: SavedView = {
      id: crypto.randomUUID(),
      name: name.trim().slice(0, 80),
      search,
      status: statusFilter,
      priority: priorityFilter,
      assignee: assigneeFilter,
      due: dueFilter,
      focus: focusMode,
      archive: archiveFilter,
    };
    const nextViews = [...savedViews, view].slice(-12);
    setSavedViews(nextViews);
    if (
      !safeSetLocalStorage(savedViewsStorageKey(workspaceId), JSON.stringify(nextViews))
    ) {
      setToast("Không thể lưu view; hãy kiểm tra quyền lưu của trình duyệt.");
    } else {
      setToast(`Đã lưu view “${view.name}”`);
    }
  };
  const applySavedView = (id: string) => {
    const view = savedViews.find((item) => item.id === id);
    if (!view) return;
    setSearch(view.search);
    setStatusFilter(view.status);
    setPriorityFilter(view.priority);
    setAssigneeFilter(view.assignee);
    setDueFilter(view.due);
    setArchiveFilter(view.archive || "active");
    setFocusMode(view.focus);
    setAdvancedFiltersOpen(view.assignee !== "all" || view.due !== "all");
  };
  const rememberUndo = (message: string) => setUndoState({ data, message });
  const undoLast = () => {
    if (!undoState) return;
    const timestamp = new Date().toISOString();
    const restoredTasks = undoState.data.tasks.map((task) => ({
      ...task,
      updated_at: timestamp,
    }));
    const restoredIds = new Set(restoredTasks.map((task) => task.id));
    const remoteOnlyTasks = data.tasks
      .filter((task) => !restoredIds.has(task.id))
      .map((task) => ({
        ...task,
        archived_at: task.archived_at || timestamp,
        updated_at: timestamp,
      }));
    setData({ ...undoState.data, tasks: restoredTasks });
    if (cloudConfigured && cloudUserEmail) {
      syncRemoteTasks(restoredTasks);
      remoteOnlyTasks.forEach((task) => void syncTask(task));
    }
    setUndoState(null);
    setToast(`Đã hoàn tác: ${undoState.message}`);
  };
  const syncRemoteTasks = (tasks: Task[]) => {
    if (!cloudConfigured || !cloudUserEmail) return;
    tasks.forEach((task) => void syncTask(task));
  };
  const bulkUpdateTasks = (patch: Partial<Task>, message: string) => {
    if (!canEditWorkspace) {
      setToast("Bạn chỉ có quyền xem workspace này.");
      return;
    }
    if (!selectedTaskIds.length) return;
    rememberUndo(message);
    const selected = new Set(selectedTaskIds);
    const timestamp = new Date().toISOString();
    const updatedTasks = data.tasks.map((task) =>
      selected.has(task.id)
        ? {
            ...task,
            ...patch,
            updated_at: timestamp,
            activity: [
              ...(task.activity || []),
              {
                id: crypto.randomUUID(),
                type: "updated" as const,
                at: timestamp,
                summary: message,
              },
            ].slice(-200),
          }
        : task,
    );
    setData((d) => ({ ...d, tasks: updatedTasks }));
    syncRemoteTasks(updatedTasks.filter((task) => selected.has(task.id)));
    setSelectedTaskIds([]);
    setToast(message);
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
  const workload = useMemo(
    () =>
      data.members
        .map((member) => {
          const tasks = active.filter((task) =>
            taskAssigneeIds(task).includes(member.id),
          );
          return {
            member,
            total: tasks.length,
            urgent: tasks.filter((task) => task.priority === "urgent").length,
            overdue: tasks.filter(
              (task) => task.deadline && new Date(task.deadline).getTime() < nowMs,
            ).length,
          };
        })
        .filter((item) => item.total > 0)
        .sort((a, b) => b.total - a.total || b.overdue - a.overdue),
    [active, data.members, nowMs],
  );
  const saveTask = (task: Task) => {
    if (!canEditWorkspace) {
      setToast("Bạn chỉ có quyền xem workspace này.");
      return;
    }
    const timestamp = new Date().toISOString();
    const previous =
      edit && !templateCreateMode
        ? data.tasks.find((item) => item.id === task.id)
        : undefined;
    if (!previous && task.status !== "todo") {
      setToast("⚠️ Task mới phải bắt đầu ở trạng thái Chưa làm.");
      return;
    }
    if (previous) {
      const transition = resolveStatusTransition(
        previous.status,
        task.status,
        previous.blocked_from,
      );
      if (!transition.allowed) {
        setToast(`⚠️ ${transition.warning || "Không thể chuyển trạng thái task."}`);
        return;
      }
      task = {
        ...task,
        status: transition.target,
        ...(transition.target === "blocked"
          ? { blocked_from: transition.blocked_from }
          : { blocked_from: undefined }),
      };
    }
    rememberUndo(edit && !templateCreateMode ? "cập nhật task" : "tạo task");
    if (previous) {
      const nextPaths = new Set(
        (task.attachments || []).map((item) => item.storage_path),
      );
      const removedPaths = (previous.attachments || [])
        .map((item) => item.storage_path)
        .filter((path): path is string => Boolean(path) && !nextPaths.has(path));
      void Promise.all(removedPaths.map((path) => deleteTaskAttachment(path))).catch(
        (error) =>
          setToast(
            error instanceof Error ? error.message : "Không thể dọn file đã xóa.",
          ),
      );
    }
    const activityType: TaskActivity["type"] = !previous
      ? "created"
      : previous.status !== task.status
        ? "status_changed"
        : previous.priority !== task.priority
          ? "priority_changed"
          : previous.assignee_ids?.join(",") !== task.assignee_ids?.join(",")
            ? "assigned"
            : "updated";
    const changes = previous
      ? [
          previous.status !== task.status
            ? {
                field: "Trạng thái",
                from: labels[previous.status],
                to: labels[task.status],
              }
            : null,
          previous.priority !== task.priority
            ? {
                field: "Ưu tiên",
                from: priorityLabels[previous.priority],
                to: priorityLabels[task.priority],
              }
            : null,
          previous.deadline !== task.deadline
            ? {
                field: "Deadline",
                from: previous.deadline || "Chưa đặt",
                to: task.deadline || "Chưa đặt",
              }
            : null,
          previous.assignee_ids?.join(",") !== task.assignee_ids?.join(",")
            ? {
                field: "Người phụ trách",
                from: String(previous.assignee_ids?.length || 0),
                to: String(task.assignee_ids?.length || 0),
              }
            : null,
          (previous.checklist?.length || 0) !== (task.checklist?.length || 0)
            ? {
                field: "Checklist",
                from: String(previous.checklist?.length || 0),
                to: String(task.checklist?.length || 0),
              }
            : null,
        ].filter((change): change is NonNullable<typeof change> => Boolean(change))
      : [];
    const activity: TaskActivity = {
      id: crypto.randomUUID(),
      type: activityType,
      at: timestamp,
      summary: !previous
        ? "Đã tạo task"
        : activityType === "status_changed"
          ? `Đổi trạng thái thành ${labels[task.status]}`
          : activityType === "priority_changed"
            ? `Đổi ưu tiên thành ${priorityLabels[task.priority]}`
            : activityType === "assigned"
              ? "Cập nhật người phụ trách"
              : "Cập nhật thông tin task",
      changes: changes.length ? changes : undefined,
    };
    const nextTask: Task = {
      ...task,
      order_index: edit && !templateCreateMode ? task.order_index : data.tasks.length,
      updated_at: timestamp,
      activity: [...(task.activity || []), activity].slice(-200),
    };
    setData((d) => ({
      ...d,
      code_prefix: d.code_prefix || "MENSQZIN-",
      sort_mode: d.sort_mode || sortMode,
      tasks:
        edit && !templateCreateMode
          ? d.tasks.map((item) => (item.id === task.id ? nextTask : item))
          : [nextTask, ...d.tasks],
    }));
    syncRemoteTasks([nextTask]);
    setModal(null);
    setEdit(null);
    setTemplateCreateMode(false);
    setToast(edit && !templateCreateMode ? "Đã cập nhật task" : "Đã tạo task");
  };
  const quickUpdateStatus = (task: Task) => {
    if (!canEditWorkspace) {
      setToast("Bạn chỉ có quyền xem workspace này.");
      return;
    }
    const action = getPrimaryStatusAction(task);
    const transition = resolveStatusTransition(
      task.status,
      action.target,
      task.blocked_from,
    );
    if (!transition.allowed) {
      setToast(`⚠️ ${transition.warning || "Không thể chuyển trạng thái task."}`);
      return;
    }
    const nextStatus = transition.target;
    const summary = transition.summary;
    rememberUndo(summary);
    const timestamp = new Date().toISOString();
    const activity: TaskActivity = {
      id: crypto.randomUUID(),
      type: "status_changed",
      at: timestamp,
      summary,
      changes: [
        {
          field: "Trạng thái",
          from: labels[task.status],
          to: labels[nextStatus],
        },
      ],
    };
    const nextTask: Task = {
      ...task,
      status: nextStatus,
      ...(nextStatus === "blocked"
        ? { blocked_from: transition.blocked_from }
        : { blocked_from: undefined }),
      updated_at: timestamp,
      activity: [...(task.activity || []), activity].slice(-200),
    };
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((current) => (current.id === task.id ? nextTask : current)),
    }));
    setToast(summary);
    syncRemoteTasks([nextTask]);
  };
  const quickSnooze = (task: Task) => {
    if (!canEditWorkspace) {
      setToast("Bạn chỉ có quyền xem workspace này.");
      return;
    }
    const timestamp = new Date().toISOString();
    const until = new Date(Date.now() + 86400000).toISOString();
    rememberUndo("hoãn task 1 ngày");
    const activity: TaskActivity = {
      id: crypto.randomUUID(),
      type: "snoozed",
      at: timestamp,
      summary: "Đã hoãn task 1 ngày",
      changes: [
        {
          field: "Hoãn đến",
          from: task.snoozed_until || "Chưa hoãn",
          to: until,
        },
      ],
    };
    const nextTask: Task = {
      ...task,
      snoozed_until: until,
      updated_at: timestamp,
      activity: [...(task.activity || []), activity].slice(-200),
    };
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((current) => (current.id === task.id ? nextTask : current)),
    }));
    setToast("Đã hoãn task 1 ngày; task sẽ quay lại Today sau đó.");
    syncRemoteTasks([nextTask]);
  };
  const removeTask = (id: string) => {
    rememberUndo("lưu trữ task");
    const timestamp = new Date().toISOString();
    const archivedTask = data.tasks.find((task) => task.id === id);
    if (!archivedTask) return;
    const activity: TaskActivity = {
      id: crypto.randomUUID(),
      type: "updated",
      at: timestamp,
      summary: "Đã lưu trữ task",
    };
    const nextTask: Task = {
      ...archivedTask,
      archived_at: timestamp,
      updated_at: timestamp,
      activity: [...(archivedTask.activity || []), activity].slice(-200),
    };
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((task) => (task.id === id ? nextTask : task)),
    }));
    setConfirm(null);
    setModal(null);
    setToast("Đã lưu trữ task");
    syncRemoteTasks([nextTask]);
  };
  const saveTemplateFromTask = (task: Task) => {
    const name = window.prompt("Tên template", task.title.slice(0, 80));
    if (!name?.trim()) return;
    const next = [...templates, createTemplateFromTask(task, name)].slice(-50);
    if (!localTemplateStorage.save(next, workspaceId)) {
      setToast("Không thể lưu template vào trình duyệt.");
      return;
    }
    setTemplates(next);
    setToast("Đã lưu template");
  };
  const uploadAttachment = async (file: File) => {
    if (!canEditWorkspace) {
      setToast("Bạn chỉ có quyền xem workspace này.");
      return null;
    }
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error("Hãy đăng nhập Supabase để upload file.");
      return await uploadTaskAttachment(
        file,
        user.id,
        remoteWorkspaceIds.includes(workspaceId) ? workspaceId : undefined,
      );
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Upload file thất bại.");
      return null;
    }
  };
  const resolveAttachmentUrl = async (storagePath: string) =>
    resolveTaskAttachmentUrl(storagePath);
  const restoreTask = (id: string) => {
    rememberUndo("khôi phục task");
    const timestamp = new Date().toISOString();
    const archivedTask = data.tasks.find((task) => task.id === id);
    if (!archivedTask) return;
    const activity: TaskActivity = {
      id: crypto.randomUUID(),
      type: "updated",
      at: timestamp,
      summary: "Đã khôi phục task",
    };
    const nextTask: Task = {
      ...archivedTask,
      archived_at: undefined,
      updated_at: timestamp,
      activity: [...(archivedTask.activity || []), activity].slice(-200),
    };
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((task) => (task.id === id ? nextTask : task)),
    }));
    syncRemoteTasks([nextTask]);
    setModal(null);
    setToast("Đã khôi phục task");
  };
  const reorder = (target: string) => {
    if (!canEditWorkspace) {
      setToast("Bạn chỉ có quyền xem workspace này.");
      return;
    }
    if (!dragId || dragId === target) return;
    rememberUndo("đổi thứ tự task");
    const list = [...ordered],
      from = list.findIndex((t) => t.id === dragId),
      to = list.findIndex((t) => t.id === target);
    if (from < 0 || to < 0) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    const timestamp = new Date().toISOString();
    const previousOrder = new Map(
      data.tasks.map((task) => [task.id, task.order_index]),
    );
    const nextTasks = list.map((t, i) =>
      previousOrder.get(t.id) === i
        ? { ...t, order_index: i }
        : { ...t, order_index: i, updated_at: timestamp },
    );
    setData((d) => ({ ...d, sort_mode: "manual", tasks: nextTasks }));
    syncRemoteTasks(nextTasks.filter((task) => task.updated_at === timestamp));
    setSortMode("manual");
    setDragId(null);
  };
  const dropOnStatus = (status: Status, target?: string) => {
    if (!canEditWorkspace) {
      setToast("Bạn chỉ có quyền xem workspace này.");
      return;
    }
    if (!dragId) return;
    const list = [...ordered],
      from = list.findIndex((t) => t.id === dragId);
    if (from < 0) return;
    const source = list[from];
    const transition = resolveStatusTransition(
      source.status,
      status,
      source.blocked_from,
    );
    if (!transition.allowed) {
      setToast(`⚠️ ${transition.warning || "Không thể chuyển trạng thái task."}`);
      return;
    }
    rememberUndo(
      transition.target === "done" ? "hoàn tất task" : "chuyển trạng thái task",
    );
    const [item] = list.splice(from, 1);
    const timestamp = new Date().toISOString();
    const moved = {
      ...item,
      status: transition.target,
      ...(transition.target === "blocked"
        ? { blocked_from: transition.blocked_from }
        : { blocked_from: undefined }),
      updated_at: timestamp,
      activity:
        transition.target === item.status
          ? item.activity
          : [
              ...(item.activity || []),
              {
                id: crypto.randomUUID(),
                type: "status_changed" as const,
                at: timestamp,
                summary: transition.summary,
              },
            ].slice(-200),
    };
    let insertAt = target ? list.findIndex((t) => t.id === target) : -1;
    if (insertAt < 0) {
      const same = list
        .map((t) => (t.status === status ? list.indexOf(t) : -1))
        .filter((i) => i >= 0);
      insertAt = same.length ? same[same.length - 1] + 1 : list.length;
    }
    list.splice(insertAt, 0, moved);
    const previousOrder = new Map(
      data.tasks.map((task) => [task.id, task.order_index]),
    );
    const nextTasks = list.map((t, i) => {
      const changed = t.id === moved.id || previousOrder.get(t.id) !== i;
      return changed
        ? { ...t, order_index: i, updated_at: timestamp }
        : { ...t, order_index: i };
    });
    setData((d) => ({ ...d, sort_mode: "manual", tasks: nextTasks }));
    syncRemoteTasks(nextTasks.filter((task) => task.updated_at === timestamp));
    setSortMode("manual");
    setDragId(null);
    setToast(status === item.status ? "Đã đổi vị trí task" : transition.summary);
  };
  const dropTask = (target: Task) => {
    if (!canEditWorkspace) return;
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
    a.download = `taskboard-backup-${toDateInputValue(new Date().toISOString())}.json`;
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
        if (
          !parsed ||
          (parsed.schema_version !== 1 && parsed.schema_version !== boardSchemaVersion)
        ) {
          throw new Error(
            `File không đúng schema Taskboard v1/v${boardSchemaVersion}.`,
          );
        }
        const result = parseBoardDataWithError(parsed);
        if (!result.data)
          throw new Error(result.error || "Dữ liệu backup không hợp lệ.");
        setImportPreview(result.data);
        setToast(
          "Đã đọc backup. Hãy kiểm tra bản xem trước trước khi thay thế dữ liệu.",
        );
      } catch (e) {
        setToast(e instanceof Error ? e.message : "Không thể đọc file");
      }
    };
    reader.onerror = () => setToast("Không thể đọc file backup từ thiết bị.");
    reader.readAsText(file);
  };
  const setMember = (m: Member) => {
    if (!canManageMembers) {
      setToast("Bạn không có quyền quản lý thành viên workspace này.");
      return;
    }
    setData((d) => ({
      ...d,
      members: d.members.some((x) => x.id === m.id)
        ? d.members.map((x) => (x.id === m.id ? m : x))
        : [...d.members, m],
    }));
  };
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
        if (selectionMode) {
          toggleTaskSelection(t.id);
          return;
        }
        setEdit(t);
        setModal("task");
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (selectionMode) {
            toggleTaskSelection(t.id);
            return;
          }
          setEdit(t);
          setModal("task");
        }
      }}
    >
      <div className="task-top">
        {selectionMode && (
          <input
            className="task-select"
            type="checkbox"
            checked={selectedTaskIds.includes(t.id)}
            aria-label={`Chọn task ${t.code || "TASK"}`}
            onClick={(event) => event.stopPropagation()}
            onChange={() => toggleTaskSelection(t.id)}
          />
        )}
        {/* <span
          className={`urgency-dot ${t.priority}`}
          title={`Ưu tiên ${priorityLabels[t.priority]}`}
        /> */}
        <button
          className="task-code-copy"
          type="button"
          title={`Copy mã ${t.code || "TASK"}`}
          aria-label={`Copy mã ${t.code || "TASK"}`}
          onClick={(event) => {
            event.stopPropagation();
            void copyTaskCode(t.code || "TASK");
          }}
        >
          <span className="task-code">{t.code || "TASK"}</span>
          <Copy size={12} aria-hidden="true" />
        </button>
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
          title="Mở chi tiết task"
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
      {t.next_action && <p className="task-next-action">→ {t.next_action}</p>}
      {t.checklist?.length ? (
        <p className="task-checklist-progress">
          <CheckCheck size={12} /> {t.checklist.filter((item) => item.done).length}/
          {t.checklist.length} bước hoàn tất
        </p>
      ) : null}
      {t.blocked_by?.length ? (
        <p className="task-dependency">Phụ thuộc {t.blocked_by.length} task</p>
      ) : null}
      {!selectionMode && (
        <div className="task-card-actions" onClick={(event) => event.stopPropagation()}>
          {(() => {
            const action = getPrimaryStatusAction(t);
            return (
              <button
                type="button"
                className={`task-quick-action${
                  t.status === "review" ? " success" : ""
                }`}
                title={action.title}
                aria-label={action.title}
                onClick={() => quickUpdateStatus(t)}
              >
                {t.status === "blocked" ? (
                  <RotateCcw size={13} />
                ) : t.status === "review" ? (
                  <CheckCircle2 size={13} />
                ) : (
                  <Play size={13} />
                )}
                {action.label}
              </button>
            );
          })()}
          <button
            type="button"
            className="task-quick-action secondary"
            title="Hoãn task 1 ngày khỏi Today"
            aria-label={`Hoãn ${t.code || "task"} 1 ngày`}
            onClick={() => quickSnooze(t)}
          >
            <Clock3 size={13} />
            Hoãn 1 ngày
          </button>
        </div>
      )}
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
          {t.deadline ? dueText(t.deadline, copy) : copy.due.unset}
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
          <button
            className={view === "today" ? "nav-item active" : "nav-item"}
            onClick={() => router.push("/today")}
          >
            <CalendarDays size={18} />
            Hôm nay<span className="nav-count">{todayTasks.length}</span>
          </button>
          <button
            className={view === "inbox" ? "nav-item active" : "nav-item"}
            onClick={() => router.push("/inbox")}
          >
            <ListTodo size={18} />
            Inbox<span className="nav-count">{inboxTasks.length}</span>
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
            {view === "overview"
              ? "Tổng quan"
              : view === "today"
                ? "Hôm nay"
                : "Danh sách task"}
          </div>
          <div className="top-actions">
            <button
              className="mobile-menu-button"
              aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
              title={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
            {mobileMenuOpen && (
              <>
                <button
                  className="mobile-nav-backdrop"
                  aria-label="Đóng menu"
                  onClick={() => setMobileMenuOpen(false)}
                />
                <nav className="mobile-nav" aria-label="Điều hướng mobile">
                  <div className="mobile-nav-header">
                    <b>Menu</b>
                    <button
                      className="mobile-nav-close"
                      aria-label="Đóng menu"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <X size={17} />
                    </button>
                  </div>
                  <button
                    className={view === "overview" ? "active" : ""}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      router.push("/");
                    }}
                  >
                    <LayoutDashboard size={17} /> Tổng quan
                  </button>
                  <button
                    className={view === "tasks" ? "active" : ""}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      router.push("/tasks");
                    }}
                  >
                    <ListTodo size={17} /> Danh sách task
                    <span>{active.length}</span>
                  </button>
                  <button
                    className={view === "today" ? "active" : ""}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      router.push("/today");
                    }}
                  >
                    <CalendarDays size={17} /> Hôm nay
                    <span>{todayTasks.length}</span>
                  </button>
                  <button
                    className={view === "inbox" ? "active" : ""}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      router.push("/inbox");
                    }}
                  >
                    <ListTodo size={17} /> Inbox
                    <span>{inboxTasks.length}</span>
                  </button>
                </nav>
              </>
            )}
            <div className="live-date">
              <span className="live-dot" />
              {clock}
            </div>
            <span className={`autosave-status ${saveStatus}`} aria-live="polite">
              {saveStatus === "saving"
                ? "Đang lưu"
                : saveStatus === "error"
                  ? "Lỗi lưu"
                  : "Đã lưu"}
            </span>
            <div className="workspace-switcher-wrap">
              <select
                className="workspace-switcher"
                aria-label="Chọn workspace"
                value={workspaceId}
                onChange={(event) => void switchWorkspace(event.target.value)}
              >
                {!localWorkspaces.some((workspace) => workspace.id === "default") && (
                  <option value="default">Workspace cá nhân</option>
                )}
                {localWorkspaces.map((workspace) => (
                  <option value={workspace.id} key={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
              <button
                className="icon-button mini"
                type="button"
                aria-label="Tạo workspace"
                title="Tạo workspace mới"
                onClick={() => void createWorkspace()}
              >
                <Plus size={14} />
              </button>
            </div>
            <span
              className={`sync-status sync-${syncState.status}`}
              title={
                syncState.status === "error"
                  ? syncState.message
                  : !cloudConfigured
                    ? "Local mode: dữ liệu được lưu trong trình duyệt này"
                    : cloudUserEmail
                      ? `Cloud đã kết nối: ${cloudUserEmail}`
                      : "Cloud đã cấu hình nhưng chưa đăng nhập"
              }
              aria-live="polite"
            >
              {!cloudConfigured
                ? "Local"
                : syncState.status === "syncing"
                  ? "Đang sync"
                  : syncState.status === "synced"
                    ? "Cloud đã sync"
                    : syncState.status === "error"
                      ? "Sync lỗi"
                      : cloudUserEmail
                        ? "Cloud đã kết nối"
                        : "Cloud cần đăng nhập"}
            </span>
            {cloudConfigured && cloudUserEmail ? (
              <>
                <button
                  className="icon-button"
                  aria-label="Đẩy workspace lên cloud"
                  title="Đẩy workspace lên cloud"
                  onClick={() => void sync("push")}
                  disabled={syncState.status === "syncing"}
                >
                  <CloudUpload size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Tải workspace từ cloud"
                  title="Tải workspace từ cloud"
                  onClick={() => void sync("pull")}
                  disabled={syncState.status === "syncing"}
                >
                  <CloudDownload size={17} />
                </button>
              </>
            ) : cloudConfigured ? (
              <button
                className="icon-button"
                aria-label="Đăng nhập cloud"
                title="Đăng nhập cloud để đồng bộ workspace"
                onClick={() => router.push("/login")}
              >
                <LogIn size={17} />
              </button>
            ) : null}
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
              title={dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-button"
              aria-label="Cài đặt"
              title="Mở cài đặt workspace"
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
                ) : view === "today" ? (
                  "Hôm nay"
                ) : view === "inbox" ? (
                  "Inbox cần triage"
                ) : (
                  "Danh sách task"
                )}{" "}
                <span>✦</span>
              </h1>
              <p>
                {view === "overview"
                  ? "Một cái nhìn nhanh về tiến độ, rủi ro và các mốc sắp tới."
                  : view === "today"
                    ? "Các việc quá hạn, đến hạn hôm nay và ưu tiên khẩn cần được xử lý trước."
                    : view === "inbox"
                      ? "Các task mới cần được phân loại, giao người và đặt bước tiếp theo."
                      : "Tìm, lọc, tạo và cập nhật mọi task trong workspace."}
              </p>
            </div>
            {(view === "tasks" || view === "today" || view === "inbox") && (
              <div className="page-actions">
                {templates.length > 0 && (
                  <select
                    className="template-select"
                    aria-label="Tạo task từ template"
                    defaultValue=""
                    disabled={!canEditWorkspace}
                    onChange={(event) => {
                      const template = templates.find(
                        (item) => item.id === event.target.value,
                      );
                      event.currentTarget.value = "";
                      if (!template) return;
                      setTemplateCreateMode(true);
                      setEdit(
                        createTaskFromTemplate(
                          template,
                          `${data.code_prefix || "MENSQZIN-"}NEW`,
                        ),
                      );
                      setModal("task");
                    }}
                  >
                    <option value="">Template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  className="primary-button"
                  disabled={!canEditWorkspace}
                  onClick={() => {
                    setTemplateCreateMode(false);
                    setEdit(null);
                    setModal("task");
                  }}
                >
                  <Plus size={17} /> {canEditWorkspace ? "Tạo task" : "Chỉ xem"}
                </button>
              </div>
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
                      <ArrowDownUp size={15} /> Mở danh sách
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
                              {t.deadline ? dueText(t.deadline, copy) : copy.due.unset}
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
                <section className="panel workload-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Tải công việc</h2>
                      <p>Task đang mở theo người phụ trách</p>
                    </div>
                    <span className="round-icon">
                      <Users size={17} />
                    </span>
                  </div>
                  {workload.length ? (
                    <div className="workload-list">
                      {workload.map(({ member, total, urgent, overdue }) => (
                        <div className="workload-row" key={member.id}>
                          <span className={`avatar avatar-${member.color}`}>
                            {member.name.slice(0, 1)}
                          </span>
                          <span className="workload-name">
                            <b>{member.name}</b>
                            <small>{member.role}</small>
                          </span>
                          <span className="workload-count">{total}</span>
                          {(urgent > 0 || overdue > 0) && (
                            <small className="workload-risk">
                              {urgent ? `${urgent} khẩn` : `${overdue} quá hạn`}
                            </small>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-small">Chưa có task đang mở theo người.</div>
                  )}
                </section>
              </div>
            </>
          )}
          <div
            className={
              view === "tasks" || view === "today" || view === "inbox"
                ? "tasks-layout"
                : "overview-layout"
            }
          >
            {(view === "tasks" || view === "today" || view === "inbox") && (
              <section className="tasks-panel panel">
                <div className="panel-heading">
                  <div>
                    <h2>Ưu tiên công việc</h2>
                    <p>
                      {(view === "today" ? todayTasks : visibleTasks).length} task
                      {view === "today"
                        ? " cần xử lý hôm nay"
                        : focusMode
                          ? " cần tập trung"
                          : " · trạng thái đi từ trái sang phải"}
                    </p>
                  </div>
                  <div className="task-panel-actions">
                    <button
                      className={`selection-toggle${selectionMode ? " active" : ""}`}
                      type="button"
                      aria-pressed={selectionMode}
                      onClick={toggleSelectionMode}
                    >
                      <CheckCheck size={14} />
                      {selectionMode ? "Đang chọn" : "Chọn nhiều"}
                    </button>
                    <div className="view-switch">
                      <button
                        className={focusMode ? "" : "selected"}
                        onClick={() => setFocusMode(false)}
                      >
                        Kanban
                      </button>
                      <button
                        className={focusMode ? "selected" : ""}
                        onClick={() => setFocusMode(true)}
                      >
                        Focus
                      </button>
                      <span className="view-switch-note">
                        {sortMode === "manual"
                          ? "Thứ tự kéo thả"
                          : "Ưu tiên → deadline"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="saved-view-bar">
                  <span>Saved views</span>
                  <select
                    aria-label="Chọn saved view"
                    defaultValue=""
                    onChange={(e) => applySavedView(e.target.value)}
                  >
                    <option value="">Chọn view đã lưu</option>
                    {savedViews.map((savedView) => (
                      <option value={savedView.id} key={savedView.id}>
                        {savedView.name}
                      </option>
                    ))}
                  </select>
                  <button className="text-button" onClick={saveCurrentView}>
                    <Save size={14} />
                    Lưu view hiện tại
                  </button>
                </div>
                <div className="filters">
                  <label className="search-box">
                    <Search size={16} />
                    <input
                      ref={searchRef}
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
                  <button
                    className={`filter-toggle${advancedFiltersOpen ? " active" : ""}`}
                    type="button"
                    aria-expanded={advancedFiltersOpen}
                    onClick={() => setAdvancedFiltersOpen((open) => !open)}
                  >
                    <ListFilter size={14} />
                    Bộ lọc nâng cao
                    {(assigneeFilter !== "all" || dueFilter !== "all") && (
                      <span className="filter-count">
                        {Number(assigneeFilter !== "all") + Number(dueFilter !== "all")}
                      </span>
                    )}
                  </button>
                  {advancedFiltersOpen && (
                    <>
                      <label className="select-wrap advanced-filter">
                        <select
                          value={archiveFilter}
                          onChange={(e) =>
                            setArchiveFilter(e.target.value as "active" | "archived")
                          }
                        >
                          <option value="active">Đang hoạt động</option>
                          <option value="archived">Đã lưu trữ</option>
                        </select>
                        <ChevronDown size={13} />
                      </label>
                      <label className="select-wrap advanced-filter">
                        <select
                          value={assigneeFilter}
                          onChange={(e) => setAssigneeFilter(e.target.value)}
                        >
                          <option value="all">Mọi người phụ trách</option>
                          <option value="__unassigned">Chưa giao</option>
                          {data.members
                            .filter((member) => member.active)
                            .map((member) => (
                              <option value={member.id} key={member.id}>
                                {member.name}
                              </option>
                            ))}
                        </select>
                        <ChevronDown size={13} />
                      </label>
                      <label className="select-wrap advanced-filter">
                        <select
                          value={dueFilter}
                          onChange={(e) => setDueFilter(e.target.value)}
                        >
                          <option value="all">Mọi deadline</option>
                          <option value="overdue">Quá hạn</option>
                          <option value="today">Hôm nay</option>
                          <option value="week">7 ngày tới</option>
                        </select>
                        <ChevronDown size={13} />
                      </label>
                    </>
                  )}
                </div>
                {selectedTaskIds.length > 0 && (
                  <div
                    className="bulk-toolbar"
                    role="toolbar"
                    aria-label="Thao tác hàng loạt"
                  >
                    <strong>{selectedTaskIds.length} task đã chọn</strong>
                    <button
                      className="secondary-button action-progress"
                      onClick={() =>
                        bulkUpdateTasks(
                          { status: "in_progress" },
                          "Đã chuyển task sang Đang làm",
                        )
                      }
                    >
                      <Check size={14} />
                      Đang làm
                    </button>
                    <button
                      className="secondary-button action-priority"
                      onClick={() =>
                        bulkUpdateTasks({ priority: "high" }, "Đã đặt ưu tiên cao")
                      }
                    >
                      <AlertTriangle size={14} />
                      Ưu tiên cao
                    </button>
                    <button
                      className="text-button action-clear"
                      onClick={() => setSelectedTaskIds([])}
                    >
                      <X size={14} />
                      Bỏ chọn
                    </button>
                  </div>
                )}
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
                <TaskBoardColumns
                  tasks={view === "today" ? todayTasks : visibleTasks}
                  taskCard={taskCard}
                  onDropStatus={dropOnStatus}
                />
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
                                        {dueText(item.date, copy)}
                                      </span>
                                    </div>
                                    <p>{item.task.title}</p>
                                    <small>{formatDate(item.date, locale)}</small>
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
                      aria-label="Mở quản lý thành viên"
                      title="Mở quản lý thành viên"
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
          tasks={data.tasks}
          prefix={data.code_prefix || "MENSQZIN-"}
          members={data.members}
          isNew={!edit || templateCreateMode}
          onClose={() => {
            setModal(null);
            setEdit(null);
            setTemplateCreateMode(false);
          }}
          onSave={saveTask}
          onPrefixChange={(prefix) => setData((d) => ({ ...d, code_prefix: prefix }))}
          onDelete={() => setConfirm("delete")}
          onRestore={() => restoreTask(edit?.id || "")}
          onSaveTemplate={() => edit && saveTemplateFromTask(edit)}
          onUploadAttachment={uploadAttachment}
          onResolveAttachmentUrl={resolveAttachmentUrl}
          onDiscardAttachments={(storagePaths) => {
            void Promise.all(
              storagePaths.map((path) => deleteTaskAttachment(path)),
            ).catch((error) =>
              setToast(
                error instanceof Error
                  ? error.message
                  : "Không thể dọn file upload chưa lưu.",
              ),
            );
          }}
          locale={locale}
          readOnly={!canEditWorkspace}
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
          onImport={
            canEditWorkspace
              ? importData
              : () => setToast("Bạn chỉ có quyền xem workspace này.")
          }
          onClear={() => {
            if (!canEditWorkspace) {
              setToast("Bạn chỉ có quyền xem workspace này.");
              return;
            }
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
          locale={locale}
          onLocaleChange={setLocale}
          remoteMembers={remoteMembers}
          canManageRemoteMembers={
            remoteWorkspaceIds.includes(workspaceId) && canManageMembers
          }
          onRemoteMemberRole={updateRemoteMemberRole}
          onRemoveRemoteMember={removeRemoteMember}
          onInviteRemoteMember={inviteRemoteMember}
        />
      )}
      {modal === "lock" && (
        <LockModal onClose={() => setModal(null)} onToast={setToast} />
      )}
      {confirm && (
        <ConfirmDialog
          title={
            confirm === "delete" ? "Lưu trữ task này?" : "Xóa toàn bộ dữ liệu local?"
          }
          body={
            confirm === "delete"
              ? "Task sẽ được đưa vào kho lưu trữ và có thể khôi phục lại sau."
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
      {importPreview && (
        <ConfirmDialog
          title="Xác nhận nhập backup?"
          body={`Backup hợp lệ gồm ${importPreview.tasks.length} task và ${importPreview.members.length} thành viên. Xác nhận sẽ thay thế dữ liệu workspace hiện tại; hãy export bản sao trước nếu cần giữ dữ liệu đang có.`}
          onCancel={() => setImportPreview(null)}
          onConfirm={() => {
            setData(importPreview);
            setSortMode(importPreview.sort_mode || "smart");
            setImportPreview(null);
            setToast("Đã nhập dữ liệu từ backup");
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <Check size={16} />
          {toast}
          {undoState && (
            <button className="toast-action" onClick={undoLast}>
              Hoàn tác
            </button>
          )}
        </div>
      )}
    </main>
  );
}
