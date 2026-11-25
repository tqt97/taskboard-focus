import assert from "node:assert/strict";
import test from "node:test";
import { demoData, migrateBoardData, parseBoardDataWithError } from "../lib/data.ts";
import {
  getDependencyState,
  getTodayTasks,
  isArchived,
} from "../lib/taskboard/selectors.ts";
import { getNextOccurrence } from "../lib/taskboard/recurrence.ts";
import { createTaskFromTemplate } from "../lib/taskboard/templates.ts";

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
  const migrated = migrateBoardData(payload) as typeof payload & {
    schema_version: number;
  };

  assert.equal(migrated.schema_version, 2);
  assert.deepEqual(migrated.tasks[0].blocked_by, []);
  assert.deepEqual(migrated.tasks[0].attachments, []);
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
