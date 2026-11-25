import assert from "node:assert/strict";
import test from "node:test";
import { demoData, migrateBoardData, parseBoardDataWithError } from "../lib/data.ts";
import {
  getDependencyState,
  getTodayTasks,
  isArchived,
} from "../lib/taskboard/selectors.ts";
import { getNextOccurrence } from "../lib/taskboard/recurrence.ts";
import { isWithinQuietHours } from "../lib/taskboard/notifications.ts";
import { createTaskFromTemplate } from "../lib/taskboard/templates.ts";
import { matchesTaskSearch, parseTaskSearch } from "../lib/taskboard/search.ts";
import {
  remoteTaskScope,
  remoteRowToTask,
  fromRemoteEntityId,
  snapshotConflictKey,
  taskToRemoteRow,
  toRemoteEntityId,
} from "../lib/repositories/task-repository.ts";
import { can, normalizeWorkspaceRole } from "../lib/taskboard/permissions.ts";
import {
  isRemoteConflict,
  isRemotePermanentError,
  remoteSyncQueue,
} from "../lib/taskboard/remote-sync-queue.ts";
import { localBoardStorage } from "../lib/storage/board-storage.ts";
import {
  getPrimaryStatusAction,
  resolveStatusTransition,
} from "../lib/taskboard/status-transitions.ts";

const fixture = () => JSON.parse(JSON.stringify(demoData)) as typeof demoData;

test("archive selector excludes archived work from Today", () => {
  const data = fixture();
  data.tasks[0].archived_at = "2026-11-19T10:00:00.000Z";

  assert.equal(isArchived(data.tasks[0]), true);
  assert.ok(
    !getTodayTasks(data.tasks, new Date("2026-11-20T10:00:00.000Z")).includes(
      data.tasks[0],
    ),
  );
});

test("Today prioritizes overdue and urgent tasks", () => {
  const data = fixture();
  data.tasks[0].deadline = "2026-11-21T12:00:00.000Z";
  data.tasks[1].deadline = "2026-11-19T12:00:00.000Z";
  data.tasks[1].status = "todo";

  const today = getTodayTasks(data.tasks, new Date("2026-11-20T15:00:00.000Z"));
  assert.equal(today[0].id, data.tasks[1].id);
});

test("Today excludes a task while its snooze window is active", () => {
  const data = fixture();
  data.tasks[0].priority = "urgent";
  data.tasks[0].snoozed_until = "2026-11-21T12:00:00.000Z";

  const today = getTodayTasks(data.tasks, new Date("2026-11-20T15:00:00.000Z"));
  assert.ok(!today.some((task) => task.id === data.tasks[0].id));
});

test("advanced task search supports field conditions and free text", () => {
  const data = fixture();
  const task = data.tasks[0];
  task.status = "review";
  task.priority = "urgent";
  task.inbox = true;
  task.next_action = "Review API contract";

  assert.deepEqual(parseTaskSearch("status:review priority:urgent inbox:true API"), {
    filters: { status: "review", priority: "urgent", inbox: true },
    text: "api",
  });
  assert.equal(
    matchesTaskSearch(task, "status:review priority:urgent inbox:true API"),
    true,
  );
  assert.equal(matchesTaskSearch(task, "status:done"), false);
});

test("localStorage fallback keeps board data isolated by workspace", () => {
  const storage = new Map<string, string>();
  const previousWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) || null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  });
  try {
    const first = fixture();
    first.tasks[0].title = "Workspace A";
    const second = fixture();
    second.tasks[0].title = "Workspace B";
    assert.equal(localBoardStorage.save(first, "workspace-a").ok, true);
    assert.equal(localBoardStorage.save(second, "workspace-b").ok, true);
    assert.equal(localBoardStorage.load("workspace-a").tasks[0].title, "Workspace A");
    assert.equal(localBoardStorage.load("workspace-b").tasks[0].title, "Workspace B");
    assert.equal(storage.has("taskboard-focus-v1"), false);
  } finally {
    if (previousWindow === undefined)
      delete (globalThis as { window?: unknown }).window;
    else
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
  }
});

test("accepts an unassigned task normalized with an empty legacy assignee", () => {
  const data = fixture();
  const task = data.tasks[0];
  task.assignee_ids = [];
  task.assignee_id = "";

  assert.ok(parseBoardDataWithError(data).data);
});

test("remote task mapping preserves checklist, relations and assignment shape", () => {
  const task = fixture().tasks[0];
  task.assignee_ids = ["m1", "m2"];
  task.checklist = [{ id: "step-1", title: "Verify", done: false }];
  task.inbox = true;
  task.snoozed_until = "2026-11-26T10:00:00.000Z";

  const row = taskToRemoteRow(task, "owner-1");
  const restored = remoteRowToTask(
    row,
    task.assignee_ids.map((id) => toRemoteEntityId(id, "owner-1")),
    "owner-1",
  );

  assert.equal(row.owner_id, "owner-1");
  assert.equal(row.assignee_id, toRemoteEntityId("m1", "owner-1"));
  assert.deepEqual(restored.assignee_ids, ["m1", "m2"]);
  assert.deepEqual(restored.checklist, task.checklist);
  assert.equal(restored.inbox, true);
  assert.equal(restored.snoozed_until, task.snoozed_until);
});

test("dependency readiness distinguishes waiting, blocked and ready", () => {
  const data = fixture();
  const task = data.tasks[0];
  task.blocked_by = [data.tasks[1].id];
  const map = new Map(data.tasks.map((item) => [item.id, item]));

  assert.equal(getDependencyState(task, map), "waiting");
  data.tasks[1].status = "blocked";
  assert.equal(getDependencyState(task, map), "blocked");
  data.tasks[1].status = "done";
  assert.equal(getDependencyState(task, map), "ready");
});

test("recurrence respects interval and until boundary", () => {
  assert.equal(
    getNextOccurrence("2026-11-20T10:00:00.000Z", {
      frequency: "weekly",
      interval: 2,
    }),
    "2026-12-04T10:00:00.000Z",
  );
  assert.equal(
    getNextOccurrence("2026-11-20T10:00:00.000Z", {
      frequency: "daily",
      interval: 2,
      until: "2026-11-21T00:00:00.000Z",
    }),
    null,
  );
});

test("recurrence clamps monthly dates to the target month", () => {
  assert.equal(
    getNextOccurrence("2026-01-31T10:00:00.000Z", {
      frequency: "monthly",
      interval: 1,
    }),
    "2026-02-28T10:00:00.000Z",
  );
});

test("migration adds defaults without changing legacy task identity", () => {
  const payload = fixture();
  delete (payload.tasks[0] as { blocked_by?: string[] }).blocked_by;
  delete (payload.tasks[0] as { attachments?: unknown[] }).attachments;
  delete (payload.tasks[0] as { checklist?: unknown[] }).checklist;
  const migrated = migrateBoardData(payload) as typeof payload & {
    schema_version: number;
  };

  assert.equal(migrated.schema_version, 2);
  assert.deepEqual(migrated.tasks[0].blocked_by, []);
  assert.deepEqual(migrated.tasks[0].attachments, []);
  assert.deepEqual(migrated.tasks[0].checklist, []);
  assert.equal(migrated.tasks[0].id, payload.tasks[0].id);
  assert.ok(parseBoardDataWithError(migrated).data);
});

test("template creates a new todo task with provenance", () => {
  const task = createTaskFromTemplate(
    {
      id: "template-1",
      name: "Regression",
      title: "Chạy regression",
      description: "",
      priority: "high",
      severity: "medium",
      created_at: "2026-11-20T00:00:00.000Z",
    },
    "WEB-NEW",
    new Date("2026-11-20T00:00:00.000Z"),
  );

  assert.equal(task.status, "todo");
  assert.equal(task.code, "WEB-NEW");
  assert.equal(task.template_id, "template-1");
});

test("accepts review status, checklist items and activity diffs", () => {
  const payload = fixture();
  payload.tasks[0].status = "review";
  payload.tasks[0].checklist = [
    { id: "check-1", title: "Kiểm tra trên mobile", done: false },
  ];
  payload.tasks[0].activity = [
    {
      id: "activity-1",
      type: "status_changed",
      at: "2026-11-20T10:00:00.000Z",
      summary: "Đổi trạng thái thành Chờ review",
      changes: [{ field: "Trạng thái", from: "Đang làm", to: "Chờ review" }],
    },
  ];

  const result = parseBoardDataWithError(payload);
  assert.ok(result.data);
  assert.equal(result.data.tasks[0].status, "review");
  assert.equal(result.data.tasks[0].checklist?.[0].done, false);
  assert.equal(result.data.tasks[0].activity?.[0].changes?.[0].from, "Đang làm");
});

test("status workflow requires review before completion and restores blocked state", () => {
  assert.equal(getPrimaryStatusAction({ status: "todo" }).target, "in_progress");
  assert.equal(getPrimaryStatusAction({ status: "in_progress" }).target, "review");
  assert.equal(getPrimaryStatusAction({ status: "review" }).target, "done");
  assert.equal(getPrimaryStatusAction({ status: "done" }).target, "in_progress");

  const skippedReview = resolveStatusTransition("in_progress", "done");
  assert.equal(skippedReview.allowed, false);
  assert.match(skippedReview.warning || "", /Chờ review/);

  const blocked = resolveStatusTransition("review", "blocked");
  assert.equal(blocked.allowed, true);
  assert.equal(blocked.blocked_from, "review");
  const unblocked = resolveStatusTransition("blocked", "review", blocked.blocked_from);
  assert.equal(unblocked.allowed, true);
  assert.equal(unblocked.target, "review");

  const directDoneFromBlocked = resolveStatusTransition(
    "blocked",
    "done",
    "in_progress",
  );
  assert.equal(directDoneFromBlocked.allowed, false);
  assert.match(directDoneFromBlocked.warning || "", /gỡ chặn/i);
});

test("migration adds an empty checklist without changing legacy task identity", () => {
  const payload = fixture();
  delete (payload.tasks[0] as { checklist?: unknown[] }).checklist;
  const migrated = migrateBoardData(payload) as typeof payload;

  assert.deepEqual(migrated.tasks[0].checklist, []);
  assert.equal(migrated.tasks[0].id, payload.tasks[0].id);
});

test("workspace permissions keep member role separate from job role", () => {
  assert.equal(can("owner", "manage_members"), true);
  assert.equal(can("member", "manage_members"), false);
  assert.equal(can("viewer", "view_tasks"), true);
  assert.equal(can("viewer", "edit_tasks"), false);
  assert.equal(normalizeWorkspaceRole("unknown"), "member");
});

test("remote queue deduplicates by workspace and keeps workspace boundaries", () => {
  const storage = new Map<string, string>();
  const previousWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) || null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  });
  try {
    remoteSyncQueue.clear();
    const task = fixture().tasks[0];
    remoteSyncQueue.enqueue(
      task,
      "upsert",
      "workspace-a",
      new Date("2026-11-25T10:00:00Z"),
    );
    remoteSyncQueue.enqueue(
      { ...task, title: "Latest" },
      "upsert",
      "workspace-a",
      new Date("2026-11-25T10:01:00Z"),
    );
    remoteSyncQueue.enqueue(
      task,
      "remove",
      "workspace-b",
      new Date("2026-11-25T10:01:00Z"),
    );
    const due = remoteSyncQueue.listDue(new Date("2026-11-25T10:02:00Z"));
    assert.equal(due.length, 2);
    assert.equal(
      due.find((item) => item.workspaceId === "workspace-a")?.task.title,
      "Latest",
    );
    assert.equal(
      due.find((item) => item.workspaceId === "workspace-b")?.operation,
      "remove",
    );
  } finally {
    remoteSyncQueue.clear();
    if (previousWindow === undefined)
      delete (globalThis as { window?: unknown }).window;
    else
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
  }
});

test("remote queue keeps accounts isolated on the same browser", () => {
  const storage = new Map<string, string>();
  const previousWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) || null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  });
  try {
    const task = fixture().tasks[0];
    const now = new Date("2026-11-25T10:00:00Z");
    remoteSyncQueue.enqueue(
      task,
      "upsert",
      "workspace-a",
      now,
      undefined,
      undefined,
      "user-a",
    );
    remoteSyncQueue.enqueue(
      task,
      "upsert",
      "workspace-a",
      now,
      undefined,
      undefined,
      "user-b",
    );
    assert.equal(remoteSyncQueue.listDue(now, "user-a").length, 1);
    assert.equal(remoteSyncQueue.listDue(now, "user-b").length, 1);
    remoteSyncQueue.clear("user-a");
    assert.equal(remoteSyncQueue.listDue(now, "user-a").length, 0);
    assert.equal(remoteSyncQueue.listDue(now, "user-b").length, 1);
    remoteSyncQueue.clear("user-b");
  } finally {
    if (previousWindow === undefined)
      delete (globalThis as { window?: unknown }).window;
    else
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
  }
});

test("shared remote tasks scope by workspace instead of creator", () => {
  assert.deepEqual(remoteTaskScope("user-a", "workspace-a"), {
    field: "workspace_id",
    value: "workspace-a",
  });
  assert.deepEqual(remoteTaskScope("user-a"), {
    field: "owner_id",
    value: "user-a",
  });
});

test("remote task mapping keeps an explicit creator for shared workspace updates", () => {
  const task = fixture().tasks[0];
  const row = taskToRemoteRow(task, "creator-a", "workspace-a");
  assert.equal(row.owner_id, "creator-a");
  assert.equal(row.workspace_id, "workspace-a");
});

test("remote task mapping preserves legacy non-UUID task and assignee identities", () => {
  const task = fixture().tasks[0];
  const row = taskToRemoteRow(task, "creator-a");
  assert.equal(row.id, toRemoteEntityId("t1", "creator-a"));
  assert.equal(row.assignee_id, toRemoteEntityId("m1", "creator-a"));
  assert.equal(remoteRowToTask(row, [], "creator-a").id, "t1");
  assert.deepEqual(remoteRowToTask(row, [], "creator-a").assignee_ids, ["m1"]);
});

test("remote legacy namespaces isolate owners but converge within a workspace", () => {
  assert.notEqual(toRemoteEntityId("t1", "owner-a"), toRemoteEntityId("t1", "owner-b"));
  assert.equal(
    toRemoteEntityId("t1", "owner-a", "workspace-a"),
    toRemoteEntityId("t1", "owner-b", "workspace-a"),
  );
  assert.notEqual(
    toRemoteEntityId("t1", "owner-a", "workspace-a"),
    toRemoteEntityId("t1", "owner-a", "workspace-b"),
  );
  const encoded = toRemoteEntityId("task/100%", "owner-a");
  const restored = remoteRowToTask({ id: encoded }, [], "owner-a");
  assert.equal(restored.id, "task/100%");
});

test("remote legacy ID decoding is safe for realtime deletes and malformed input", () => {
  const remoteId = toRemoteEntityId("task/100%", "owner-a", "workspace-a");
  assert.equal(fromRemoteEntityId(remoteId, "owner-a", "workspace-a"), "task/100%");
  assert.equal(
    fromRemoteEntityId(`${remoteId}%`, "owner-a", "workspace-a"),
    `${remoteId}%`,
  );
});

test("workspace snapshots use workspace_id as their upsert conflict key", () => {
  assert.equal(snapshotConflictKey("workspace-a"), "workspace_id");
  assert.equal(snapshotConflictKey(), "owner_id");
});

test("remote queue pauses conflicts but reopens on a new task version", () => {
  const storage = new Map<string, string>();
  const previousWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) || null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  });
  try {
    remoteSyncQueue.clear();
    const task = fixture().tasks[0];
    remoteSyncQueue.enqueue(task, "upsert", "workspace-a");
    const [queued] = remoteSyncQueue.listDue();
    remoteSyncQueue.block(queued, "Task đã thay đổi trên cloud");
    assert.equal(remoteSyncQueue.listDue().length, 0);
    remoteSyncQueue.enqueue(
      { ...task, title: "Local revision" },
      "upsert",
      "workspace-a",
    );
    assert.equal(remoteSyncQueue.listDue().length, 1);
  } finally {
    remoteSyncQueue.clear();
    if (previousWindow === undefined)
      delete (globalThis as { window?: unknown }).window;
    else
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
  }
});

test("remote conflict detection distinguishes stale writes from transient failures", () => {
  assert.equal(isRemoteConflict("Task trên cloud đã thay đổi"), true);
  assert.equal(isRemoteConflict("Mạng tạm thời không khả dụng"), false);
  assert.equal(
    isRemotePermanentError("new row violates row-level security policy"),
    true,
  );
  assert.equal(isRemotePermanentError("Mạng tạm thời không khả dụng"), false);
});

test("quiet hours handle overnight windows and timezone conversion", () => {
  assert.equal(
    isWithinQuietHours(
      new Date("2026-11-25T15:30:00.000Z"),
      "22:00",
      "07:00",
      "Asia/Ho_Chi_Minh",
    ),
    true,
  );
  assert.equal(
    isWithinQuietHours(
      new Date("2026-11-25T04:30:00.000Z"),
      "22:00",
      "07:00",
      "Asia/Ho_Chi_Minh",
    ),
    false,
  );
});

test("remote queue keeps member catalog with a task mutation", () => {
  const storage = new Map<string, string>();
  const previousWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) || null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  });
  try {
    remoteSyncQueue.clear();
    const data = fixture();
    remoteSyncQueue.enqueue(
      data.tasks[0],
      "upsert",
      "workspace-a",
      new Date(),
      undefined,
      data.members,
    );
    const [queued] = remoteSyncQueue.listDue();
    assert.deepEqual(queued.members, data.members);
  } finally {
    remoteSyncQueue.clear();
    if (previousWindow === undefined)
      delete (globalThis as { window?: unknown }).window;
    else
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
  }
});
