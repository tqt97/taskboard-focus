import { boardSchemaVersion, parseBoardData } from "../data.ts";
import { supabase } from "../supabase.ts";
import type { BoardData, Member, Task } from "../types";

export type SyncState =
  | { status: "local" }
  | { status: "syncing" }
  | { status: "synced"; at: string }
  | { status: "error"; message: string };

export interface TaskRepository {
  load(): Promise<BoardData>;
  loadWithRevision(): Promise<{ data: BoardData; revision?: string }>;
  save(data: BoardData, expectedUpdatedAt?: string): Promise<string>;
}

export interface RemoteTaskRepository {
  list(): Promise<Task[]>;
  get(taskId: string): Promise<Task | null>;
  upsert(task: Task, members?: Member[]): Promise<void>;
  resolveConflict(task: Task, members?: Member[]): Promise<void>;
  remove(taskId: string, expectedUpdatedAt?: string): Promise<void>;
}
export type RemoteWorkspace = {
  id: string;
  name: string;
  owner_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  updated_at: string;
};
export type RemoteWorkspaceMember = {
  workspace_id: string;
  user_id: string;
  role: RemoteWorkspace["role"];
  created_at: string;
};

export const remoteTaskScope = (ownerId: string, workspaceId?: string) =>
  workspaceId
    ? ({ field: "workspace_id" as const, value: workspaceId } as const)
    : ({ field: "owner_id" as const, value: ownerId } as const);

export const snapshotConflictKey = (workspaceId?: string) =>
  workspaceId ? "workspace_id" : "owner_id";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const remoteLegacyPrefix = (ownerId: string, workspaceId?: string) =>
  `legacy:${workspaceId ? `workspace:${workspaceId}` : `owner:${ownerId}`}:`;

export const toRemoteEntityId = (id: string, ownerId: string, workspaceId?: string) => {
  if (uuidPattern.test(id)) return id;
  const prefix = remoteLegacyPrefix(ownerId, workspaceId);
  return id.startsWith(prefix) ? id : `${prefix}${encodeURIComponent(id)}`;
};

export const fromRemoteEntityId = (
  id: string,
  ownerId?: string,
  workspaceId?: string,
) => {
  if (!ownerId) return id;
  const prefix = remoteLegacyPrefix(ownerId, workspaceId);
  if (!id.startsWith(prefix)) return id;
  try {
    return decodeURIComponent(id.slice(prefix.length));
  } catch {
    return id;
  }
};

export interface WorkspaceRepository {
  list(): Promise<RemoteWorkspace[]>;
  listMembers(workspaceId: string): Promise<RemoteWorkspaceMember[]>;
  listTaskMembers(workspaceId: string): Promise<Member[]>;
  removeTaskMember(workspaceId: string, memberId: string): Promise<void>;
  create(name: string): Promise<RemoteWorkspace>;
  remove(workspaceId: string): Promise<void>;
  setMemberRole(
    workspaceId: string,
    userId: string,
    role: RemoteWorkspace["role"],
  ): Promise<void>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
}

type SnapshotRow = { data: unknown; schema_version: number; updated_at?: string };

export const taskToRemoteRow = (task: Task, ownerId: string, workspaceId?: string) => ({
  id: toRemoteEntityId(task.id, ownerId, workspaceId),
  owner_id: ownerId,
  code: task.code,
  custom_code: task.custom_code === true,
  title: task.title,
  description: task.description,
  status: task.status,
  priority: task.priority,
  severity: task.severity,
  next_action: task.next_action || "",
  review_note: task.review_note || "",
  blocked_by: task.blocked_by || [],
  blocked_from: task.blocked_from || null,
  activity: task.activity || [],
  comments: task.comments || [],
  primary_links: task.primary_links || [],
  secondary_links: task.secondary_links || [],
  assignee_id:
    task.assignee_ids?.[0] || task.assignee_id
      ? toRemoteEntityId(
          task.assignee_ids?.[0] || task.assignee_id || "",
          ownerId,
          workspaceId,
        )
      : null,
  dev_up: task.dev_up || null,
  staging_up: task.staging_up || null,
  release_at: task.release_at || null,
  deadline: task.deadline || null,
  order_index: task.order_index,
  links: task.links || [],
  archived_at: task.archived_at || null,
  recurrence: task.recurrence || {},
  template_id: task.template_id || null,
  attachments: task.attachments || [],
  checklist: task.checklist || [],
  is_draft: task.is_draft === true,
  snoozed_until: task.snoozed_until || null,
  created_at: task.created_at,
  updated_at: task.updated_at,
  ...(workspaceId ? { workspace_id: workspaceId } : {}),
});

export const remoteRowToTask = (
  row: Record<string, unknown>,
  assigneeIds: string[] = [],
  ownerId?: string,
  workspaceId?: string,
) =>
  ({
    ...row,
    id: fromRemoteEntityId(String(row.id), ownerId, workspaceId),
    assignee_ids: assigneeIds.length
      ? assigneeIds.map((id) => fromRemoteEntityId(id, ownerId, workspaceId))
      : row.assignee_id
        ? [fromRemoteEntityId(String(row.assignee_id), ownerId, workspaceId)]
        : [],
    assignee_id: assigneeIds.length
      ? fromRemoteEntityId(assigneeIds[0], ownerId, workspaceId)
      : row.assignee_id
        ? fromRemoteEntityId(String(row.assignee_id), ownerId, workspaceId)
        : "",
    dev_up: row.dev_up || "",
    staging_up: row.staging_up || "",
    release_at: row.release_at || "",
    deadline: row.deadline || "",
    links: Array.isArray(row.links) ? row.links : [],
    blocked_by: Array.isArray(row.blocked_by) ? row.blocked_by : [],
    blocked_from:
      row.blocked_from === "todo" ||
      row.blocked_from === "in_progress" ||
      row.blocked_from === "review"
        ? row.blocked_from
        : undefined,
    activity: Array.isArray(row.activity) ? row.activity : [],
    comments: Array.isArray(row.comments) ? row.comments : [],
    primary_links: Array.isArray(row.primary_links) ? row.primary_links : [],
    secondary_links: Array.isArray(row.secondary_links) ? row.secondary_links : [],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
    snoozed_until:
      row.status === "done"
        ? undefined
        : typeof row.snoozed_until === "string"
          ? row.snoozed_until
          : undefined,
    recurrence:
      row.recurrence && typeof row.recurrence === "object" ? row.recurrence : undefined,
    is_draft: row.is_draft === true,
  }) as Task;

export function createSupabaseTaskRepository(
  ownerId: string,
  workspaceId?: string,
): TaskRepository {
  if (!supabase) {
    throw new Error("Supabase chưa được cấu hình cho workspace này.");
  }
  const client = supabase;
  return {
    async load() {
      return (await this.loadWithRevision()).data;
    },
    async loadWithRevision() {
      const table = workspaceId ? "workspace_snapshots" : "board_snapshots";
      const query = client
        .from(table)
        .select("data, schema_version, updated_at")
        .eq(workspaceId ? "workspace_id" : "owner_id", workspaceId || ownerId)
        .maybeSingle();
      const { data, error } = await query;
      if (error) throw new Error(`Không thể tải snapshot Supabase: ${error.message}`);
      if (!data) throw new Error("Workspace remote chưa có snapshot.");
      const snapshot = data as SnapshotRow;
      const parsed = parseBoardData(snapshot.data);
      if (!parsed) throw new Error("Snapshot remote không hợp lệ hoặc đã lỗi thời.");
      return { data: parsed, revision: snapshot.updated_at };
    },
    async save(board, expectedUpdatedAt) {
      const table = workspaceId ? "workspace_snapshots" : "board_snapshots";
      const key = snapshotConflictKey(workspaceId);
      const { data: current, error: readError } = await client
        .from(table)
        .select("updated_at")
        .eq(key, workspaceId || ownerId)
        .maybeSingle();
      if (readError)
        throw new Error(`Không thể kiểm tra revision remote: ${readError.message}`);
      const currentUpdatedAt = (current as { updated_at?: string } | null)?.updated_at;
      if (currentUpdatedAt && currentUpdatedAt !== expectedUpdatedAt) {
        throw new Error(
          "Workspace remote đã thay đổi hoặc chưa được Pull. Hãy Pull để xem bản mới trước khi Push.",
        );
      }
      const updatedAt = new Date().toISOString();
      const payload = {
        data: board,
        schema_version: boardSchemaVersion,
        updated_at: updatedAt,
      };
      if (currentUpdatedAt) {
        const { data: updated, error } = await client
          .from(table)
          .update(payload)
          .eq(key, workspaceId || ownerId)
          .eq("updated_at", expectedUpdatedAt)
          .select("updated_at")
          .maybeSingle();
        if (error) throw new Error(`Không thể lưu snapshot Supabase: ${error.message}`);
        if (!updated)
          throw new Error(
            "Workspace remote đã thay đổi trong lúc lưu. Hãy Pull để xem phiên bản mới trước khi Push.",
          );
      } else {
        const { error } = await client
          .from(table)
          .insert({ [key]: workspaceId || ownerId, ...payload });
        if (error) {
          if (error.code === "23505")
            throw new Error(
              "Workspace remote vừa được cập nhật bởi người khác. Hãy Pull trước khi Push.",
            );
          throw new Error(`Không thể lưu snapshot Supabase: ${error.message}`);
        }
      }
      return updatedAt;
    },
  };
}

export function createSupabaseWorkspaceRepository(
  ownerId: string,
): WorkspaceRepository {
  if (!supabase) throw new Error("Supabase chưa được cấu hình cho workspace này.");
  const client = supabase;
  return {
    async list() {
      const { data, error } = await client
        .from("workspaces")
        .select("id, name, owner_id, updated_at, workspace_members(role, user_id)")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(`Không thể tải danh sách workspace: ${error.message}`);
      return ((data || []) as Array<Record<string, unknown>>).map((row) => {
        const memberships = Array.isArray(row.workspace_members)
          ? (row.workspace_members as Array<Record<string, unknown>>)
          : [];
        const membership = memberships.find((item) => item.user_id === ownerId);
        return {
          id: String(row.id),
          name: String(row.name),
          owner_id: String(row.owner_id),
          role: (row.owner_id === ownerId
            ? "owner"
            : membership?.role || "member") as RemoteWorkspace["role"],
          updated_at: String(row.updated_at),
        };
      });
    },
    async create(name) {
      const { data, error } = await client
        .from("workspaces")
        .insert({ name: name.trim(), owner_id: ownerId })
        .select("id, name, owner_id, updated_at")
        .single();
      if (error || !data)
        throw new Error(
          `Không thể tạo workspace: ${error?.message || "Không có dữ liệu trả về."}`,
        );
      const { error: memberError } = await client.from("workspace_members").upsert({
        workspace_id: data.id,
        user_id: ownerId,
        role: "owner",
      });
      if (memberError) {
        await client.from("workspaces").delete().eq("id", data.id);
        throw new Error(
          `Workspace đã tạo nhưng không thể gán owner: ${memberError.message}`,
        );
      }
      return { ...data, role: "owner" as const };
    },
    async listMembers(workspaceId) {
      const { data, error } = await client
        .from("workspace_members")
        .select("workspace_id, user_id, role, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at");
      if (error)
        throw new Error(`Không thể tải thành viên workspace: ${error.message}`);
      return (data || []) as RemoteWorkspaceMember[];
    },
    async listTaskMembers(workspaceId) {
      const { data, error } = await client
        .from("members")
        .select("id, user_id, owner_id, workspace_id, name, role, color, active")
        .eq("workspace_id", workspaceId)
        .order("name");
      if (error)
        throw new Error(`Không thể tải danh sách người phụ trách: ${error.message}`);
      return (data || []) as Member[];
    },
    async removeTaskMember(workspaceId, memberId) {
      const { error } = await client
        .from("members")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("id", memberId);
      if (error) throw new Error(`Không thể xóa người phụ trách: ${error.message}`);
    },
    async setMemberRole(workspaceId, userId, role) {
      const { error } = await client.from("workspace_members").upsert({
        workspace_id: workspaceId,
        user_id: userId,
        role,
      });
      if (error)
        throw new Error(`Không thể cập nhật quyền thành viên: ${error.message}`);
    },
    async remove(workspaceId) {
      const { error } = await client.from("workspaces").delete().eq("id", workspaceId);
      if (error)
        throw new Error(`Không thể xóa workspace chưa hoàn tất: ${error.message}`);
    },
    async removeMember(workspaceId, userId) {
      const { error } = await client
        .from("workspace_members")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId);
      if (error)
        throw new Error(`Không thể xóa thành viên workspace: ${error.message}`);
    },
  };
}

export function createSupabaseRemoteTaskRepository(
  ownerId: string,
  workspaceId?: string,
): RemoteTaskRepository {
  if (!supabase) {
    throw new Error("Supabase chưa được cấu hình cho workspace này.");
  }
  const client = supabase;
  const scope = remoteTaskScope(ownerId, workspaceId);
  const repository: RemoteTaskRepository & {
    upsert(task: Task, members?: Member[], force?: boolean): Promise<void>;
  } = {
    async list() {
      const query = client.from("tasks").select("*").eq(scope.field, scope.value);
      const { data, error } = await query.order("order_index");
      if (error) throw new Error(`Không thể tải task remote: ${error.message}`);
      const rows = (data || []) as Record<string, unknown>[];
      const ids = rows.map((row) => String(row.id));
      const { data: assignments, error: assignmentError } = ids.length
        ? await client
            .from("task_assignees")
            .select("task_id, member_id")
            .in("task_id", ids)
        : { data: [], error: null };
      if (assignmentError)
        throw new Error(
          `Không thể tải quan hệ người phụ trách: ${assignmentError.message}`,
        );
      return rows.map((row) =>
        remoteRowToTask(
          row,
          (assignments || [])
            .filter((assignment) => assignment.task_id === row.id)
            .map((assignment) => String(assignment.member_id)),
          ownerId,
          workspaceId,
        ),
      );
    },
    async get(taskId) {
      const remoteTaskId = toRemoteEntityId(taskId, ownerId, workspaceId);
      const query = client
        .from("tasks")
        .select("*")
        .eq("id", remoteTaskId)
        .eq(scope.field, scope.value)
        .maybeSingle();
      const { data: row, error } = await query;
      if (error) throw new Error(`Không thể tải task remote: ${error.message}`);
      if (!row) return null;
      const { data: assignments, error: assignmentError } = await client
        .from("task_assignees")
        .select("member_id")
        .eq("task_id", remoteTaskId);
      if (assignmentError)
        throw new Error(
          `Không thể tải quan hệ người phụ trách: ${assignmentError.message}`,
        );
      return remoteRowToTask(
        row as Record<string, unknown>,
        (assignments || []).map((assignment) => String(assignment.member_id)),
        ownerId,
        workspaceId,
      );
    },
    async upsert(task, members, force = false) {
      const assigneeIds = task.assignee_ids?.length
        ? task.assignee_ids
        : task.assignee_id
          ? [task.assignee_id]
          : [];
      const assigneeMembers = members?.filter((member) =>
        assigneeIds.includes(member.id),
      );
      if (assigneeMembers?.length) {
        const memberIds = assigneeMembers.map((member) =>
          toRemoteEntityId(member.id, ownerId, workspaceId),
        );
        let existingMembersQuery = client
          .from("members")
          .select("id, owner_id")
          .in("id", memberIds);
        if (workspaceId)
          existingMembersQuery = existingMembersQuery.eq("workspace_id", workspaceId);
        const { data: existingMembers, error: existingMembersError } =
          await existingMembersQuery;
        if (existingMembersError)
          throw new Error(
            `Không thể kiểm tra owner thành viên: ${existingMembersError.message}`,
          );
        const existingOwners = new Map(
          (existingMembers || []).map((member) => [
            String(member.id),
            String(member.owner_id),
          ]),
        );
        const missingMembers = assigneeMembers.filter(
          (member) =>
            !existingOwners.has(toRemoteEntityId(member.id, ownerId, workspaceId)),
        );
        if (missingMembers.length) {
          const { error: memberError } = await client.from("members").upsert(
            missingMembers.map((member) => ({
              id: toRemoteEntityId(member.id, ownerId, workspaceId),
              user_id: member.user_id || null,
              owner_id: ownerId,
              workspace_id: workspaceId || null,
              name: member.name,
              role: member.role,
              color: member.color,
              active: member.active,
            })),
            { onConflict: "id", ignoreDuplicates: true },
          );
          if (memberError)
            throw new Error(
              `Không thể thêm thành viên còn thiếu vào workspace: ${memberError.message}`,
            );
        }
      }
      const remoteTaskId = toRemoteEntityId(task.id, ownerId, workspaceId);
      let currentQuery = client
        .from("tasks")
        .select("updated_at, owner_id")
        .eq("id", remoteTaskId)
        .eq(scope.field, scope.value);
      const { data: current, error: currentError } = await currentQuery.maybeSingle();
      if (currentError)
        throw new Error(`Không thể kiểm tra revision task: ${currentError.message}`);
      if (
        !force &&
        current?.updated_at &&
        new Date(String(current.updated_at)).getTime() >
          new Date(task.updated_at).getTime()
      ) {
        throw new Error(
          "Task trên cloud đã được cập nhật bởi người khác. Hãy Pull hoặc mở lại task trước khi lưu.",
        );
      }
      const row = taskToRemoteRow(
        task,
        workspaceId && current?.owner_id ? String(current.owner_id) : ownerId,
        workspaceId,
      );
      if (current?.updated_at) {
        let updateQuery = client
          .from("tasks")
          .update(row)
          .eq("id", remoteTaskId)
          .eq(scope.field, scope.value)
          .select("id");
        if (!force) updateQuery = updateQuery.eq("updated_at", current.updated_at);
        const { data: updated, error } = await updateQuery.maybeSingle();
        if (error) throw new Error(`Không thể lưu task remote: ${error.message}`);
        if (!updated)
          throw new Error(
            "Task trên cloud đã thay đổi trong lúc lưu. Hãy Pull hoặc mở lại task trước khi tiếp tục.",
          );
      } else {
        const { error } = await client.from("tasks").insert(row);
        if (error) throw new Error(`Không thể tạo task remote: ${error.message}`);
      }
      const { error: deleteError } = await client
        .from("task_assignees")
        .delete()
        .eq("task_id", remoteTaskId);
      if (deleteError)
        throw new Error(`Không thể cập nhật người phụ trách: ${deleteError.message}`);
      if (assigneeIds.length) {
        const { error: assignmentError } = await client.from("task_assignees").insert(
          assigneeIds.map((memberId) => ({
            task_id: remoteTaskId,
            member_id: toRemoteEntityId(memberId, ownerId, workspaceId),
          })),
        );
        if (assignmentError)
          throw new Error(`Không thể lưu người phụ trách: ${assignmentError.message}`);
      }
    },
    async resolveConflict(task, members) {
      return this.upsert(task, members, true);
    },
    async remove(taskId, expectedUpdatedAt) {
      const remoteTaskId = toRemoteEntityId(taskId, ownerId, workspaceId);
      let currentQuery = client
        .from("tasks")
        .select("updated_at")
        .eq("id", remoteTaskId)
        .eq(scope.field, scope.value);
      const { data: current, error: currentError } = await currentQuery.maybeSingle();
      if (currentError)
        throw new Error(`Không thể kiểm tra revision task: ${currentError.message}`);
      if (!current) return;
      if (expectedUpdatedAt && String(current.updated_at) !== expectedUpdatedAt)
        throw new Error(
          "Task trên cloud đã thay đổi nên không thể xóa bản cũ. Hãy Pull để xem phiên bản mới.",
        );
      let deleteQuery = client
        .from("tasks")
        .delete()
        .eq("id", remoteTaskId)
        .eq(scope.field, scope.value)
        .select("id");
      if (expectedUpdatedAt)
        deleteQuery = deleteQuery.eq("updated_at", expectedUpdatedAt);
      const { data: deleted, error } = await deleteQuery.maybeSingle();
      if (error) throw new Error(`Không thể xóa task remote: ${error.message}`);
      if (expectedUpdatedAt && !deleted)
        throw new Error(
          "Task trên cloud đã thay đổi nên không thể xóa bản cũ. Hãy Pull để xem phiên bản mới.",
        );
    },
  };
  return repository;
}
