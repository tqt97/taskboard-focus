export type WorkspaceView = "overview" | "tasks" | "today" | "drafts" | "timeline";

const workspaceViews: Record<string, WorkspaceView> = {
  "/": "overview",
  "/tasks": "tasks",
  "/today": "today",
  "/drafts": "drafts",
  "/inbox": "drafts",
  "/timeline": "timeline",
};

export function getWorkspaceView(pathname: string): WorkspaceView | null {
  return workspaceViews[pathname] || null;
}
