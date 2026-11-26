"use client";

import { usePathname } from "next/navigation";
import { WorkspaceEntry } from "../workspace/layout/WorkspaceEntry";
import { getWorkspaceView } from "../workspace/layout/workspace-routes";

export function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const view = getWorkspaceView(pathname);

  if (!view) return children;

  return <WorkspaceEntry view={view}>{children}</WorkspaceEntry>;
}
