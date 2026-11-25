"use client";

import { useMemo, useState } from "react";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Move,
} from "lucide-react";
import { intlLocale, type AppLocale } from "@/lib/i18n";
import type { Member, Task } from "@/lib/types";

type TimelineMode = "calendar" | "timeline";
type MilestoneKey = "dev_up" | "staging_up" | "release_at" | "deadline";
type MilestoneFilter = "all" | MilestoneKey;

const milestoneKeys: MilestoneKey[] = [
  "dev_up",
  "staging_up",
  "release_at",
  "deadline",
];
const timelineCopy = {
  vi: {
    aria: "Lịch và timeline công việc",
    calendar: "Lịch tuần",
    timeline: "Timeline release",
    assignee: "Người phụ trách",
    all: "Tất cả",
    milestone: "Mốc hiển thị",
    allMilestones: "Tất cả mốc",
    previous: "Khoảng thời gian trước",
    next: "Khoảng thời gian sau",
    today: "Hôm nay",
    dragHint: "Kéo mốc Deadline sang ngày khác để đổi hạn",
    readOnlyDragHint:
      "Chỉ Deadline có thể kéo; mở task để sửa các mốc Dev/Staging/Release.",
    openDetails: "Mở chi tiết task để chỉnh mốc này",
    dependency: "Phụ thuộc",
    noDependency: "Không có phụ thuộc",
    empty: "Không có task phù hợp với bộ lọc.",
    taskDependency: "Task / phụ thuộc",
    milestones: {
      dev_up: ["Dev up", "Dev"],
      staging_up: ["Staging up", "Stage"],
      release_at: ["Release", "Release"],
      deadline: ["Deadline", "Deadline"],
    },
  },
  en: {
    aria: "Task calendar and timeline",
    calendar: "Week calendar",
    timeline: "Release timeline",
    assignee: "Assignee",
    all: "All",
    milestone: "Milestone",
    allMilestones: "All milestones",
    previous: "Previous period",
    next: "Next period",
    today: "Today",
    dragHint: "Drag a Deadline milestone to another day to reschedule it",
    readOnlyDragHint:
      "Only Deadline can be dragged; open the task to edit Dev/Staging/Release.",
    openDetails: "Open task details to edit this milestone",
    dependency: "Depends on",
    noDependency: "No dependencies",
    empty: "No tasks match the current filters.",
    taskDependency: "Task / dependencies",
    milestones: {
      dev_up: ["Dev up", "Dev"],
      staging_up: ["Staging up", "Stage"],
      release_at: ["Release", "Release"],
      deadline: ["Deadline", "Deadline"],
    },
  },
  ja: {
    aria: "タスクのカレンダーとタイムライン",
    calendar: "週間カレンダー",
    timeline: "リリースタイムライン",
    assignee: "担当者",
    all: "すべて",
    milestone: "マイルストーン",
    allMilestones: "すべてのマイルストーン",
    previous: "前の期間",
    next: "次の期間",
    today: "今日",
    dragHint: "Deadlineを別の日へドラッグして変更",
    readOnlyDragHint:
      "ドラッグできるのはDeadlineのみ。Dev/Staging/Releaseはタスク詳細で変更します。",
    openDetails: "タスク詳細でこのマイルストーンを変更",
    dependency: "依存先",
    noDependency: "依存関係なし",
    empty: "条件に一致するタスクはありません。",
    taskDependency: "タスク / 依存関係",
    milestones: {
      dev_up: ["Dev up", "Dev"],
      staging_up: ["Staging up", "Stage"],
      release_at: ["Release", "Release"],
      deadline: ["Deadline", "Deadline"],
    },
  },
} as const;

const dayMs = 86400000;
const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};
const startOfWeek = (date: Date) => {
  const result = startOfDay(date);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
};
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * dayMs);
const taskDate = (task: Task, key: MilestoneKey) => {
  const value = task[key];
  return value ? new Date(value) : null;
};
const formatDate = (
  date: Date,
  options: Intl.DateTimeFormatOptions,
  locale: AppLocale,
) => new Intl.DateTimeFormat(intlLocale[locale], options).format(date);

export function TimelineView({
  tasks,
  members,
  readOnly,
  locale,
  onOpenTask,
  onUpdateDeadline,
}: {
  tasks: Task[];
  members: Member[];
  readOnly: boolean;
  locale: AppLocale;
  onOpenTask: (task: Task) => void;
  onUpdateDeadline: (task: Task, date: Date) => void;
}) {
  const [mode, setMode] = useState<TimelineMode>("calendar");
  const [cursor, setCursor] = useState(() => startOfWeek(new Date()));
  const [assignee, setAssignee] = useState("all");
  const [milestoneFilter, setMilestoneFilter] = useState<MilestoneFilter>("all");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const labels = timelineCopy[locale];
  const milestones = milestoneKeys.map((key) => ({
    key,
    label: labels.milestones[key][0],
    short: labels.milestones[key][1],
  }));

  const rangeLength = mode === "calendar" ? 7 : 14;
  const days = useMemo(
    () => Array.from({ length: rangeLength }, (_, index) => addDays(cursor, index)),
    [cursor, rangeLength],
  );
  const visibleTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          !task.archived_at &&
          (assignee === "all" || (task.assignee_ids || []).includes(assignee)),
      ),
    [assignee, tasks],
  );
  const milestoneForTask = (task: Task) =>
    milestones.filter(
      ({ key }) => milestoneFilter === "all" || key === milestoneFilter,
    );
  const eventsForDay = (task: Task, day: Date) =>
    milestoneForTask(task).filter((milestone) => {
      const value = taskDate(task, milestone.key);
      return value && dateKey(value) === dateKey(day);
    });
  const moveCursor = (delta: number) =>
    setCursor((date) => addDays(date, delta * rangeLength));
  const dropDeadline = (day: Date) => {
    if (readOnly || !draggedTaskId) return;
    const task = tasks.find((item) => item.id === draggedTaskId);
    if (!task) return;
    const nextDate = new Date(day);
    nextDate.setHours(12, 0, 0, 0);
    onUpdateDeadline(task, nextDate);
    setDraggedTaskId(null);
  };
  const handleDragStart = (task: Task, event: React.DragEvent<HTMLButtonElement>) => {
    if (readOnly) {
      event.preventDefault();
      return;
    }
    setDraggedTaskId(task.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/task-id", task.id);
  };

  return (
    <section className="timeline-view panel" aria-label={labels.aria}>
      <div className="timeline-toolbar">
        <div className="timeline-mode-switch" role="tablist" aria-label="Kiểu hiển thị">
          <button
            className={mode === "calendar" ? "selected" : ""}
            role="tab"
            aria-selected={mode === "calendar"}
            onClick={() => setMode("calendar")}
          >
            <CalendarRange size={15} /> {labels.calendar}
          </button>
          <button
            className={mode === "timeline" ? "selected" : ""}
            role="tab"
            aria-selected={mode === "timeline"}
            onClick={() => setMode("timeline")}
          >
            <GitBranch size={15} /> {labels.timeline}
          </button>
        </div>
        <div className="timeline-filters">
          <label>
            <span>{labels.assignee}</span>
            <select
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
            >
              <option value="all">{labels.all}</option>
              {members
                .filter((member) => member.active)
                .map((member) => (
                  <option value={member.id} key={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>{labels.milestone}</span>
            <select
              value={milestoneFilter}
              onChange={(event) =>
                setMilestoneFilter(event.target.value as MilestoneFilter)
              }
            >
              <option value="all">{labels.allMilestones}</option>
              {milestones.map((milestone) => (
                <option value={milestone.key} key={milestone.key}>
                  {milestone.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="timeline-period-bar">
        <button
          className="icon-button mini"
          title={labels.previous}
          aria-label={labels.previous}
          onClick={() => moveCursor(-1)}
        >
          <ChevronLeft size={16} />
        </button>
        <strong>
          {formatDate(days[0], { day: "2-digit", month: "short" }, locale)} —{" "}
          {formatDate(
            days[days.length - 1],
            {
              day: "2-digit",
              month: "short",
              year: "numeric",
            },
            locale,
          )}
        </strong>
        <button
          className="icon-button mini"
          title={labels.next}
          aria-label={labels.next}
          onClick={() => moveCursor(1)}
        >
          <ChevronRight size={16} />
        </button>
        <button
          className="secondary-button timeline-today"
          onClick={() => setCursor(startOfWeek(new Date()))}
        >
          {labels.today}
        </button>
        <span className="timeline-drag-hint">
          <Move size={13} /> {readOnly ? labels.readOnlyDragHint : labels.dragHint}
        </span>
      </div>
      {mode === "calendar" ? (
        <div className="calendar-grid">
          {days.map((day) => (
            <div
              className={`calendar-day${dateKey(day) === dateKey(new Date()) ? " today" : ""}`}
              key={dateKey(day)}
              onDragOver={(event) => {
                if (draggedTaskId) event.preventDefault();
              }}
              onDrop={() => dropDeadline(day)}
            >
              <div className="calendar-day-heading">
                <span>{formatDate(day, { weekday: "short" }, locale)}</span>
                <b>{formatDate(day, { day: "2-digit" }, locale)}</b>
              </div>
              <div className="calendar-events">
                {visibleTasks.flatMap((task) =>
                  eventsForDay(task, day).map((milestone) => (
                    <button
                      className={`calendar-event milestone-${milestone.key}${milestone.key === "deadline" ? "" : " milestone-not-draggable"}`}
                      key={`${task.id}-${milestone.key}`}
                      draggable={milestone.key === "deadline" && !readOnly}
                      onDragStart={(event) => handleDragStart(task, event)}
                      onClick={() => onOpenTask(task)}
                      title={`${task.code || "TASK"} · ${milestone.label}${milestone.key === "deadline" ? "" : ` · ${labels.openDetails}`}`}
                      aria-label={`${task.code || "TASK"} ${milestone.label}${milestone.key === "deadline" ? "" : `, ${labels.openDetails}`}`}
                    >
                      <i />
                      <span>
                        <b>{task.code || "TASK"}</b>
                        <small>{milestone.short}</small>
                      </span>
                    </button>
                  )),
                )}
                {!visibleTasks.some((task) => eventsForDay(task, day).length) && (
                  <span className="calendar-empty">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="release-timeline"
          style={{ "--timeline-days": rangeLength } as React.CSSProperties}
        >
          <div className="release-timeline-header">
            <div className="release-task-heading">{labels.taskDependency}</div>
            {days.map((day) => (
              <div
                className={`release-day-heading${dateKey(day) === dateKey(new Date()) ? " today" : ""}`}
                key={dateKey(day)}
              >
                <span>{formatDate(day, { weekday: "short" }, locale)}</span>
                <b>{formatDate(day, { day: "2-digit" }, locale)}</b>
              </div>
            ))}
          </div>
          {visibleTasks.map((task) => {
            const dependencies = (task.blocked_by || [])
              .map((id) => tasks.find((item) => item.id === id))
              .filter((item): item is Task => Boolean(item));
            return (
              <div className="release-timeline-row" key={task.id}>
                <button className="release-task-name" onClick={() => onOpenTask(task)}>
                  <span>
                    <b>{task.code || "TASK"}</b> · {task.title}
                  </span>
                  <small>
                    {dependencies.length ? (
                      <>
                        <GitBranch size={11} /> {labels.dependency}:{" "}
                        {dependencies.map((item) => item.code || item.title).join(", ")}
                      </>
                    ) : (
                      <>
                        <span className={`status-dot status-dot-${task.status}`} />{" "}
                        {labels.noDependency}
                      </>
                    )}
                  </small>
                </button>
                {days.map((day) => (
                  <div
                    className={`release-day-cell${dateKey(day) === dateKey(new Date()) ? " today" : ""}`}
                    key={dateKey(day)}
                    onDragOver={(event) => {
                      if (draggedTaskId) event.preventDefault();
                    }}
                    onDrop={() => dropDeadline(day)}
                  >
                    {eventsForDay(task, day).map((milestone) => (
                      <button
                        className={`release-milestone milestone-${milestone.key}${milestone.key === "deadline" ? "" : " milestone-not-draggable"}`}
                        key={`${task.id}-${milestone.key}`}
                        draggable={milestone.key === "deadline" && !readOnly}
                        onDragStart={(event) => handleDragStart(task, event)}
                        onClick={() => onOpenTask(task)}
                        title={`${milestone.label}: ${task.title}${milestone.key === "deadline" ? "" : ` · ${labels.openDetails}`}`}
                        aria-label={`${milestone.label}: ${task.title}${milestone.key === "deadline" ? "" : `, ${labels.openDetails}`}`}
                      >
                        <i />
                        <span>{milestone.short}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
          {!visibleTasks.length && <div className="timeline-empty">{labels.empty}</div>}
        </div>
      )}
      <div className="timeline-legend" aria-label={labels.milestone}>
        {milestones.map((milestone) => (
          <span key={milestone.key}>
            <i className={`milestone-dot milestone-${milestone.key}`} />{" "}
            {milestone.label}
          </span>
        ))}
        <span className="timeline-result-count">{visibleTasks.length} task</span>
      </div>
    </section>
  );
}
