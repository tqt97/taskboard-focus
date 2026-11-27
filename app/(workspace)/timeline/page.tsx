import type { Metadata } from "next";
import { WorkspaceRouteContent } from "../../_components/workspace/features/WorkspaceRouteContent";

export const metadata: Metadata = {
  title: "Calendar & timeline | Taskboard",
  description:
    "Theo dõi Dev up, Staging up, Release và Deadline trên lịch và timeline Taskboard.",
};

export default function TimelinePage() {
  return <WorkspaceRouteContent view="timeline" />;
}
