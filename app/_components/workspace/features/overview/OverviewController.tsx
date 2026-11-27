"use client";

import dynamic from "next/dynamic";
import { useWorkspaceActions, useWorkspaceData } from "../../state/WorkspaceProvider";

const WorkspaceOverview = dynamic(
  () => import("./WorkspaceOverview").then((module) => module.WorkspaceOverview),
  { ssr: false, loading: () => <div className="board-loading" aria-busy="true" /> },
);

export function OverviewController() {
  const { data, now, locale, copy, dueText } = useWorkspaceData();
  const { onOpenTask, onQuickUpdate, onBrowseTasks } = useWorkspaceActions();

  return (
    <WorkspaceOverview
      tasks={data.tasks}
      members={data.members}
      now={now}
      locale={locale}
      copy={copy}
      dueText={dueText}
      onOpenTask={onOpenTask}
      onQuickUpdate={onQuickUpdate}
      onBrowseTasks={onBrowseTasks}
    />
  );
}
