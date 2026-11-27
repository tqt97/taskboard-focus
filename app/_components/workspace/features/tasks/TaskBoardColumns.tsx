import { ListTodo } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Status, Task } from "@/lib/types";

const ESTIMATED_TASK_HEIGHT = 188;
const TASK_GAP = 9;
const VIRTUAL_OVERSCAN = 4;

const labels: Record<Status, string> = {
  todo: "Chưa làm",
  in_progress: "Đang làm",
  review: "Chờ review",
  blocked: "Bị chặn",
  done: "Hoàn tất",
};

function findIndexAtOffset(offsets: number[], target: number) {
  let low = 0;
  let high = offsets.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2);
    if (offsets[middle] <= target) low = middle;
    else high = middle - 1;
  }
  return low;
}

function MeasuredTaskItem({
  task,
  taskCard,
  top,
  onHeight,
}: {
  task: Task;
  taskCard: (
    task: Task,
    options?: { dragEnabled?: boolean; density?: "board" | "compact" },
  ) => ReactNode;
  top: number;
  onHeight: (id: string, height: number) => void;
}) {
  const itemRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = itemRef.current;
    if (!element) return;
    const reportHeight = () =>
      onHeight(task.id, element.getBoundingClientRect().height);
    reportHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(reportHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [onHeight, task.id]);
  return (
    <div
      className="task-render-item"
      ref={itemRef}
      style={{ top, position: "absolute", insetInline: 0 }}
    >
      {taskCard(task)}
    </div>
  );
}

function VirtualizedTaskColumn({
  tasks,
  taskCard,
}: {
  tasks: Task[];
  taskCard: (task: Task) => ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const measuredHeightsRef = useRef(new Map<string, number>());
  const [measurementVersion, setMeasurementVersion] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(620);
  const frameRef = useRef<number | null>(null);
  const onHeight = useCallback((id: string, height: number) => {
    const roundedHeight = Math.ceil(height);
    if (roundedHeight <= 0 || measuredHeightsRef.current.get(id) === roundedHeight) {
      return;
    }
    measuredHeightsRef.current.set(id, roundedHeight);
    setMeasurementVersion((version) => version + 1);
  }, []);
  const layout = useMemo(() => {
    const offsets: number[] = [];
    let cursor = 0;
    tasks.forEach((task) => {
      offsets.push(cursor);
      cursor +=
        (measuredHeightsRef.current.get(task.id) || ESTIMATED_TASK_HEIGHT) + TASK_GAP;
    });
    return { offsets, totalHeight: Math.max(0, cursor - TASK_GAP) };
  }, [measurementVersion, tasks]);
  const visibleRange = useMemo(() => {
    if (!tasks.length) return { start: 0, end: 0 };
    const firstVisible = findIndexAtOffset(layout.offsets, scrollTop);
    const lastVisible = findIndexAtOffset(layout.offsets, scrollTop + viewportHeight);
    const start = Math.max(0, firstVisible - VIRTUAL_OVERSCAN);
    const end = Math.min(tasks.length, lastVisible + VIRTUAL_OVERSCAN + 1);
    return { start, end };
  }, [layout.offsets, scrollTop, tasks.length, viewportHeight]);
  const handleScroll = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      setScrollTop(scrollRef.current?.scrollTop || 0);
    });
  }, []);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setViewportHeight(entry.contentRect.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);
  useEffect(() => {
    const maxScrollTop = Math.max(0, layout.totalHeight - viewportHeight);
    if (scrollTop > maxScrollTop) {
      setScrollTop(maxScrollTop);
      if (scrollRef.current) scrollRef.current.scrollTop = maxScrollTop;
    }
  }, [layout.totalHeight, scrollTop, viewportHeight]);
  useEffect(() => {
    const taskIds = new Set(tasks.map((task) => task.id));
    measuredHeightsRef.current.forEach((_, id) => {
      if (!taskIds.has(id)) measuredHeightsRef.current.delete(id);
    });
  }, [tasks]);
  const visibleTasks = tasks.slice(visibleRange.start, visibleRange.end);
  return (
    <div className="kanban-cards" ref={scrollRef} onScroll={handleScroll}>
      <div
        className="virtualized-task-space"
        style={{ height: `${layout.totalHeight}px` }}
      >
        <div
          className="virtualized-task-window"
          style={{ height: `${layout.totalHeight}px` }}
        >
          {visibleTasks.map((task, offset) => (
            <MeasuredTaskItem
              key={task.id}
              task={task}
              taskCard={taskCard}
              top={layout.offsets[visibleRange.start + offset]}
              onHeight={onHeight}
            />
          ))}
        </div>
      </div>
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
  const tasksByStatus = useMemo(() => {
    const grouped: Record<Status, Task[]> = {
      todo: [],
      in_progress: [],
      review: [],
      blocked: [],
      done: [],
    };
    tasks.forEach((task) => grouped[task.status].push(task));
    return grouped;
  }, [tasks]);

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
        const columnTasks = tasksByStatus[typedStatus];
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
