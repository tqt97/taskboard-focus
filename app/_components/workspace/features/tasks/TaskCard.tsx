"use client";

import { Button } from "@/app/_components/ui/Button";
import {
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  Copy,
  ArrowDown,
  ArrowUp,
  MoreHorizontal,
  Pencil,
  Play,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import { useState } from "react";
import type { AppLocale, UiCopy } from "@/lib/i18n";
import { intlLocale } from "@/lib/i18n";
import type { Member, Task } from "@/lib/types";
import { isSnoozed } from "@/lib/taskboard/selectors";
import { getPrimaryStatusAction } from "@/lib/taskboard/status-transitions";
import styles from "./TaskCard.module.css";

export function TaskCard({
  task,
  members,
  locale,
  copy,
  now,
  selectionMode,
  canEdit,
  selected,
  dueText,
  dueState,
  onToggleSelection,
  onOpen,
  onCopyCode,
  onQuickUpdate,
  onUpdateTitle,
  onDragStart,
  onDragEnd,
  onDrop,
  onKeyboardMove,
}: {
  task: Task;
  members: Member[];
  locale: AppLocale;
  copy: UiCopy;
  now: Date;
  selectionMode: boolean;
  canEdit: boolean;
  selected: boolean;
  dueText: (value: string, copy: UiCopy) => string;
  dueState: (value: string) => string;
  onToggleSelection: (taskId: string) => void;
  onOpen: (task: Task) => void;
  onCopyCode: (code: string) => void;
  onQuickUpdate: (task: Task) => void;
  onUpdateTitle: (task: Task, title: string) => void;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onDrop: (task: Task) => void;
  onKeyboardMove: (task: Task, direction: "up" | "down") => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const assignees = (
    task.assignee_ids?.length
      ? task.assignee_ids
      : task.assignee_id
        ? [task.assignee_id]
        : []
  )
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is Member => Boolean(member));
  const primaryAction = getPrimaryStatusAction(task);

  return (
    <article
      className={`task-card task-status-${task.status}`}
      draggable
      onDragStart={() => onDragStart(task.id)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.stopPropagation();
        onDrop(task);
      }}
    >
      <div className="task-top">
        {selectionMode && (
          <input
            className="task-select"
            type="checkbox"
            checked={selected}
            aria-label={`Chọn task ${task.code || "TASK"}`}
            onClick={(event) => event.stopPropagation()}
            onChange={() => onToggleSelection(task.id)}
          />
        )}
        <Button
          className="task-code-copy"
          type="button"
          title={`Copy mã ${task.code || "TASK"}`}
          aria-label={`Copy mã ${task.code || "TASK"}`}
          onClick={(event) => {
            event.stopPropagation();
            onCopyCode(task.code || "TASK");
          }}
        >
          <span className="task-code">{task.code || "TASK"}</span>
          <Copy size={12} aria-hidden="true" />
        </Button>
        {(task.priority === "urgent" || task.priority === "high") && (
          <span
            className={`priority-badge priority-badge-${task.priority}`}
            title={`Mức ưu tiên ${copy.priority[task.priority]}`}
          >
            {task.priority === "urgent" ? "KHẨN" : "CAO"}
          </span>
        )}
        <Button
          variant="icon"
          className="mini"
          aria-label={`Mở menu task ${task.code || "TASK"}`}
          title={`Mở menu task ${task.code || "TASK"}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpen(task);
          }}
        >
          <MoreHorizontal size={17} />
        </Button>
      </div>
      {editingTitle ? (
        <form
          className="task-inline-title-form"
          onSubmit={(event) => {
            event.preventDefault();
            onUpdateTitle(task, draftTitle);
            setEditingTitle(false);
          }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <input
            autoFocus
            maxLength={500}
            aria-label={`Sửa tiêu đề ${task.code || "TASK"}`}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setEditingTitle(false);
                setDraftTitle(task.title);
              }
            }}
          />
          <Button
            type="submit"
            variant="icon"
            className="mini"
            aria-label="Lưu tiêu đề"
          >
            <Save size={14} />
          </Button>
          <Button
            type="button"
            variant="icon"
            className="mini"
            aria-label="Hủy sửa tiêu đề"
            onClick={() => {
              setEditingTitle(false);
              setDraftTitle(task.title);
            }}
          >
            <X size={14} />
          </Button>
        </form>
      ) : (
        <div className="task-title-row">
          <button
            className={styles.open}
            type="button"
            aria-label={`Mở task ${task.code || "TASK"}: ${task.title}`}
            onClick={() => (selectionMode ? onToggleSelection(task.id) : onOpen(task))}
          >
            <h3>{task.title}</h3>
          </button>
          {canEdit && !selectionMode && (
            <Button
              type="button"
              variant="icon"
              className="mini task-inline-edit"
              aria-label={`Sửa nhanh ${task.code || "TASK"}`}
              title="Sửa tiêu đề nhanh"
              onClick={(event) => {
                event.stopPropagation();
                setDraftTitle(task.title);
                setEditingTitle(true);
              }}
            >
              <Pencil size={13} />
            </Button>
          )}
        </div>
      )}
      {task.next_action && <p className="task-next-action">→ {task.next_action}</p>}
      {task.checklist?.length ? (
        <p className="task-checklist-progress">
          <CheckCheck size={12} /> {task.checklist.filter((item) => item.done).length}/
          {task.checklist.length} bước hoàn tất
        </p>
      ) : null}
      {task.blocked_by?.length ? (
        <p className="task-dependency">Phụ thuộc {task.blocked_by.length} task</p>
      ) : null}
      {isSnoozed(task, now) && task.snoozed_until ? (
        <p className="task-snooze-info">
          Hoãn đến{" "}
          {new Intl.DateTimeFormat(intlLocale[locale], {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(task.snoozed_until))}
        </p>
      ) : null}
      {!selectionMode && (
        <div className="task-card-actions" onClick={(event) => event.stopPropagation()}>
          <Button
            type="button"
            className={`task-quick-action${task.status === "review" ? " success" : ""}`}
            title={primaryAction.title}
            aria-label={primaryAction.title}
            onClick={() => onQuickUpdate(task)}
          >
            {task.status === "blocked" ? (
              <RotateCcw size={13} />
            ) : task.status === "review" ? (
              <CheckCircle2 size={13} />
            ) : (
              <Play size={13} />
            )}
            {primaryAction.label}
          </Button>
          {canEdit && (
            <>
              <Button
                type="button"
                variant="icon"
                className="mini"
                aria-label={`Đưa task ${task.code || "TASK"} lên`}
                title="Đưa task lên"
                onClick={() => onKeyboardMove(task, "up")}
              >
                <ArrowUp size={13} aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="icon"
                className="mini"
                aria-label={`Đưa task ${task.code || "TASK"} xuống`}
                title="Đưa task xuống"
                onClick={() => onKeyboardMove(task, "down")}
              >
                <ArrowDown size={13} aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
      )}
      <div className="task-meta">
        <span className="assignee" title="Người phụ trách">
          {assignees.length ? (
            <>
              <span className="assignee-avatars" aria-hidden="true">
                {assignees.slice(0, 3).map((member) => (
                  <span
                    className={`avatar avatar-${member.color}`}
                    key={member.id}
                    title={member.name}
                  >
                    {member.name.slice(0, 1)}
                  </span>
                ))}
              </span>
              <span>
                {assignees
                  .slice(0, 2)
                  .map((member) => member.name)
                  .join(", ")}
                {assignees.length > 2 ? ` +${assignees.length - 2}` : ""}
              </span>
            </>
          ) : (
            <>
              <span className="avatar avatar-blue">?</span>
              <span>Chưa giao</span>
            </>
          )}
        </span>
        <span className={`due ${dueState(task.deadline)}`}>
          <CalendarDays size={13} />
          {task.deadline ? dueText(task.deadline, copy) : copy.due.unset}
        </span>
      </div>
    </article>
  );
}
