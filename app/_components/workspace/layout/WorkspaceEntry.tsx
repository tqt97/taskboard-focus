"use client";

import dynamic from "next/dynamic";
import type { WorkspaceView } from "./WorkspaceShell";
import { WorkspaceLoading } from "./WorkspaceLoading";

const WorkspaceCoordinator = dynamic(() => import("../state/WorkspaceCoordinator"), {
  ssr: false,
  loading: () => <WorkspaceLoading />,
});

export function WorkspaceEntry({ view }: { view: WorkspaceView }) {
  return <WorkspaceCoordinator initialView={view} />;
}
