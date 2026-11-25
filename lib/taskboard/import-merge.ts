import type { BoardData, Task } from "../types";

export type ImportConflict = { id: string; local: Task; incoming: Task };

export function previewBoardImport(local: BoardData, incoming: BoardData) {
  const localById = new Map(local.tasks.map((task) => [task.id, task]));
  const conflicts: ImportConflict[] = [];
  for (const task of incoming.tasks) {
    const current = localById.get(task.id);
    if (current && current.updated_at !== task.updated_at)
      conflicts.push({ id: task.id, local: current, incoming: task });
  }
  return {
    conflicts,
    newTasks: incoming.tasks.filter((task) => !localById.has(task.id)).length,
  };
}

export function mergeBoardImport(
  local: BoardData,
  incoming: BoardData,
  keepIncoming: ReadonlySet<string>,
): BoardData {
  const incomingById = new Map(incoming.tasks.map((task) => [task.id, task]));
  const tasks = local.tasks.map((task) =>
    keepIncoming.has(task.id) && incomingById.has(task.id)
      ? incomingById.get(task.id)!
      : task,
  );
  for (const task of incoming.tasks)
    if (!local.tasks.some((item) => item.id === task.id)) tasks.push(task);
  const localMemberIds = new Set(local.members.map((member) => member.id));
  return {
    ...local,
    tasks,
    members: [
      ...local.members,
      ...incoming.members.filter((member) => !localMemberIds.has(member.id)),
    ],
  };
}
