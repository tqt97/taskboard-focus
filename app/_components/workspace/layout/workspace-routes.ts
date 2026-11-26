export type WorkspaceView = "overview" | "tasks" | "today" | "inbox" | "timeline";

const workspaceViews: Record<string, WorkspaceView> = {
  "/": "overview",
  "/tasks": "tasks",
  "/today": "today",
  "/inbox": "inbox",
  "/timeline": "timeline",
};

export function getWorkspaceView(pathname: string): WorkspaceView | null {
  return workspaceViews[pathname] || null;
}
