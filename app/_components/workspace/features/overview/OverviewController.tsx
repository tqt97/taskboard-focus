"use client";

import dynamic from "next/dynamic";
import { useWorkspaceRuntime } from "../../runtime/WorkspaceRuntimeContext";

const WorkspaceOverview = dynamic(
  () => import("./WorkspaceOverview").then((module) => module.WorkspaceOverview),
  { ssr: false, loading: () => <div className="board-loading" aria-busy="true" /> },
);

export function OverviewController() {
  const { data, now, copy, dueText, onOpenTask, onBrowseTasks } = useWorkspaceRuntime();

  return (
    <WorkspaceOverview
      tasks={data.tasks}
      members={data.members}
      now={now}
      copy={copy}
      dueText={dueText}
      onOpenTask={onOpenTask}
      onBrowseTasks={onBrowseTasks}
    />
  );
}
