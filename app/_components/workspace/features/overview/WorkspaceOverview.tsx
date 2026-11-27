"use client";

import styles from "./WorkspaceOverview.module.css";
import { Button } from "@/app/_components/ui/Button";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CalendarCheck,
  CheckCheck,
  CirclePlay,
  Clock3,
  Eye,
  Flame,
  ListChecks,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import type { ReactNode } from "react";
import type { AppLocale, UiCopy } from "@/lib/i18n";
import { intlLocale } from "@/lib/i18n";
import type { Member, Status, Task } from "@/lib/types";
import {
  getActiveTasks,
  getDependencyState,
  isDueToday,
  isOverdue,
  isSnoozed,
} from "@/lib/taskboard/selectors";
import { getNextAction } from "@/lib/taskboard/next-action";

const priorityRank: Record<Task["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const taskAssigneeIds = (task: Task) =>
  task.assignee_ids?.length
    ? task.assignee_ids
    : task.assignee_id
      ? [task.assignee_id]
      : [];

function localizeNextAction(
  task: Task,
  key: ReturnType<typeof getNextAction>["key"],
  copy: UiCopy,
) {
  const action = copy.overview.action;
  const labels = {
    done: { label: action.complete, reason: copy.overview.done },
    snoozed: { label: action.continue, reason: copy.due.remaining(0) },
    resolve_dependency: {
      label: task.status === "blocked" ? action.unblock : action.resolveDependency,
      reason: action.blockedReason,
    },
    follow_dependency: {
      label: action.followDependency,
      reason: action.dependencyReason,
    },
    review: { label: action.review, reason: action.reviewReason },
    overdue: { label: action.continue, reason: action.overdueReason },
    start: { label: action.start, reason: action.todoReason },
    continue: {
      label: task.next_action?.trim() || action.continue,
      reason: action.inProgressReason,
    },
  } satisfies Record<string, { label: string; reason: string }>;
  return labels[key];
}

function ActionLane({
  title,
  description,
  icon,
  tone,
  tasks,
  copy,
  dueText,
  onOpenTask,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  tone: "review" | "blocked" | "overdue";
  tasks: Task[];
  copy: UiCopy;
  dueText: (value: string, copy: UiCopy) => string;
  onOpenTask: (task: Task) => void;
}) {
  return (
    <section className={`overview-action-lane ${tone}`}>
      <div className="overview-action-lane-heading">
        <span className="overview-action-icon">{icon}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <strong>{tasks.length}</strong>
      </div>
      {tasks.length ? (
        <div className="overview-action-list">
          {tasks.slice(0, 3).map((task) => (
            <Button
              className="overview-action-row"
              key={task.id}
              onClick={() => onOpenTask(task)}
              type="button"
            >
              <span>
                <b>{task.code || "TASK"}</b>
                <small>{task.title}</small>
              </span>
              <em>{task.deadline ? dueText(task.deadline, copy) : "—"}</em>
              <ArrowRight size={15} />
            </Button>
          ))}
        </div>
      ) : (
        <div className="overview-action-empty">{copy.overview.emptyLane}</div>
      )}
    </section>
  );
}

export function WorkspaceOverview({
  tasks,
  members,
  now,
  locale,
  copy,
  dueText,
  onOpenTask,
  onQuickUpdate,
  onBrowseTasks,
}: {
  tasks: Task[];
  members: Member[];
  now: Date;
  locale: AppLocale;
  copy: UiCopy;
  dueText: (value: string, copy: UiCopy) => string;
  onOpenTask: (task: Task) => void;
  onQuickUpdate: (task: Task) => void;
  onBrowseTasks: () => void;
}) {
  const active = useMemo(() => getActiveTasks(tasks), [tasks]);
  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const openTasks = useMemo(
    () => active.filter((task) => task.status !== "done"),
    [active],
  );
  const todayTasks = useMemo(
    () =>
      active.filter(
        (task) =>
          !isSnoozed(task, now) &&
          task.status !== "done" &&
          (isDueToday(task, now) || isOverdue(task, now) || task.priority === "urgent"),
      ),
    [active, now],
  );
  const actionableTasks = useMemo(
    () => active.filter((task) => task.status !== "done" && !isSnoozed(task, now)),
    [active, now],
  );
  const reviewTasks = useMemo(
    () => actionableTasks.filter((task) => task.status === "review"),
    [actionableTasks],
  );
  const blockedTasks = useMemo(
    () =>
      actionableTasks.filter(
        (task) =>
          task.status !== "done" &&
          (task.status === "blocked" ||
            getDependencyState(task, taskMap) === "blocked"),
      ),
    [actionableTasks, taskMap],
  );
  const overdueTasks = useMemo(
    () => actionableTasks.filter((task) => isOverdue(task, now)),
    [actionableTasks, now],
  );
  const nextTask = useMemo(() => {
    const candidates = actionableTasks;
    return [...candidates].sort((a, b) => {
      const aDependency = getDependencyState(a, taskMap);
      const bDependency = getDependencyState(b, taskMap);
      const aBlocked = a.status === "blocked" || aDependency === "blocked";
      const bBlocked = b.status === "blocked" || bDependency === "blocked";
      return (
        Number(aBlocked) - Number(bBlocked) ||
        Number(b.status === "review") - Number(a.status === "review") ||
        Number(isOverdue(b, now)) - Number(isOverdue(a, now)) ||
        priorityRank[a.priority] - priorityRank[b.priority] ||
        getNextAction(b, tasks, now).score - getNextAction(a, tasks, now).score ||
        new Date(a.deadline || "9999-12-31").getTime() -
          new Date(b.deadline || "9999-12-31").getTime()
      );
    })[0];
  }, [actionableTasks, now, taskMap, tasks]);
  const statusSummary = useMemo(
    () =>
      Object.entries(copy.status).map(([status, label]) => ({
        status: status as Status,
        label,
        count: active.filter((task) => task.status === status).length,
      })),
    [active, copy.status],
  );
  const creationActivity = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const formatter = new Intl.DateTimeFormat(intlLocale[locale], {
      weekday: "short",
    });
    const dateFormatter = new Intl.DateTimeFormat(intlLocale[locale], {
      day: "2-digit",
      month: "2-digit",
    });
    return Array.from({ length: 14 }, (_, index) => {
      const day = new Date(today);
      day.setDate(day.getDate() - (13 - index));
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      return {
        key: day.toISOString(),
        label: formatter.format(day).replace(".", ""),
        date: dateFormatter.format(day),
        count: tasks.filter((task) => {
          const created = new Date(task.created_at).getTime();
          return created >= day.getTime() && created < next.getTime();
        }).length,
      };
    });
  }, [locale, now, tasks]);
  const maxCreated = Math.max(...creationActivity.map((item) => item.count), 1);
  const workload = useMemo(
    () =>
      members
        .map((member) => {
          const assigned = openTasks.filter((task) =>
            taskAssigneeIds(task).includes(member.id),
          );
          return {
            member,
            total: assigned.length,
            urgent: assigned.filter((task) => task.priority === "urgent").length,
            overdue: assigned.filter((task) => isOverdue(task, now)).length,
          };
        })
        .filter((item) => item.total > 0)
        .sort((a, b) => b.total - a.total || b.overdue - a.overdue),
    [members, now, openTasks],
  );
  const nextAction = nextTask ? getNextAction(nextTask, tasks, now) : null;
  const nextActionCopy =
    nextTask && nextAction ? localizeNextAction(nextTask, nextAction.key, copy) : null;
  const visibleTasks = active;
  const completedCount = visibleTasks.filter((task) => task.status === "done").length;
  const progress = visibleTasks.length
    ? Math.round((completedCount / visibleTasks.length) * 100)
    : 0;

  return (
    <div className={styles.overviewScope}>
      <section className="overview-next-action panel">
        <div className="overview-next-action-copy">
          <span className="eyebrow">
            <Flame size={14} /> {copy.overview.nextAction}
          </span>
          {nextTask && nextAction && nextActionCopy ? (
            <>
              <h2>{nextTask.title}</h2>
              <p>
                <b>{nextTask.code || "TASK"}</b> · {nextActionCopy.reason}
              </p>
              <div className="overview-next-action-meta">
                <span className={`pill priority-${nextTask.priority}`}>
                  {copy.priority[nextTask.priority]}
                </span>
                <span className={`status status-${nextTask.status}`}>
                  <i /> {copy.status[nextTask.status]}
                </span>
                {nextTask.deadline && (
                  <span className="overview-deadline">
                    <Clock3 size={14} /> {dueText(nextTask.deadline, copy)}
                  </span>
                )}
              </div>
              <div className="overview-next-action-buttons">
                <Button
                  variant="primary"
                  onClick={() => onQuickUpdate(nextTask)}
                  type="button"
                >
                  <CirclePlay size={16} /> {nextActionCopy.label}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onOpenTask(nextTask)}
                  type="button"
                >
                  Xem chi tiết <ArrowRight size={15} />
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2>{copy.overview.noWorkTitle}</h2>
              <p>{copy.overview.noWorkDescription}</p>
              <Button variant="secondary" onClick={onBrowseTasks} type="button">
                <ListChecks size={16} /> {copy.overview.browseTasks}
              </Button>
            </>
          )}
        </div>
        <div className="overview-next-action-score">
          <span>{copy.overview.progress}</span>
          <strong>{progress}%</strong>
          <div className="progress-track">
            <i style={{ width: `${progress}%` }} />
          </div>
          <small>
            {completedCount} / {visibleTasks.length} task
          </small>
        </div>
      </section>

      <div className="overview-stats-grid">
        <div className="stat-card">
          <div className="stat-label">
            {copy.overview.today}{" "}
            <span className="stat-icon blue-bg">
              <CalendarCheck size={17} />
            </span>
          </div>
          <strong>
            {todayTasks.length}
            <small> task</small>
          </strong>
          <span className="stat-foot">{copy.overview.todayFoot}</span>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            {copy.overview.review}{" "}
            <span className="stat-icon purple-bg">
              <Eye size={17} />
            </span>
          </div>
          <strong>
            {reviewTasks.length}
            <small> task</small>
          </strong>
          <span className="stat-foot">{copy.overview.reviewFoot}</span>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            {copy.overview.blocked}{" "}
            <span className="stat-icon orange-bg">
              <Ban size={17} />
            </span>
          </div>
          <strong>
            {blockedTasks.length}
            <small> task</small>
          </strong>
          <span className="stat-foot">{copy.overview.blockedFoot}</span>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            {copy.overview.done}{" "}
            <span className="stat-icon green-bg">
              <CheckCheck size={17} />
            </span>
          </div>
          <strong>
            {completedCount}
            <small> task</small>
          </strong>
          <span className="stat-foot">
            {copy.overview.doneFoot(completedCount, visibleTasks.length)}
          </span>
        </div>
      </div>

      <div className="overview-action-grid">
        <ActionLane
          title={copy.overview.reviewLane}
          description={copy.overview.reviewLaneDescription}
          icon={<Eye size={17} />}
          tone="review"
          tasks={reviewTasks}
          copy={copy}
          dueText={dueText}
          onOpenTask={onOpenTask}
        />
        <ActionLane
          title={copy.overview.blockedLane}
          description={copy.overview.blockedLaneDescription}
          icon={<Ban size={17} />}
          tone="blocked"
          tasks={blockedTasks}
          copy={copy}
          dueText={dueText}
          onOpenTask={onOpenTask}
        />
        <ActionLane
          title={copy.overview.overdueLane}
          description={copy.overview.overdueLaneDescription}
          icon={<AlertTriangle size={17} />}
          tone="overdue"
          tasks={overdueTasks}
          copy={copy}
          dueText={dueText}
          onOpenTask={onOpenTask}
        />
      </div>

      <div className="overview-grid overview-secondary-grid">
        <section className="panel status-chart">
          <div className="panel-heading">
            <div>
              <h2>{copy.overview.flowTitle}</h2>
              <p>{copy.overview.flowDescription}</p>
            </div>
            <span className="round-icon">
              <ListChecks size={17} />
            </span>
          </div>
          <div className="chart-bars">
            {statusSummary.map((item) => (
              <div className="chart-row" key={item.status}>
                <div className="chart-label">
                  <span className={`status status-${item.status}`}>
                    <i />
                    {item.label}
                  </span>
                  <b>{item.count}</b>
                </div>
                <div className="chart-track">
                  <span
                    className={`chart-fill fill-${item.status}`}
                    style={{
                      width: `${active.length ? Math.max((item.count / active.length) * 100, item.count ? 8 : 0) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel creation-chart">
          <div className="panel-heading">
            <div>
              <h2>{copy.overview.activityTitle}</h2>
              <p>{copy.overview.activityDescription}</p>
            </div>
            <span className="round-icon">
              <Clock3 size={17} />
            </span>
          </div>
          <div className="creation-chart-grid">
            {creationActivity.map((item) => (
              <div
                className="creation-bar-wrap"
                key={item.key}
                title={`${item.date} : ${item.count} task`}
              >
                <span
                  className="creation-bar"
                  style={{
                    height: `${Math.max((item.count / maxCreated) * 100, item.count ? 8 : 2)}%`,
                  }}
                />
                <small>{item.label}</small>
                <em>{item.count || ""}</em>
              </div>
            ))}
          </div>
          <div className="creation-chart-foot">
            <span>
              {copy.overview.activityTotal(
                creationActivity.reduce((sum, item) => sum + item.count, 0),
              )}
            </span>
            <span>
              {copy.overview.peakDay(
                Math.max(...creationActivity.map((item) => item.count)),
              )}
            </span>
          </div>
        </section>
        <section className="panel workload-panel">
          <div className="panel-heading">
            <div>
              <h2>{copy.overview.teamTitle}</h2>
              <p>{copy.overview.teamDescription}</p>
            </div>
            <span className="round-icon">
              <Users size={17} />
            </span>
          </div>
          {workload.length ? (
            <div className="workload-list">
              {workload.map(({ member, total, urgent, overdue }) => (
                <div className="workload-row" key={member.id}>
                  <span className={`avatar avatar-${member.color}`}>
                    {member.name.slice(0, 1)}
                  </span>
                  <span className="workload-name">
                    <b>{member.name}</b>
                    <small>{member.role}</small>
                  </span>
                  <span className="workload-count">{total}</span>
                  {(urgent > 0 || overdue > 0) && (
                    <small className="workload-risk">
                      {urgent ? `${urgent} khẩn` : `${overdue} quá hạn`}
                    </small>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-small">{copy.overview.noOpenByMember}</div>
          )}
        </section>
      </div>
    </div>
  );
}
