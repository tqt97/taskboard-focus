import assert from "node:assert/strict";
import test from "node:test";
import { demoData, parseBoardDataWithError } from "../lib/data.ts";

const fixture = () => JSON.parse(JSON.stringify(demoData)) as typeof demoData;

test("accepts a valid legacy backup and normalizes assignee_id", () => {
  const result = parseBoardDataWithError(fixture());

  assert.ok(result.data);
  assert.deepEqual(result.data.tasks[0].assignee_ids, ["m1"]);
  assert.equal(result.data.tasks[0].assignee_id, "m1");
});

test("rejects a non-object backup with a useful error", () => {
  const result = parseBoardDataWithError(null);

  assert.equal(result.data, null);
  assert.match(result.error || "", /object JSON hợp lệ/);
});

test("rejects a backup missing tasks or members", () => {
  const missingTasks = parseBoardDataWithError({ members: [] });
  const missingMembers = parseBoardDataWithError({ tasks: [] });

  assert.equal(missingTasks.data, null);
  assert.equal(missingMembers.data, null);
  assert.match(missingTasks.error || "", /tasks và members/);
  assert.match(missingMembers.error || "", /tasks và members/);
});

test("rejects duplicate member IDs", () => {
  const payload = fixture();
  payload.members[1].id = payload.members[0].id;

  const result = parseBoardDataWithError(payload);

  assert.equal(result.data, null);
  assert.match(result.error || "", /ID thành viên bị trùng/);
});

test("rejects duplicate task IDs", () => {
  const payload = fixture();
  payload.tasks[1].id = payload.tasks[0].id;

  const result = parseBoardDataWithError(payload);

  assert.equal(result.data, null);
  assert.match(result.error || "", /ID task bị trùng/);
});

test("rejects a task with an empty title", () => {
  const payload = fixture();
  payload.tasks[0].title = "   ";

  const result = parseBoardDataWithError(payload);

  assert.equal(result.data, null);
  assert.match(result.error || "", /task thiếu dữ liệu/);
});

test("rejects an invalid member shape", () => {
  const payload = fixture();
  payload.members[0].color = "red";

  const result = parseBoardDataWithError(payload);

  assert.equal(result.data, null);
  assert.match(result.error || "", /thành viên thiếu dữ liệu/);
});

test("rejects invalid task enums", () => {
  const invalidStatus = fixture();
  invalidStatus.tasks[0].status = "in_review" as never;
  const statusResult = parseBoardDataWithError(invalidStatus);

  const invalidPriority = fixture();
  invalidPriority.tasks[0].priority = "p0" as never;
  const priorityResult = parseBoardDataWithError(invalidPriority);

  assert.equal(statusResult.data, null);
  assert.equal(priorityResult.data, null);
  assert.match(statusResult.error || "", /task thiếu dữ liệu/);
  assert.match(priorityResult.error || "", /task thiếu dữ liệu/);
});

test("accepts multiple assignees and rejects an empty link label", () => {
  const valid = fixture();
  valid.tasks[0].assignee_ids = ["m1", "m2"];
  const validResult = parseBoardDataWithError(valid);

  assert.ok(validResult.data);
  assert.deepEqual(validResult.data.tasks[0].assignee_ids, ["m1", "m2"]);

  const invalid = fixture();
  invalid.tasks[0].primary_links = [{ label: " ", url: "https://example.com" }];
  const invalidResult = parseBoardDataWithError(invalid);

  assert.equal(invalidResult.data, null);
  assert.match(invalidResult.error || "", /task thiếu dữ liệu/);
});

test("rejects an unknown ID inside multiple assignees", () => {
  const payload = fixture();
  payload.tasks[0].assignee_ids = ["m1", "missing-member"];

  const result = parseBoardDataWithError(payload);

  assert.equal(result.data, null);
  assert.match(result.error || "", /thành viên không tồn tại/);
});

test("rejects an unknown legacy assignee", () => {
  const payload = fixture();
  payload.tasks[0].assignee_id = "missing-member";

  const result = parseBoardDataWithError(payload);

  assert.equal(result.data, null);
  assert.match(result.error || "", /thành viên không tồn tại/);
});

test("accepts a valid dependency chain", () => {
  const payload = fixture();
  payload.tasks[1].blocked_by = [payload.tasks[0].id];

  const result = parseBoardDataWithError(payload);

  assert.ok(result.data);
  assert.deepEqual(result.data.tasks[1].blocked_by, [payload.tasks[0].id]);
});

test("rejects a missing dependency", () => {
  const payload = fixture();
  payload.tasks[0].blocked_by = ["missing-task"];

  const result = parseBoardDataWithError(payload);

  assert.equal(result.data, null);
  assert.match(result.error || "", /dependency trỏ tới task không tồn tại/);
});

test("rejects a self dependency", () => {
  const payload = fixture();
  payload.tasks[0].blocked_by = [payload.tasks[0].id];

  const result = parseBoardDataWithError(payload);

  assert.equal(result.data, null);
  assert.match(result.error || "", /tự phụ thuộc/);
});

test("rejects a dependency cycle", () => {
  const payload = fixture();
  payload.tasks[0].blocked_by = [payload.tasks[1].id];
  payload.tasks[1].blocked_by = [payload.tasks[0].id];

  const result = parseBoardDataWithError(payload);

  assert.equal(result.data, null);
  assert.match(result.error || "", /vòng lặp/);
});

test("rejects a three-task dependency cycle", () => {
  const payload = fixture();
  payload.tasks[0].blocked_by = [payload.tasks[1].id];
  payload.tasks[1].blocked_by = [payload.tasks[2].id];
  payload.tasks[2].blocked_by = [payload.tasks[0].id];

  const result = parseBoardDataWithError(payload);

  assert.equal(result.data, null);
  assert.match(result.error || "", /vòng lặp/);
});

test("rejects invalid dates and unsafe links", () => {
  const invalidDate = fixture();
  invalidDate.tasks[0].deadline = "not-a-date";
  const dateResult = parseBoardDataWithError(invalidDate);

  assert.equal(dateResult.data, null);
  assert.match(dateResult.error || "", /task thiếu dữ liệu/);

  const invalidLink = fixture();
  invalidLink.tasks[0].primary_links = [{ label: "X", url: "javascript:alert(1)" }];
  const linkResult = parseBoardDataWithError(invalidLink);

  assert.equal(linkResult.data, null);
  assert.match(linkResult.error || "", /task thiếu dữ liệu/);

  const invalidLegacyLink = fixture();
  invalidLegacyLink.tasks[0].links = ["javascript:alert(1)"];
  const legacyLinkResult = parseBoardDataWithError(invalidLegacyLink);

  assert.equal(legacyLinkResult.data, null);
  assert.match(legacyLinkResult.error || "", /task thiếu dữ liệu/);
});

test("rejects oversized task content", () => {
  const payload = fixture();
  payload.tasks[0].title = "x".repeat(501);

  const result = parseBoardDataWithError(payload);

  assert.equal(result.data, null);
  assert.match(result.error || "", /task thiếu dữ liệu/);
});

test("rejects an empty activity timestamp and normalizes unknown sort mode", () => {
  const invalidActivity = fixture();
  invalidActivity.tasks[0].activity = [
    { id: "a1", type: "updated", at: "", summary: "Cập nhật" },
  ];
  const activityResult = parseBoardDataWithError(invalidActivity);

  assert.equal(activityResult.data, null);
  assert.match(activityResult.error || "", /task thiếu dữ liệu/);

  const invalidActivityType = fixture();
  invalidActivityType.tasks[0].activity = [
    { id: "a1", type: "deleted", at: new Date().toISOString(), summary: "Xóa" },
  ] as never;
  const activityTypeResult = parseBoardDataWithError(invalidActivityType);

  assert.equal(activityTypeResult.data, null);
  assert.match(activityTypeResult.error || "", /task thiếu dữ liệu/);

  const invalidActivitySummary = fixture();
  invalidActivitySummary.tasks[0].activity = [
    { id: "a1", type: "updated", at: new Date().toISOString(), summary: " " },
  ];
  const activitySummaryResult = parseBoardDataWithError(invalidActivitySummary);

  assert.equal(activitySummaryResult.data, null);
  assert.match(activitySummaryResult.error || "", /task thiếu dữ liệu/);

  const missingTimestamp = fixture();
  missingTimestamp.tasks[0].created_at = "";
  const timestampResult = parseBoardDataWithError(missingTimestamp);

  assert.equal(timestampResult.data, null);
  assert.match(timestampResult.error || "", /task thiếu dữ liệu/);

  const unknownSort = fixture();
  unknownSort.sort_mode = "unsupported" as typeof unknownSort.sort_mode;
  const sortResult = parseBoardDataWithError(unknownSort);

  assert.ok(sortResult.data);
  assert.equal(sortResult.data.sort_mode, "smart");
});

test("rejects a backup beyond the task count limit before duplicate checks", () => {
  const payload = fixture();
  payload.tasks = Array.from({ length: 10001 }, (_, index) => ({
    ...payload.tasks[0],
    id: `oversized-${index}`,
  }));

  const result = parseBoardDataWithError(payload);

  assert.equal(result.data, null);
  assert.match(result.error || "", /vượt quá giới hạn/);
});

test("rejects a backup beyond the member count limit", () => {
  const payload = fixture();
  payload.members = Array.from({ length: 1001 }, (_, index) => ({
    ...payload.members[0],
    id: `member-${index}`,
  }));

  const result = parseBoardDataWithError(payload);

  assert.equal(result.data, null);
  assert.match(result.error || "", /vượt quá giới hạn/);
});
