"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceLoading } from "./WorkspaceLoading";
import { getWorkspaceView, type WorkspaceView } from "./workspace-routes";

const WorkspaceRuntime = dynamic(() => import("../runtime/WorkspaceRuntime"), {
  ssr: false,
  loading: () => <WorkspaceLoading />,
});

export function WorkspaceEntry({
  view,
  children,
}: {
  view?: WorkspaceView;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const activeView = view || getWorkspaceView(pathname) || "overview";

  return <WorkspaceRuntime initialView={activeView} content={children} />;
}
