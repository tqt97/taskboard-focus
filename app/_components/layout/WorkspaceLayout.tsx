import { WorkspaceEntry } from "../workspace/layout/WorkspaceEntry";

export function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceEntry>{children}</WorkspaceEntry>;
}
