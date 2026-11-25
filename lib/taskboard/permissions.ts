export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type WorkspacePermission =
  "manage_workspace" | "manage_members" | "edit_tasks" | "comment_tasks" | "view_tasks";

const rolePermissions: Record<WorkspaceRole, readonly WorkspacePermission[]> = {
  owner: [
    "manage_workspace",
    "manage_members",
    "edit_tasks",
    "comment_tasks",
    "view_tasks",
  ],
  admin: ["manage_members", "edit_tasks", "comment_tasks", "view_tasks"],
  member: ["edit_tasks", "comment_tasks", "view_tasks"],
  viewer: ["view_tasks"],
};

export const can = (role: WorkspaceRole, permission: WorkspacePermission) =>
  rolePermissions[role].includes(permission);

export const normalizeWorkspaceRole = (value: unknown): WorkspaceRole =>
  value === "owner" || value === "admin" || value === "member" || value === "viewer"
    ? value
    : "member";
