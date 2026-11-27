"use client";

import dynamic from "next/dynamic";
import {
  useWorkspaceActions,
  useWorkspaceData,
  useWorkspaceView,
} from "../../state/WorkspaceProvider";

const TimelineView = dynamic(
  () => import("./TimelineView").then((module) => module.TimelineView),
  {
    ssr: false,
    loading: () => <div className="timeline-loading" aria-busy="true" />,
  },
);

export function TimelineController() {
  const { activeTasks, data, locale } = useWorkspaceData();
  const { canEditWorkspace } = useWorkspaceView();
  const { onOpenTask, onUpdateDeadline } = useWorkspaceActions();

  return (
    <TimelineView
      tasks={activeTasks}
      members={data.members}
      readOnly={!canEditWorkspace}
      locale={locale}
      onOpenTask={onOpenTask}
      onUpdateDeadline={onUpdateDeadline}
    />
  );
}
