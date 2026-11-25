import Board from "@/app/_components/workspace/Board";

export const metadata = {
  title: "Task list | Taskboard",
  description: "Tìm kiếm, lọc và sắp xếp toàn bộ task trong workspace Taskboard.",
  alternates: { canonical: "/tasks" },
};

export default function TasksPage() {
  return <Board />;
}
