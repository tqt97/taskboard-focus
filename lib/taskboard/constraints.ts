import type { Member, Task } from "../types";

/**
 * Validates relationships that cannot be checked by validating one entity at a
 * time. The parser calls this after shape validation, so this module stays
 * small, deterministic, and easy to exercise without a browser or database.
 */
export function validateBoardRelations(
  tasks: Task[],
  members: Member[],
): string | null {
  const memberIds = new Set(members.map((member) => member.id));
  const taskIds = new Set(tasks.map((task) => task.id));

  for (const task of tasks) {
    const assigneeIds = task.assignee_ids || [];
    if (new Set(assigneeIds).size !== assigneeIds.length) {
      return `Task ${task.code || task.id} có người phụ trách bị trùng.`;
    }
    if (
      task.assignee_id &&
      assigneeIds.length > 0 &&
      task.assignee_id !== assigneeIds[0]
    ) {
      return `Task ${task.code || task.id} có dữ liệu người phụ trách không nhất quán.`;
    }
    if (
      assigneeIds.some((memberId) => !memberIds.has(memberId)) ||
      (task.assignee_id && !memberIds.has(task.assignee_id))
    ) {
      return "Backup có task gán cho thành viên không tồn tại.";
    }

    const dependencies = task.blocked_by || [];
    if (new Set(dependencies).size !== dependencies.length) {
      return `Task ${task.code || task.id} có dependency bị trùng.`;
    }
    if (
      dependencies.some(
        (dependencyId) => dependencyId === task.id || !taskIds.has(dependencyId),
      )
    ) {
      return "Backup có dependency trỏ tới task không tồn tại hoặc tự phụ thuộc.";
    }

    const activityIds = (task.activity || []).map((activity) => activity.id);
    if (new Set(activityIds).size !== activityIds.length) {
      return `Task ${task.code || task.id} có activity history bị trùng.`;
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const hasCycle = (taskId: string): boolean => {
    if (visiting.has(taskId)) return true;
    if (visited.has(taskId)) return false;
    visiting.add(taskId);
    const task = taskById.get(taskId);
    if (task && (task.blocked_by || []).some(hasCycle)) return true;
    visiting.delete(taskId);
    visited.add(taskId);
    return false;
  };

  if (tasks.some((task) => hasCycle(task.id))) {
    return "Backup có vòng lặp giữa các task phụ thuộc nhau.";
  }
  return null;
}
