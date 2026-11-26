import assert from "node:assert/strict";
import test from "node:test";
import { demoData, migrateBoardData, parseBoardDataWithError } from "../lib/data.ts";
import {
  getDependencyState,
  getTodayTasks,
  isArchived,
  isDraft,
  isSnoozed,
} from "../lib/taskboard/selectors.ts";
import { getNextOccurrence } from "../lib/taskboard/recurrence.ts";
import {
  getBrowserReminderId,
  getReadNotificationStorageKey,
  isWithinQuietHours,
} from "../lib/taskboard/notifications.ts";
import {
  createTaskFromTemplate,
  deleteTaskTemplate,
  renameTaskTemplate,
} from "../lib/taskboard/templates.ts";
import { createTaskComment } from "../lib/taskboard/comments.ts";
import { formatActivityDate, formatActivityValue } from "../lib/taskboard/activity.ts";
import {
  formatConflictValue,
  getConflictFields,
  mergeConflictFields,
} from "../lib/taskboard/conflicts.ts";
import { getNextAction } from "../lib/taskboard/next-action.ts";
import { diffTaskFields } from "../lib/taskboard/activity-diff.ts";
import { mergeBoardImport, previewBoardImport } from "../lib/taskboard/import-merge.ts";
import {
  createTaskSearchMatcher,
  matchesTaskSearch,
  parseTaskSearch,
} from "../lib/taskboard/search.ts";
import { updateTaskTitleInline } from "../lib/taskboard/inline-edit.ts";
import {
  deliverPushNotifications,
  getPushRunSkipReason,
  validatePushConfig,
} from "../lib/taskboard/web-push-delivery.ts";
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

test("compiled task search matcher matches the convenience matcher", () => {
  const task = fixture().tasks[0];
  const matcher = createTaskSearchMatcher("status:todo priority:medium");
  assert.equal(matcher(task), matchesTaskSearch(task, "status:todo priority:medium"));
});

test("inline title edit rejects empty titles and records a change", () => {
  const task = fixture().tasks[0];
  assert.equal(updateTaskTitleInline(task, "   "), null);
  const updated = updateTaskTitleInline(
    task,
    "  Updated title  ",
    "2026-11-25T12:00:00.000Z",
  );
  assert.ok(updated);
  assert.equal(updated.title, "Updated title");
  assert.equal(updated.activity?.at(-1)?.changes?.[0]?.from, task.title);
  assert.equal(updated.activity?.at(-1)?.changes?.[0]?.to, "Updated title");
});

test("push configuration fails closed for missing values and invalid VAPID subject", () => {
  assert.equal(validatePushConfig({}), "missing");
  const valid = {
    supabaseUrl: "https://example.supabase.co",
    serviceKey: "service-key",
    ownerId: "owner-id",
    publicKey: "public",
    privateKey: "private",
    subject: "mailto:admin@example.com",
  };
  assert.equal(
    validatePushConfig({ ...valid, subject: "javascript:alert(1)" }),
    "invalid_subject",
  );
  assert.equal(validatePushConfig(valid), null);
});

test("push run state prevents duplicate sends and respects active lease and backoff", () => {
  const now = Date.parse("2026-11-25T12:00:00.000Z");
  assert.equal(getPushRunSkipReason({ status: "sent" }, now), "already_processed");
  assert.equal(
    getPushRunSkipReason(
      { status: "pending", lease_until: "2026-11-25T12:01:00.000Z" },
      now,
    ),
    "in_progress",
  );
  assert.equal(
    getPushRunSkipReason(
      { status: "failed", next_attempt_at: "2026-11-25T12:01:00.000Z" },
      now,
    ),
    "retry_backoff",
  );
  assert.equal(
    getPushRunSkipReason({ status: "failed", next_attempt_at: null }, now),
    null,
  );
});

test("push delivery sends valid subscriptions, removes expired endpoints, and counts failures", async () => {
  const removed: string[] = [];
  const sent: string[] = [];
  const subscriptions = ["ok", "expired", "gone", "broken"].map((endpoint) => ({
    endpoint,
    p256dh: "p256dh",
    auth: "auth",
  }));
  const result = await deliverPushNotifications(
    subscriptions,
    "payload",
    async (subscription) => {
      if (subscription.endpoint === "expired") throw { statusCode: 404 };
      if (subscription.endpoint === "gone") throw { statusCode: 410 };
      if (subscription.endpoint === "broken") throw new Error("temporary failure");
      sent.push(subscription.endpoint);
    },
    async (endpoint) => {
      removed.push(endpoint);
    },
  );
  assert.deepEqual(sent, ["ok"]);
  assert.deepEqual(removed, ["expired", "gone"]);
  assert.deepEqual(result, { failures: 1, expired: 2 });
});

test("comments preserve replies and mention member IDs", () => {
  const comment = createTaskComment({
    body: "@Linh kiểm tra giúp mình nhé",
    authorId: "m1",
    parentId: "comment-1",
    members: fixture().members,
    now: new Date("2026-11-25T08:34:00.000Z"),
  });

  assert.ok(comment);
  assert.equal(comment.author_id, "m1");
  assert.equal(comment.parent_id, "comment-1");
  assert.deepEqual(comment.mention_ids, ["m2"]);
  assert.equal(comment.created_at, "2026-11-25T08:34:00.000Z");

  const ambiguous = createTaskComment({
    body: "@An không phải @Anh",
    members: [
      { id: "an", name: "An", role: "Dev", color: "blue", active: true },
      { id: "anh", name: "Anh", role: "Dev", color: "green", active: true },
    ],
  });
  assert.ok(ambiguous);
  assert.deepEqual(ambiguous.mention_ids, ["an", "anh"]);
});

test("activity dates and milestone values use readable localized format", () => {
  assert.match(
    formatActivityDate("2026-11-25T08:34:00.000Z", "vi"),
    /^\d{2}:\d{2} 25\/11\/2026$/,
  );
  assert.match(
    formatActivityValue("Deadline", "2026-11-26T10:00:00.000Z", "vi"),
    /^\d{2}:\d{2} 26\/11\/2026$/,
  );
});

test("conflict center exposes changed fields and merges only selected remote fields", () => {
  const base = {
    id: "task-1",
    code: "WEB-1",
    title: "Local title",
    description: "Same",
    status: "in_progress" as const,
    priority: "high" as const,
    severity: "medium" as const,
    dev_up: "",
    staging_up: "",
    release_at: "",
    deadline: "2026-11-26T10:00:00.000Z",
    order_index: 0,
    links: [],
    created_at: "2026-11-25T00:00:00.000Z",
    updated_at: "2026-11-25T01:00:00.000Z",
  };
  const remote = {
    ...base,
    title: "Remote title",
    deadline: "2026-11-27T10:00:00.000Z",
    updated_at: "2026-11-25T02:00:00.000Z",
  };
  const fields = getConflictFields(base, remote);
  assert.deepEqual(
    fields.map((field) => field.key),
    ["title", "deadline"],
  );
  const merged = mergeConflictFields(base, remote, new Set(["deadline"]));
  assert.equal(merged.title, "Local title");
  assert.equal(merged.deadline, remote.deadline);
  assert.notEqual(merged.updated_at, base.updated_at);
});

test("conflict values stay readable for nested fields", () => {
  assert.equal(formatConflictValue([]), "Trống");
  assert.equal(
    formatConflictValue([{ id: "check-1", title: "Kiểm tra", done: false }]),
    '[{"id":"check-1","title":"Kiểm tra","done":false}]',
  );
  assert.equal(formatConflictValue(undefined), "Chưa đặt");
});

test("backup parser preserves explicit member cloud identity", () => {
  const result = parseBoardDataWithError({
    schema_version: 2,
    members: [
      {
        ...fixture().members[0],
        user_id: "auth-user-1",
      },
    ],
    tasks: [],
  });
  assert.equal(result.data?.members[0].user_id, "auth-user-1");
});

test("next action engine prioritizes dependency and review decisions", () => {
  const task = {
    id: "a",
    code: "A",
    title: "A",
    description: "",
    status: "review" as const,
    priority: "medium" as const,
    severity: "low" as const,
    dev_up: "",
    staging_up: "",
    release_at: "",
    deadline: "",
    order_index: 0,
    links: [],
    blocked_by: ["b"],
    created_at: "2026-11-25T00:00:00.000Z",
    updated_at: "2026-11-25T00:00:00.000Z",
  };
  const dependency = {
    ...task,
    id: "b",
    code: "B",
    title: "B",
    status: "in_progress" as const,
    blocked_by: [],
  };
  assert.equal(getNextAction(task, [task, dependency]).key, "follow_dependency");
  assert.equal(getNextAction({ ...task, blocked_by: [] }, [task]).key, "review");
  assert.equal(
    getNextAction({ ...task, status: "blocked", blocked_by: [] }, [task]).key,
    "resolve_dependency",
  );
});

test("activity diff and import merge preserve local choices", () => {
  const localTasks = [{ id: "1", title: "Local", updated_at: "1" }];
  const incomingTasks = [
    { id: "1", title: "Remote", updated_at: "2" },
    { id: "2", title: "New", updated_at: "2" },
  ];
  const local = { tasks: localTasks, members: [] } as never;
  const incoming = { tasks: incomingTasks, members: [] } as never;
  assert.deepEqual(
    previewBoardImport(local, incoming).conflicts.map((item) => item.id),
    ["1"],
  );
  const merged = mergeBoardImport(local, incoming, new Set(["1"]));
  assert.deepEqual(
    merged.tasks.map((task) => task.title),
    ["Remote", "New"],
  );
  assert.deepEqual(
    diffTaskFields(
      { ...localTasks[0], description: "" } as never,
      { ...localTasks[0], description: "changed" } as never,
    ).map((change) => change.field),
    ["description"],
  );
  const mergedWithMember = mergeBoardImport(
    local,
    {
      tasks: incomingTasks,
      members: [
        { id: "new-member", name: "New", role: "Dev", color: "blue", active: true },
      ],
    } as never,
    new Set(),
  );
  assert.equal(mergedWithMember.members[0]?.id, "new-member");
});

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

test("draft tasks stay out of the workflow and Today action center", () => {
  const data = fixture();
  const draft = data.tasks[0];
  draft.is_draft = true;
  draft.status = "todo";
  draft.priority = "urgent";
  draft.deadline = "2026-11-20T12:00:00.000Z";

  assert.equal(isDraft(draft), true);
  assert.ok(
    !getTodayTasks(data.tasks, new Date("2026-11-20T15:00:00.000Z")).some(
      (task) => task.id === draft.id,
    ),
  );
});

test("Today excludes a task while its snooze window is active", () => {
  const data = fixture();
  data.tasks[0].priority = "urgent";
  data.tasks[0].snoozed_until = "2026-11-21T12:00:00.000Z";

  const today = getTodayTasks(data.tasks, new Date("2026-11-20T15:00:00.000Z"));
  assert.ok(!today.some((task) => task.id === data.tasks[0].id));
  assert.equal(isSnoozed(data.tasks[0], new Date("2026-11-20T15:00:00.000Z")), true);
  assert.equal(
    isSnoozed(
      { ...data.tasks[0], status: "done" },
      new Date("2026-11-20T15:00:00.000Z"),
    ),
    false,
  );
});

test("advanced task search supports field conditions and free text", () => {
  const data = fixture();
  const task = data.tasks[0];
  task.status = "review";
  task.priority = "urgent";
  task.is_draft = true;
  task.next_action = "Review API contract";

  assert.deepEqual(parseTaskSearch("status:review priority:urgent draft:true API"), {
    filters: { status: "review", priority: "urgent", draft: true },
    text: "api",
  });
  assert.equal(
    matchesTaskSearch(task, "status:review priority:urgent draft:true API"),
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
  task.is_draft = true;
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
  assert.equal(restored.is_draft, true);
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

  assert.equal(migrated.schema_version, 3);
  assert.deepEqual(migrated.tasks[0].blocked_by, []);
  assert.deepEqual(migrated.tasks[0].attachments, []);
  assert.deepEqual(migrated.tasks[0].checklist, []);
  assert.equal(migrated.tasks[0].id, payload.tasks[0].id);
  assert.ok(parseBoardDataWithError(migrated).data);
});

test("migration renames the legacy inbox flag to is_draft", () => {
  const payload = fixture() as unknown as {
    tasks: Array<Record<string, unknown>>;
  };
  payload.tasks[0].inbox = true;

  const migrated = migrateBoardData(payload) as typeof payload;
  assert.equal(migrated.tasks[0].is_draft, true);
  assert.equal("inbox" in migrated.tasks[0], false);
  assert.equal(parseBoardDataWithError(migrated).data?.tasks[0].is_draft, true);
});

test("migration clears snooze metadata from completed tasks", () => {
  const payload = fixture();
  payload.tasks[0].status = "done";
  payload.tasks[0].snoozed_until = "2026-11-30T10:00:00.000Z";
  const result = parseBoardDataWithError(payload).data;
  assert.ok(result);
  assert.equal(result.tasks[0].snoozed_until, undefined);
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

test("template manager trims rename and deletes only the selected template", () => {
  const templates = [
    {
      id: "template-a",
      name: "Alpha",
      title: "Task A",
      description: "",
      priority: "medium" as const,
      severity: "medium" as const,
      created_at: "2026-11-25T00:00:00.000Z",
    },
    {
      id: "template-b",
      name: "Beta",
      title: "Task B",
      description: "",
      priority: "low" as const,
      severity: "low" as const,
      created_at: "2026-11-25T00:00:00.000Z",
    },
  ];
  const renamed = renameTaskTemplate(templates, "template-a", "  Alpha v2  ");
  assert.equal(renamed[0].name, "Alpha v2");
  assert.equal(renameTaskTemplate(templates, "template-a", "   "), templates);
  assert.deepEqual(
    deleteTaskTemplate(renamed, "template-a").map((template) => template.id),
    ["template-b"],
  );
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
    assert.equal(remoteSyncQueue.listBlocked().length, 1);
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

test("browser reminder dedupe is isolated by workspace and preserves default IDs", () => {
  const date = "2026-11-26T10:00:00.000Z";
  assert.equal(
    getBrowserReminderId("default", "task-1", "Deadline", date),
    "task-1-Deadline-2026-11-26",
  );
  assert.notEqual(
    getBrowserReminderId("workspace-a", "task-1", "Deadline", date),
    getBrowserReminderId("workspace-b", "task-1", "Deadline", date),
  );
});

test("read notification state uses a workspace-scoped key and preserves legacy default key", () => {
  assert.equal(
    getReadNotificationStorageKey("default"),
    "taskboard-notifications-read-v1",
  );
  assert.notEqual(
    getReadNotificationStorageKey("workspace-a"),
    getReadNotificationStorageKey("workspace-b"),
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
