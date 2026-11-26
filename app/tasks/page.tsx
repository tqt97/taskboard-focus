import { WorkspaceShell } from "@/app/_components/workspace/layout/WorkspaceShell";

export const metadata = {
  title: "Task list | Taskboard",
  description: "Tìm kiếm, lọc và sắp xếp toàn bộ task trong workspace Taskboard.",
  alternates: { canonical: "/tasks" },
};

export default function TasksPage() {
  return <WorkspaceShell view="tasks" />;
}
