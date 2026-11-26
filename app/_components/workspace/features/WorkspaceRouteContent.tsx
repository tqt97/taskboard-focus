"use client";

import dynamic from "next/dynamic";
import type { WorkspaceView } from "../layout/WorkspaceShell";

const OverviewController = dynamic(
  () =>
    import("./overview/OverviewController").then((module) => module.OverviewController),
  { ssr: false, loading: () => <div className="board-loading" aria-busy="true" /> },
);
const TimelineController = dynamic(
  () =>
    import("./timeline/TimelineController").then((module) => module.TimelineController),
  { ssr: false, loading: () => <div className="timeline-loading" aria-busy="true" /> },
);
const TaskListController = dynamic(
  () =>
    import("./tasks/TaskListController").then((module) => module.TaskListController),
  { ssr: false, loading: () => <div className="board-loading" aria-busy="true" /> },
);
const TodayController = dynamic(
  () => import("./tasks/TodayController").then((module) => module.TodayController),
  { ssr: false, loading: () => <div className="board-loading" aria-busy="true" /> },
);
const InboxController = dynamic(
  () => import("./tasks/InboxController").then((module) => module.InboxController),
  { ssr: false, loading: () => <div className="board-loading" aria-busy="true" /> },
);

export function WorkspaceRouteContent({ view }: { view: WorkspaceView }) {
  if (view === "overview") return <OverviewController />;
  if (view === "timeline") return <TimelineController />;
  if (view === "today") return <TodayController />;
  if (view === "inbox") return <InboxController />;
  return <TaskListController />;
}
