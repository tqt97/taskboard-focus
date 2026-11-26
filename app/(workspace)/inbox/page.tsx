import type { Metadata } from "next";
import { WorkspaceRouteContent } from "../../_components/workspace/features/WorkspaceRouteContent";

export const metadata: Metadata = {
  title: "Inbox | Taskboard",
  description: "Phân loại nhanh các task mới trước khi đưa vào luồng xử lý.",
  alternates: { canonical: "/inbox" },
};

export default function InboxPage() {
  return <WorkspaceRouteContent view="inbox" />;
}
