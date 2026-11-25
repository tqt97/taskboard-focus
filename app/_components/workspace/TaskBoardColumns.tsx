import { ListTodo } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Status, Task } from "@/lib/types";

const labels: Record<Status, string> = {
  todo: "Chưa làm",
  in_progress: "Đang làm",
  review: "Chờ review",
  blocked: "Bị chặn",
  done: "Hoàn tất",
};

function VirtualizedTaskColumn({
  tasks,
  taskCard,
}: {
  tasks: Task[];
  taskCard: (task: Task) => ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div className="kanban-cards" ref={scrollRef}>
      {tasks.map((task, index) => (
        <VirtualizedTaskItem
          key={task.id}
          index={index}
          task={task}
          taskCard={taskCard}
          rootRef={scrollRef}
        />
      ))}
    </div>
  );
}

function VirtualizedTaskItem({
  index,
  task,
  taskCard,
  rootRef,
}: {
  index: number;
  task: Task;
  taskCard: (task: Task) => ReactNode;
  rootRef: RefObject<HTMLDivElement | null>;
}) {
  const itemRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(index < 12);
  useEffect(() => {
    const item = itemRef.current;
    const root = rootRef.current;
    if (!item || !root || typeof IntersectionObserver === "undefined") {
      setMounted(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setMounted(entry.isIntersecting),
      { root, rootMargin: "720px 0px" },
    );
    observer.observe(item);
    return () => observer.disconnect();
  }, [rootRef]);
  return (
    <div
      className="task-render-item"
      ref={itemRef}
      style={mounted ? undefined : { minHeight: 132 }}
      aria-hidden={!mounted}
    >
      {mounted ? taskCard(task) : null}
    </div>
  );
}

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
            <VirtualizedTaskColumn tasks={columnTasks} taskCard={taskCard} />
          </section>
        );
      })}
    </div>
  );
}
