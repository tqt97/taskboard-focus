import { ListTodo } from "lucide-react";
import type { ReactNode } from "react";
import type { Task } from "@/lib/types";

export function TaskFlatList({
  tasks,
  taskCard,
}: {
  tasks: Task[];
  taskCard: (
    task: Task,
    options?: { dragEnabled?: boolean; density?: "board" | "compact" },
  ) => ReactNode;
}) {
  if (!tasks.length) {
    return (
      <div className="empty-state">
        <ListTodo size={28} />
        <b>Chưa tìm thấy task</b>
        <span>Thử đổi bộ lọc hoặc tạo công việc mới.</span>
      </div>
    );
  }

  return (
    <div className="task-flat-list" role="list" aria-label="Danh sách công việc">
      {tasks.map((task) => (
        <div className="task-flat-list-item" key={task.id} role="listitem">
          {taskCard(task, { dragEnabled: false, density: "compact" })}
        </div>
      ))}
    </div>
  );
}
