import { WorkspaceEntry } from "./WorkspaceEntry";

export type WorkspaceView = "overview" | "tasks" | "today" | "inbox" | "timeline";

export function WorkspaceShell({ view = "overview" }: { view?: WorkspaceView }) {
  return <WorkspaceEntry view={view} />;
}
