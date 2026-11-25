import { ListTodo } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibilityCallbacks = useRef(new Map<Element, (isVisible: boolean) => void>());
  const observeItem = useCallback(
    (element: HTMLDivElement, setVisible: (visible: boolean) => void) => {
      if (typeof IntersectionObserver === "undefined" || !scrollRef.current)
        return () => {};
      if (!observerRef.current) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              const setVisible = visibilityCallbacks.current.get(entry.target);
              if (setVisible) setVisible(entry.isIntersecting);
            });
          },
          { root: scrollRef.current, rootMargin: "720px 0px" },
        );
      }
      visibilityCallbacks.current.set(element, setVisible);
      observerRef.current.observe(element);
      return () => {
        visibilityCallbacks.current.delete(element);
        observerRef.current?.unobserve(element);
      };
    },
    [],
  );
  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      visibilityCallbacks.current.clear();
    },
    [],
  );
  return (
    <div className="kanban-cards" ref={scrollRef}>
      {tasks.map((task, index) => (
        <VirtualizedTaskItem
          key={task.id}
          index={index}
          task={task}
          taskCard={taskCard}
          observeItem={observeItem}
        />
      ))}
    </div>
  );
}

function VirtualizedTaskItem({
  index,
  task,
  taskCard,
  observeItem,
}: {
  index: number;
  task: Task;
  taskCard: (task: Task) => ReactNode;
  observeItem: (
    element: HTMLDivElement,
    setVisible: (visible: boolean) => void,
  ) => () => void;
}) {
  const itemRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(index < 12);
  useEffect(() => {
    if (index < 12) {
      setMounted(true);
      return;
    }
    const item = itemRef.current;
    if (!item || typeof IntersectionObserver === "undefined") {
      setMounted(true);
      return;
    }
    return observeItem(item, setMounted);
  }, [index, observeItem]);
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
