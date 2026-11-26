"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { WorkspaceLoading } from "./WorkspaceLoading";

export type WorkspaceView = "overview" | "tasks" | "today" | "inbox" | "timeline";

const WorkspaceCoordinator = dynamic(() => import("./WorkspaceCoordinator"), {
  ssr: false,
  loading: () => <WorkspaceLoading />,
});

export function WorkspaceShell({ view = "overview" }: { view?: WorkspaceView }) {
  const [quickCaptureRequest, setQuickCaptureRequest] = useState(0);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (
        !typing &&
        !event.metaKey &&
        !event.ctrlKey &&
        event.key.toLowerCase() === "n"
      ) {
        event.preventDefault();
        setQuickCaptureRequest((request) => request + 1);
      }
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <WorkspaceCoordinator
      initialView={view}
      quickCaptureRequest={quickCaptureRequest}
    />
  );
}
