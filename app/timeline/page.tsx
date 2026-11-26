import { WorkspaceShell } from "@/app/_components/workspace/WorkspaceShell";

export const metadata = {
  title: "Calendar & timeline | Taskboard",
  description:
    "Theo dõi Dev up, Staging up, Release và Deadline trên lịch và timeline Taskboard.",
  alternates: { canonical: "/timeline" },
};

export default function TimelinePage() {
  return <WorkspaceShell view="timeline" />;
}
