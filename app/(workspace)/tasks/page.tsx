import type { Metadata } from "next";
import { WorkspaceRouteContent } from "../../_components/workspace/features/WorkspaceRouteContent";

export const metadata: Metadata = {
  title: "Task list | Taskboard",
  description: "Tìm kiếm, lọc và sắp xếp toàn bộ task trong workspace Taskboard.",
};

export default function TasksPage() {
  return <WorkspaceRouteContent view="tasks" />;
}
