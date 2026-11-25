import { ListTodo } from "lucide-react";
import type { ReactNode } from "react";
import type { Status, Task } from "@/lib/types";

const labels: Record<Status, string> = {
  todo: "Chưa làm",
  in_progress: "Đang làm",
  blocked: "Đang review",
  done: "Hoàn tất",
};

export function TaskBoardColumns({
  tasks,
  taskCard,
  onDropStatus,
}: {
  tasks: Task[];
  taskCard: (task: Task) => ReactNode;
  onDropStatus: (status: Status) => void;
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
    <div className="kanban-board">
      {Object.entries(labels).map(([status, label]) => {
        const typedStatus = status as Status;
        const columnTasks = tasks.filter((task) => task.status === typedStatus);
        return (
          <section
            className="kanban-column"
            key={status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => onDropStatus(typedStatus)}
          >
            <header>
              <span className={`status status-${status}`}>
                <i />
                {label}
              </span>
              <b>{columnTasks.length}</b>
            </header>
            <div className="kanban-cards">{columnTasks.map(taskCard)}</div>
          </section>
        );
      })}
    </div>
  );
}
