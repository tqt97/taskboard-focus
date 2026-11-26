import type { Metadata } from "next";
import { WorkspaceRouteContent } from "../../_components/workspace/features/WorkspaceRouteContent";

export const metadata: Metadata = {
  title: "Today | Taskboard",
  description: "Tập trung vào task quá hạn, đến hạn hôm nay và task khẩn cấp.",
  alternates: { canonical: "/today" },
};

export default function TodayPage() {
  return <WorkspaceRouteContent view="today" />;
}
