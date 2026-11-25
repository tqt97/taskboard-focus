"use client";

import dynamic from "next/dynamic";
import { WorkspaceLoading } from "./WorkspaceLoading";

const WorkspaceCoordinator = dynamic(() => import("./WorkspaceCoordinator"), {
  ssr: false,
  loading: () => <WorkspaceLoading />,
});

export function WorkspaceShell() {
  return <WorkspaceCoordinator />;
}
