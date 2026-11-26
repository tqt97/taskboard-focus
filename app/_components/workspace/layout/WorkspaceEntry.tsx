"use client";

import dynamic from "next/dynamic";
import type { WorkspaceView } from "./WorkspaceShell";
import { WorkspaceLoading } from "./WorkspaceLoading";

const WorkspaceRuntime = dynamic(() => import("../runtime/WorkspaceRuntime"), {
  ssr: false,
  loading: () => <WorkspaceLoading />,
});

export function WorkspaceEntry({ view }: { view: WorkspaceView }) {
  return <WorkspaceRuntime initialView={view} />;
}
