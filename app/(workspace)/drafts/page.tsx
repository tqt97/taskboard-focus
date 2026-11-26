import type { Metadata } from "next";
import { WorkspaceRouteContent } from "../../_components/workspace/features/WorkspaceRouteContent";

export const metadata: Metadata = {
  title: "Bản nháp | Taskboard",
  description: "Các công việc mới được lưu tạm trước khi đưa vào luồng xử lý.",
  alternates: { canonical: "/drafts" },
};

export default function DraftsPage() {
  return <WorkspaceRouteContent view="drafts" />;
}
