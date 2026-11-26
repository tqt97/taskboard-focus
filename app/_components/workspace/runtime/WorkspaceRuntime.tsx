"use client";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Bell,
  CalendarDays,
  CalendarRange,
  Check,
  CloudDownload,
  CloudUpload,
  ChevronLeft,
  ChevronRight,
  Download,
  LogIn,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  Moon,
  Menu,
  Plus,
  Settings2,
  Sun,
  Users,
  X,
} from "lucide-react";
import { demoData, maxBackupBytes } from "@/lib/data";
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
import type { ReminderSettings } from "../dialogs/WorkspaceDialogs";
import { getTodayTasks, isArchived, isDueToday } from "@/lib/taskboard/selectors";
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
import { createTaskSearchMatcher } from "@/lib/taskboard/search";
import { getReadNotificationStorageKey } from "@/lib/taskboard/notifications";
import { useBoardSync } from "@/lib/taskboard/use-board-sync";
import {
  createTaskFromTemplate,
  createTemplateFromTask,
  deleteTaskTemplate,
  renameTaskTemplate,
} from "@/lib/taskboard/templates";
import { loadCloudModules, isSupabaseConfigured } from "@/lib/supabase-config";
import type { RemoteWorkspaceMember } from "@/lib/repositories/task-repository";
import { can, type WorkspaceRole } from "@/lib/taskboard/permissions";
import {
  getPrimaryStatusAction,
  resolveStatusTransition,
} from "@/lib/taskboard/status-transitions";
import { useTaskMutations } from "../hooks/useTaskMutations";
import { mergeBoardImport } from "@/lib/taskboard/import-merge";
import { diffTaskFields } from "@/lib/taskboard/activity-diff";
import { useWorkspacePersistence } from "../hooks/useWorkspacePersistence";
import { useWorkspaceNotifications } from "../hooks/useWorkspaceNotifications";
import { useBrowserReminders } from "../hooks/useBrowserReminders";
import { createQuickCaptureTask } from "@/lib/taskboard/quick-capture";
import { updateTaskTitleInline } from "@/lib/taskboard/inline-edit";
import { parseBoardBackupText, restoreBoardSnapshot } from "@/lib/taskboard/backup";
import { WorkspacePageHeading } from "../layout/WorkspacePageHeading";
import { persistSavedViews, useSavedViews } from "../hooks/useSavedViews";
import { useWorkspaceShortcuts } from "../hooks/useWorkspaceShortcuts";
import { WorkspaceLoading } from "../layout/WorkspaceLoading";
import type { WorkspaceView } from "../layout/WorkspaceShell";
import { WorkspaceRouteContent } from "../features/WorkspaceRouteContent";
import {
  WorkspaceRuntimeProvider,
  type WorkspaceRuntimeValue,
} from "./WorkspaceRuntimeContext";

const StructuredTaskModal = dynamic(
  () => import("../dialogs/task/TaskModal").then((module) => module.TaskModal),
  {
    ssr: false,
    loading: () => <div className="overlay" aria-label="Đang mở biểu mẫu" />,
  },
);
const QuickCapture = dynamic(
  () => import("../dialogs/QuickCapture").then((module) => module.QuickCapture),
  { ssr: false },
);
const SettingsModal = dynamic(
  () => import("../dialogs/WorkspaceDialogs").then((module) => module.SettingsModal),
  { ssr: false },
);
const ConfirmDialog = dynamic(
  () => import("../dialogs/WorkspaceDialogs").then((module) => module.ConfirmDialog),
  { ssr: false },
);
const LockModal = dynamic(
  () => import("../dialogs/WorkspaceDialogs").then((module) => module.LockModal),
  { ssr: false },
);
const LazyTaskCard = dynamic(
  () => import("../features/tasks/TaskCard").then((module) => module.TaskCard),
  { ssr: false },
);
const NotificationPopover = dynamic(
  () =>
    import("../dialogs/NotificationPopover").then(
      (module) => module.NotificationPopover,
    ),
  { ssr: false },
);
const ImportDialog = dynamic(
  () => import("../dialogs/ImportDialog").then((module) => module.ImportDialog),
  { ssr: false },
);
const ConflictDialog = dynamic(
  () => import("../dialogs/ConflictDialog").then((module) => module.ConflictDialog),
  { ssr: false },
);
const TemplateManagerDialog = dynamic(
  () =>
    import("../dialogs/TemplateManagerDialog").then(
      (module) => module.TemplateManagerDialog,
    ),
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
  pushEnabled: false,
  leadDays: { Deadline: 3, "Dev up": 1, "Staging up": 1, Release: 1 },
  quietHours: { start: "22:00", end: "07:00" },
};
const reminderSettingsKey = "taskboard-reminder-settings-v1";
const reminderSettingsStorageKey = (workspaceId: string) =>
  `${reminderSettingsKey}:${workspaceId}`;
const backupExportKey = "taskboard-last-json-export-v1";
const backupNudgeKey = "taskboard-json-export-nudge-v1";
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
const readReminderSettings = (workspaceId = "default"): ReminderSettings => {
  if (typeof window === "undefined") return defaultReminderSettings;
  try {
    const value = JSON.parse(
      localStorage.getItem(reminderSettingsStorageKey(workspaceId)) ||
        (workspaceId === "default"
          ? localStorage.getItem(reminderSettingsKey)
          : "null") ||
        "null",
    );
    const leadDays = { ...defaultReminderSettings.leadDays };
    reminderLabels.forEach((label) => {
      if (allowedLeadDays.includes(value?.leadDays?.[label])) {
        leadDays[label] = value.leadDays[label];
      }
    });
    return {
      ...defaultReminderSettings,
      browserEnabled: value?.browserEnabled === true,
      pushEnabled: value?.pushEnabled === true,
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
const saveReminderSettings = (settings: ReminderSettings, workspaceId = "default") =>
  safeSetLocalStorage(
    reminderSettingsStorageKey(workspaceId),
    JSON.stringify(settings),
  );
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
export default function WorkspaceRuntime({
  initialView = "overview",
}: {
  initialView?: WorkspaceView;
}) {
  const router = useRouter();
  const view = initialView;
  const isTaskListView = view === "tasks" || view === "today" || view === "inbox";
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
    [modal, setModal] = useState<
      "task" | "settings" | "lock" | "quick-capture" | "templates" | null
    >(null),
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
    [selectedSavedViewId, setSelectedSavedViewId] = useState(""),
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
    [cloudUserId, setCloudUserId] = useState(""),
    [cloudUserEmail, setCloudUserEmail] = useState(""),
    [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const { savedViews, setSavedViews } = useSavedViews(workspaceId, ready);
  useEffect(() => setSelectedSavedViewId(""), [workspaceId]);
  const {
    syncState,
    sync,
    syncTask,
    conflict,
    conflictCount,
    resolveConflict,
    dismissConflict,
  } = useBoardSync(data, setData, workspaceId);
  const cloudConfigured = isSupabaseConfigured;
  const copy = getUiCopy(locale);
  const reminderDueText = useCallback((value: string) => dueText(value, copy), [copy]);
  const currentWorkspaceRole = remoteWorkspaceRoles[workspaceId] || "owner";
  const canEditWorkspace =
    !remoteWorkspaceIds.includes(workspaceId) ||
    can(currentWorkspaceRole, "edit_tasks");
  useWorkspacePersistence({
    data,
    workspaceId,
    localWorkspaces,
    ready,
    persistenceReady,
    setSaveStatus,
    onError: setToast,
  });
  const canManageMembers =
    !remoteWorkspaceIds.includes(workspaceId) ||
    can(currentWorkspaceRole, "manage_members");
  const openQuickCapture = useCallback(() => setModal("quick-capture"), []);
  useWorkspaceShortcuts({
    canEdit: canEditWorkspace,
    modalOpen: Boolean(modal),
    searchRef,
    onQuickCapture: openQuickCapture,
  });
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
    const indexedDataPromise = indexedDbBoardStorage.load();
    const localWorkspacesPromise = indexedDbBoardStorage.list();
    void Promise.all([indexedDataPromise, localWorkspacesPromise])
      .then(([indexedData, workspaces]) => {
        if (indexedData) {
          setData(indexedData);
          setSortMode(indexedData.sort_mode || "smart");
        } else {
          void indexedDbBoardStorage.save(saved);
        }
        setLocalWorkspaces(workspaces);
        setPersistenceReady(true);
      })
      .catch(() => {
        setPersistenceReady(true);
      });
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
    if (cloudConfigured) {
      void loadCloudModules().then(({ auth, repository }) =>
        auth.getCurrentUser().then((user) => {
          setCloudUserId(user?.id || "");
          setCloudUserEmail(user?.email || "");
          if (!user) return;
          void repository
            .createSupabaseWorkspaceRepository(user.id)
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
        }),
      );
    }
    if ("Notification" in window) setBrowserPermission(Notification.permission);
    else setBrowserPermission("unsupported");
    const syncDisplayName = () => setDisplayName(readDisplayName());
    const syncBrowserPermission = () => {
      if ("Notification" in window) setBrowserPermission(Notification.permission);
      else setBrowserPermission("unsupported");
    };
    window.addEventListener("storage", syncDisplayName);
    window.addEventListener("focus", syncDisplayName);
    window.addEventListener("focus", syncBrowserPermission);
    document.addEventListener("visibilitychange", syncBrowserPermission);
    return () => {
      window.removeEventListener("storage", syncDisplayName);
      window.removeEventListener("focus", syncDisplayName);
      window.removeEventListener("focus", syncBrowserPermission);
      document.removeEventListener("visibilitychange", syncBrowserPermission);
    };
  }, [cloudConfigured]);
  useEffect(() => {
    if (!ready) return;
    try {
      const storedRead = JSON.parse(
        localStorage.getItem(getReadNotificationStorageKey(workspaceId)) || "[]",
      );
      setReadNotificationIds(
        Array.isArray(storedRead)
          ? storedRead.filter((id): id is string => typeof id === "string")
          : [],
      );
    } catch {
      setReadNotificationIds([]);
    }
  }, [ready, workspaceId]);
  useEffect(() => {
    if (ready) setReminderSettings(readReminderSettings(workspaceId));
  }, [ready, workspaceId]);
  useEffect(() => {
    if (!ready) return;
    const nowMs = Date.now();
    try {
      const lastExport = Number(
        localStorage.getItem(`${backupExportKey}:${workspaceId}`) || 0,
      );
      const lastNudge = Number(
        localStorage.getItem(`${backupNudgeKey}:${workspaceId}`) || 0,
      );
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (nowMs - lastExport < sevenDays || nowMs - lastNudge < sevenDays) return;
      setToast("Hãy tải backup JSON để có một bản sao ngoài trình duyệt.");
      safeSetLocalStorage(`${backupNudgeKey}:${workspaceId}`, String(nowMs));
    } catch {}
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
    const timer = setInterval(tick, 60000);
    return () => clearInterval(timer);
  }, [locale]);
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
    () =>
      isTaskListView
        ? [...data.tasks].sort((a, b) => a.order_index - b.order_index)
        : [],
    [data.tasks, isTaskListView],
  );
  const smartCompare = (a: Task, b: Task) =>
    priorityRank[a.priority] - priorityRank[b.priority] ||
    severityRank[a.severity] - severityRank[b.severity] ||
    new Date(a.deadline || "9999-12-31").getTime() -
      new Date(b.deadline || "9999-12-31").getTime() ||
    a.order_index - b.order_index;
  const sorted = useMemo(
    () =>
      !isTaskListView
        ? []
        : sortMode === "manual"
          ? ordered
          : [...ordered].sort(
              sortMode === "deadline"
                ? (a, b) =>
                    new Date(a.deadline || "9999-12-31").getTime() -
                      new Date(b.deadline || "9999-12-31").getTime() ||
                    smartCompare(a, b)
                : smartCompare,
            ),
    [isTaskListView, ordered, sortMode],
  );
  const nowMs = now.getTime();
  const deferredSearch = useDeferredValue(search);
  const taskSearchMatcher = useMemo(
    () => (isTaskListView ? createTaskSearchMatcher(deferredSearch, now) : () => true),
    [deferredSearch, isTaskListView, now],
  );
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
          taskSearchMatcher(t),
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
      taskSearchMatcher,
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
  const reminderTasks = useMemo(
    () => data.tasks.filter((t) => t.status !== "done" && !isArchived(t)),
    [data.tasks],
  );
  const active = view === "timeline" ? reminderTasks : [];
  const inboxTasks = useMemo(
    () =>
      view === "inbox"
        ? data.tasks.filter((task) => task.inbox === true && !isArchived(task))
        : [],
    [data.tasks, view],
  );
  const todayTasks = useMemo(
    () => (view === "today" ? getTodayTasks(data.tasks, now) : []),
    [data.tasks, now, view],
  );
  const navigationCounts = useMemo(() => {
    let activeCount = 0;
    let inboxCount = 0;
    for (const task of data.tasks) {
      if (task.status !== "done" && !isArchived(task)) activeCount += 1;
      if (task.inbox === true && !isArchived(task)) inboxCount += 1;
    }
    return {
      active: activeCount,
      inbox: inboxCount,
      today: getTodayTasks(data.tasks, now).length,
    };
  }, [data.tasks, now]);
  const isInReminderWindow = (date: string, label: ReminderLabel) => {
    const diff = new Date(date).getTime() - nowMs;
    return diff >= -86400000 && diff <= reminderSettings.leadDays[label] * 86400000;
  };
  const reminderItems = useMemo(
    () =>
      reminderTasks
        .flatMap(taskMilestones)
        .filter(({ date, label }) => date && isInReminderWindow(date, label))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [reminderTasks, nowMs, reminderSettings],
  );
  const upcomingGroups = useMemo(
    () =>
      reminderLabels.map((label) => ({
        label,
        items: reminderItems.filter((item) => item.label === label).slice(0, 3),
      })),
    [reminderItems],
  );
  const notifications = useWorkspaceNotifications({
    tasks: data.tasks,
    members: data.members,
    reminders: reminderItems,
    cloudUserId,
    locale,
    copy,
    nowMs,
    readIds: readNotificationIds,
    dueText,
  });
  const openTaskFromNotification = useCallback(
    (taskId: string) => {
      const task = data.tasks.find((item) => item.id === taskId);
      if (!task) return;
      setNotificationsOpen(false);
      setTemplateCreateMode(false);
      setEdit(task);
      setModal("task");
    },
    [data.tasks],
  );
  useBrowserReminders({
    ready,
    enabled: reminderSettings.browserEnabled,
    workspaceId,
    permission: browserPermission,
    tasks: active,
    settings: reminderSettings,
    nowMs,
    onDueText: reminderDueText,
    onOpenTask: openTaskFromNotification,
  });
  const unreadNotificationCount = notifications.filter((item) => !item.read).length;
  const markNotificationRead = (id: string) => {
    setReadNotificationIds((ids) => {
      const next = ids.includes(id) ? ids : [...ids, id];
      safeSetLocalStorage(
        getReadNotificationStorageKey(workspaceId),
        JSON.stringify(next),
      );
      return next;
    });
  };
  const markAllNotificationsRead = () => {
    const ids = notifications.map((item) => item.id);
    setReadNotificationIds(ids);
    safeSetLocalStorage(
      getReadNotificationStorageKey(workspaceId),
      JSON.stringify(ids),
    );
  };
  const updateReminderSettings = (next: ReminderSettings) => {
    setReminderSettings(next);
    if (!saveReminderSettings(next, workspaceId)) {
      setToast("Không thể lưu cài đặt; hãy kiểm tra quyền lưu của trình duyệt.");
    }
  };
  const switchWorkspace = async (nextId: string) => {
    if (!nextId || nextId === workspaceId) return;
    const currentName =
      localWorkspaces.find((workspace) => workspace.id === workspaceId)?.name ||
      "Workspace cá nhân";
    const indexedSaved = await indexedDbBoardStorage.save(
      data,
      workspaceId,
      currentName,
    );
    if (!indexedSaved) {
      const fallbackSaved = localBoardStorage.save(data, workspaceId);
      if (!fallbackSaved.ok) {
        setToast(
          "Không thể lưu workspace trước khi chuyển; hãy kiểm tra dung lượng trình duyệt.",
        );
        return;
      }
      setToast("IndexedDB không khả dụng; workspace đã lưu qua localStorage dự phòng.");
    }
    let nextData: BoardData | null = null;
    if (remoteWorkspaceIds.includes(nextId) && cloudUserEmail) {
      const { auth, repository } = await loadCloudModules();
      const user = await auth.getCurrentUser();
      if (user) {
        try {
          const workspaceRepository = repository.createSupabaseWorkspaceRepository(
            user.id,
          );
          const [snapshot, memberships, taskMembers] = await Promise.all([
            repository.createSupabaseTaskRepository(user.id, nextId).loadWithRevision(),
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
      const { auth, repository } = await loadCloudModules();
      const user = await auth.getCurrentUser();
      if (user) {
        try {
          const workspaceRepository = repository.createSupabaseWorkspaceRepository(
            user.id,
          );
          const workspace = await workspaceRepository.create(name);
          const initialData: BoardData = {
            ...demoData,
            tasks: [],
            members: [],
            code_prefix: data.code_prefix || "MENSQZIN-",
            sort_mode: "smart",
          };
          try {
            await repository
              .createSupabaseTaskRepository(user.id, workspace.id)
              .save(initialData);
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
    const { auth, repository } = await loadCloudModules();
    const user = await auth.getCurrentUser();
    if (!user) return;
    try {
      await repository
        .createSupabaseWorkspaceRepository(user.id)
        .setMemberRole(workspaceId, userId, role);
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
    const { auth, repository } = await loadCloudModules();
    const user = await auth.getCurrentUser();
    if (!user) return;
    if (userId === user.id) {
      setToast("Không thể tự xóa owner khỏi workspace.");
      return;
    }
    try {
      await repository
        .createSupabaseWorkspaceRepository(user.id)
        .removeMember(workspaceId, userId);
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
    const { auth, repository } = await loadCloudModules();
    const token = await auth.getAccessToken();
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
      const user = await auth.getCurrentUser();
      if (user) {
        const members = await repository
          .createSupabaseWorkspaceRepository(user.id)
          .listMembers(workspaceId);
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
    setSelectedSavedViewId(view.id);
    if (!persistSavedViews(workspaceId, nextViews)) {
      setToast("Không thể lưu view; hãy kiểm tra quyền lưu của trình duyệt.");
    } else {
      setToast(`Đã lưu view “${view.name}”`);
    }
  };
  const applySavedView = (id: string) => {
    setSelectedSavedViewId(id);
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
  const deleteSavedView = () => {
    if (!selectedSavedViewId) return;
    const nextViews = savedViews.filter((item) => item.id !== selectedSavedViewId);
    setSavedViews(nextViews);
    setSelectedSavedViewId("");
    if (!persistSavedViews(workspaceId, nextViews)) {
      setToast(
        "Không thể cập nhật view đã lưu; hãy kiểm tra quyền lưu của trình duyệt.",
      );
      return;
    }
    setToast("Đã xóa bộ lọc đã lưu");
  };
  const rememberUndo = (message: string) => setUndoState({ data, message });
  const undoLast = () => {
    if (!undoState) return;
    const timestamp = new Date().toISOString();
    const restored = restoreBoardSnapshot(undoState.data, data.tasks, timestamp);
    setData(restored.data);
    if (cloudConfigured && cloudUserEmail) {
      syncRemoteTasks(restored.restoredTasks);
      restored.remoteOnlyTasks.forEach((task) => void syncTask(task));
    }
    setUndoState(null);
    setToast(`Đã hoàn tác: ${undoState.message}`);
  };
  const syncRemoteTasks = (tasks: Task[], members = data.members) => {
    if (!cloudConfigured || !cloudUserEmail) return;
    tasks.forEach((task) => void syncTask(task, "upsert", members));
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
  const togglePushNotifications = async (enabled: boolean) => {
    const { auth } = await loadCloudModules();
    const accessToken = await auth.getAccessToken();
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!accessToken || !vapidPublicKey) {
      setToast("Push cần phiên owner cloud và VAPID public key đã cấu hình.");
      return false;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setToast("Trình duyệt này không hỗ trợ push notification.");
      return false;
    }
    try {
      if (enabled && browserPermission !== "granted") {
        if (!("Notification" in window)) {
          setToast("Trình duyệt này không hỗ trợ thông báo.");
          return false;
        }
        const permission = await Notification.requestPermission();
        setBrowserPermission(permission);
        if (permission !== "granted") {
          setToast("Bạn chưa cấp quyền thông báo cho trình duyệt.");
          return false;
        }
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      if (enabled) {
        const applicationServerKey = Uint8Array.from(
          atob(vapidPublicKey.replace(/-/g, "+").replace(/_/g, "/")),
          (character) => character.charCodeAt(0),
        );
        const subscription =
          existing ||
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          }));
        const response = await fetch("/api/notifications/push-subscriptions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(subscription.toJSON()),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Không thể bật push.");
      } else if (existing) {
        const response = await fetch("/api/notifications/push-subscriptions", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        if (!response.ok) {
          throw new Error("Không thể xóa push subscription trên server.");
        }
        await existing.unsubscribe();
      }
      updateReminderSettings({
        ...reminderSettings,
        pushEnabled: enabled,
      });
      setToast(enabled ? "Đã bật nhắc nền trên thiết bị này." : "Đã tắt nhắc nền.");
      return true;
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Không thể cập nhật push.");
      return false;
    }
  };
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
      void Promise.all(
        removedPaths.map(async (path) => {
          const { deleteTaskAttachment } =
            await import("@/lib/storage/attachment-storage");
          return deleteTaskAttachment(path);
        }),
      ).catch((error) =>
        setToast(error instanceof Error ? error.message : "Không thể dọn file đã xóa."),
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
    const changedFields = new Set(
      diffTaskFields(previous, task).map((change) => change.field),
    );
    const changes = previous
      ? [
          changedFields.has("status")
            ? {
                field: "Trạng thái",
                from: labels[previous.status],
                to: labels[task.status],
              }
            : null,
          changedFields.has("priority")
            ? {
                field: "Ưu tiên",
                from: priorityLabels[previous.priority],
                to: priorityLabels[task.priority],
              }
            : null,
          changedFields.has("deadline")
            ? {
                field: "Deadline",
                from: previous.deadline || "Chưa đặt",
                to: task.deadline || "Chưa đặt",
              }
            : null,
          changedFields.has("assignee_ids")
            ? {
                field: "Người phụ trách",
                from: String(previous.assignee_ids?.length || 0),
                to: String(task.assignee_ids?.length || 0),
              }
            : null,
          changedFields.has("checklist")
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
      snoozed_until: task.status === "done" ? undefined : task.snoozed_until,
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
  const saveQuickCapture = (title: string) => {
    if (!canEditWorkspace) {
      setToast("Bạn chỉ có quyền xem workspace này.");
      setModal(null);
      return;
    }
    const prefix = data.code_prefix || "MENSQZIN-";
    const task = createQuickCaptureTask(title, data.tasks, prefix);
    rememberUndo("ghi nhanh task vào Inbox");
    setData((current) => ({
      ...current,
      code_prefix: prefix,
      tasks: [task, ...current.tasks],
    }));
    syncRemoteTasks([task]);
    setModal(null);
    setToast("Đã ghi vào Inbox; bạn có thể phân loại sau.");
  };
  const updateTaskDeadline = (task: Task, date: Date) => {
    if (!canEditWorkspace) {
      setToast("Bạn chỉ có quyền chỉnh deadline trong workspace này.");
      return;
    }
    const timestamp = new Date().toISOString();
    const nextDeadline = date.toISOString();
    const nextTask: Task = {
      ...task,
      deadline: nextDeadline,
      updated_at: timestamp,
      activity: [
        ...(task.activity || []),
        {
          id: crypto.randomUUID(),
          type: "updated" as const,
          at: timestamp,
          summary: "Đã đổi deadline trên timeline",
          changes: [
            {
              field: "Deadline",
              from: task.deadline || "Chưa đặt",
              to: nextDeadline,
            },
          ],
        },
      ].slice(-200),
    };
    rememberUndo("đổi deadline");
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((item) => (item.id === task.id ? nextTask : item)),
    }));
    syncRemoteTasks([nextTask]);
    setToast(`Đã đổi deadline ${task.code || "task"}`);
  };
  const { addComment: addTaskComment, toggleCommentPin: toggleTaskCommentPin } =
    useTaskMutations({
      data,
      setData,
      canEdit: canEditWorkspace,
      syncTasks: syncRemoteTasks,
      onError: setToast,
    });
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
      snoozed_until: nextStatus === "done" ? undefined : task.snoozed_until,
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
  const saveInlineTitle = (task: Task, title: string) => {
    if (!canEditWorkspace) return;
    const previous = data.tasks.find((item) => item.id === task.id);
    if (!previous) return;
    const updated = updateTaskTitleInline(previous, title);
    if (!updated) {
      if (!title.trim()) setToast("Tiêu đề task không được để trống.");
      return;
    }
    rememberUndo("sửa nhanh tiêu đề task");
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((item) => (item.id === task.id ? updated : item)),
    }));
    syncRemoteTasks([updated]);
    setToast("Đã cập nhật tiêu đề task");
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
  const updateTemplates = (next: TaskTemplate[], successMessage: string) => {
    if (!localTemplateStorage.save(next, workspaceId)) {
      setToast("Không thể lưu template vào trình duyệt.");
      return false;
    }
    setTemplates(next);
    setToast(successMessage);
    return true;
  };
  const renameTemplate = (id: string, name: string) => {
    const next = renameTaskTemplate(templates, id, name);
    if (next === templates) return false;
    return updateTemplates(next, "Đã đổi tên template");
  };
  const deleteTemplate = (id: string) =>
    updateTemplates(deleteTaskTemplate(templates, id), "Đã xóa template");
  const uploadAttachment = async (file: File) => {
    if (!canEditWorkspace) {
      setToast("Bạn chỉ có quyền xem workspace này.");
      return null;
    }
    try {
      const { auth } = await loadCloudModules();
      const user = await auth.getCurrentUser();
      if (!user) throw new Error("Hãy đăng nhập Supabase để upload file.");
      const { uploadTaskAttachment } = await import("@/lib/storage/attachment-storage");
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
    (await import("@/lib/storage/attachment-storage")).resolveTaskAttachmentUrl(
      storagePath,
    );
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
      snoozed_until: transition.target === "done" ? undefined : item.snoozed_until,
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
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    const exportedAt = String(Date.now());
    safeSetLocalStorage(`${backupExportKey}:${workspaceId}`, exportedAt);
    safeRemoveLocalStorage(`${backupNudgeKey}:${workspaceId}`);
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
      const result = parseBoardBackupText(String(reader.result));
      if (!result.data) {
        setToast(result.error || "Dữ liệu backup không hợp lệ.");
        return;
      }
      try {
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
  const taskCard = (task: Task) => (
    <LazyTaskCard
      key={task.id}
      task={task}
      members={data.members}
      locale={locale}
      copy={copy}
      now={now}
      selectionMode={selectionMode}
      canEdit={canEditWorkspace}
      selected={selectedTaskIds.includes(task.id)}
      dueText={dueText}
      dueState={dueState}
      onToggleSelection={toggleTaskSelection}
      onOpen={(selectedTask) => {
        setEdit(selectedTask);
        setModal("task");
      }}
      onCopyCode={(code) => void copyTaskCode(code)}
      onQuickUpdate={quickUpdateStatus}
      onUpdateTitle={saveInlineTitle}
      onDragStart={setDragId}
      onDragEnd={() => setDragId(null)}
      onDrop={dropTask}
    />
  );
  const runtimeValue: WorkspaceRuntimeValue = {
    view,
    data,
    now,
    locale,
    copy,
    canEditWorkspace,
    activeTasks: active,
    todayTasks,
    visibleTasks,
    reminderItems,
    upcomingGroups,
    templates,
    sortMode,
    focusMode,
    setFocusMode,
    selectionMode,
    selectedTaskIds,
    toggleSelectionMode,
    setSelectedTaskIds: (ids) => setSelectedTaskIds(ids),
    taskCard,
    dropOnStatus,
    bulkUpdateTasks,
    savedViews,
    selectedSavedViewId,
    applySavedView,
    saveCurrentView,
    deleteSavedView,
    searchRef,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    advancedFiltersOpen,
    setAdvancedFiltersOpen,
    archiveFilter,
    setArchiveFilter,
    assigneeFilter,
    setAssigneeFilter,
    dueFilter,
    setDueFilter,
    onOpenTask: (task) => {
      setEdit(task);
      setModal("task");
    },
    onBrowseTasks: () => router.push("/tasks"),
    onUpdateDeadline: updateTaskDeadline,
    dueText,
    dueState,
    formatDate,
    onOpenSettings: () => setModal("settings"),
  };
  if (!ready) {
    return <WorkspaceLoading />;
  }

  return (
    <WorkspaceRuntimeProvider value={runtimeValue}>
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
              Danh sách task<span className="nav-count">{navigationCounts.active}</span>
            </button>
            <button
              className={view === "today" ? "nav-item active" : "nav-item"}
              onClick={() => router.push("/today")}
            >
              <CalendarDays size={18} />
              Hôm nay<span className="nav-count">{navigationCounts.today}</span>
            </button>
            <button
              className={view === "inbox" ? "nav-item active" : "nav-item"}
              onClick={() => router.push("/inbox")}
            >
              <ListTodo size={18} />
              Inbox<span className="nav-count">{navigationCounts.inbox}</span>
            </button>
            <button
              className={view === "timeline" ? "nav-item active" : "nav-item"}
              onClick={() => router.push("/timeline")}
            >
              <CalendarRange size={18} />
              Lịch & timeline
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
              {sidebarCollapsed ? (
                <ChevronRight size={16} />
              ) : (
                <ChevronLeft size={16} />
              )}
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
                  : view === "timeline"
                    ? "Lịch & timeline"
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
                      <span>{navigationCounts.active}</span>
                    </button>
                    <button
                      className={view === "today" ? "active" : ""}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        router.push("/today");
                      }}
                    >
                      <CalendarDays size={17} /> Hôm nay
                      <span>{navigationCounts.today}</span>
                    </button>
                    <button
                      className={view === "inbox" ? "active" : ""}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        router.push("/inbox");
                      }}
                    >
                      <ListTodo size={17} /> Inbox
                      <span>{navigationCounts.inbox}</span>
                    </button>
                    <button
                      className={view === "timeline" ? "active" : ""}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        router.push("/timeline");
                      }}
                    >
                      <CalendarRange size={17} /> Lịch & timeline
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
                    onOpenTask={openTaskFromNotification}
                    onClose={() => setNotificationsOpen(false)}
                  />
                )}
              </div>
              <button
                className="icon-button"
                aria-label="Đổi giao diện"
                title={
                  dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"
                }
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
              <WorkspacePageHeading
                view={view}
                greeting={greeting}
                displayName={displayName}
              />
              <div className="page-actions">
                <button
                  className="secondary-button quick-capture-trigger"
                  disabled={!canEditWorkspace}
                  title="Ghi nhanh task (N)"
                  onClick={() => setModal("quick-capture")}
                >
                  <Plus size={16} /> Ghi nhanh <kbd>N</kbd>
                </button>
                {(view === "tasks" || view === "today" || view === "inbox") && (
                  <>
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
                      className="text-button template-manage-trigger"
                      disabled={!canEditWorkspace}
                      onClick={() => setModal("templates")}
                    >
                      Quản lý template
                    </button>
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
                  </>
                )}
              </div>
            </div>
            {(view === "overview" || view === "timeline") && (
              <WorkspaceRouteContent view={view} />
            )}
            <div
              className={
                view === "tasks" || view === "today" || view === "inbox"
                  ? "tasks-layout"
                  : "overview-layout"
              }
            >
              {isTaskListView && <WorkspaceRouteContent view={view} />}
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
                storagePaths.map(async (path) => {
                  const { deleteTaskAttachment } =
                    await import("@/lib/storage/attachment-storage");
                  return deleteTaskAttachment(path);
                }),
              ).catch((error) =>
                setToast(
                  error instanceof Error
                    ? error.message
                    : "Không thể dọn file upload chưa lưu.",
                ),
              );
            }}
            locale={locale}
            commentAuthorId={
              data.members.find((member) => member.name === displayName)?.id
            }
            onAddComment={addTaskComment}
            onToggleCommentPin={toggleTaskCommentPin}
            readOnly={!canEditWorkspace}
          />
        )}
        {modal === "quick-capture" && (
          <QuickCapture onClose={() => setModal(null)} onSave={saveQuickCapture} />
        )}
        {modal === "templates" && (
          <TemplateManagerDialog
            templates={templates}
            onRename={renameTemplate}
            onDelete={deleteTemplate}
            onClose={() => setModal(null)}
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
            workspaceId={workspaceId}
            onRestoreBackup={(backup) => {
              setModal(null);
              setImportPreview(backup);
              setToast("Đã mở bản sao tự động để xem trước khi khôi phục.");
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
            onTogglePushNotifications={togglePushNotifications}
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
          <ImportDialog
            current={data}
            incoming={importPreview}
            onCancel={() => setImportPreview(null)}
            onReplace={() => {
              rememberUndo("nhập backup thay thế workspace");
              const removedTasks = data.tasks.filter(
                (task) =>
                  !importPreview.tasks.some((incoming) => incoming.id === task.id),
              );
              setData(importPreview);
              setSortMode(importPreview.sort_mode || "smart");
              syncRemoteTasks(importPreview.tasks, importPreview.members);
              removedTasks.forEach((task) => void syncTask(task, "remove"));
              setImportPreview(null);
              setToast("Đã nhập backup; bạn có thể Hoàn tác trong 10 giây.");
            }}
            onMerge={(keepIncoming) => {
              rememberUndo("merge backup vào workspace");
              const local = data;
              const incoming = importPreview;
              const merged = mergeBoardImport(local, incoming, keepIncoming);
              const changedIds = new Set(
                incoming.tasks
                  .filter(
                    (task) =>
                      !local.tasks.some((current) => current.id === task.id) ||
                      keepIncoming.has(task.id),
                  )
                  .map((task) => task.id),
              );
              setData(merged);
              setSortMode(merged.sort_mode || "smart");
              syncRemoteTasks(
                merged.tasks.filter((task) => changedIds.has(task.id)),
                merged.members,
              );
              setImportPreview(null);
              setToast("Đã merge backup; các task conflict được xử lý theo lựa chọn.");
            }}
          />
        )}
        {conflict && (
          <ConflictDialog
            local={conflict.local}
            remote={conflict.remote}
            message={conflict.message}
            remainingConflicts={conflictCount}
            onResolve={resolveConflict}
            onClose={dismissConflict}
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
    </WorkspaceRuntimeProvider>
  );
}
