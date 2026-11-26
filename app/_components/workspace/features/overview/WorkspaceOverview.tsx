"use client";

import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  CheckCheck,
  ChevronDown,
  Clock3,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import type { Member, Status, Task } from "@/lib/types";
import type { UiCopy } from "@/lib/i18n";
import { isArchived } from "@/lib/taskboard/selectors";

const taskAssigneeIds = (task: Task) =>
  task.assignee_ids?.length
    ? task.assignee_ids
    : task.assignee_id
      ? [task.assignee_id]
      : [];

export function WorkspaceOverview({
  tasks,
  members,
  now,
  copy,
  dueText,
  onOpenTask,
  onBrowseTasks,
}: {
  tasks: Task[];
  members: Member[];
  now: Date;
  copy: UiCopy;
  dueText: (value: string, copy: UiCopy) => string;
  onOpenTask: (task: Task) => void;
  onBrowseTasks: () => void;
}) {
  const active = useMemo(
    () => tasks.filter((task) => task.status !== "done" && !isArchived(task)),
    [tasks],
  );
  const statusSummary = useMemo(
    () =>
      Object.entries(copy.status).map(([status, label]) => ({
        status: status as Status,
        label,
        count: tasks.filter((task) => task.status === status).length,
      })),
    [copy.status, tasks],
  );
  const creationActivity = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Array.from({ length: 14 }, (_, index) => {
      const day = new Date(today);
      day.setDate(day.getDate() - (13 - index));
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      return {
        key: day.toISOString(),
        label: new Intl.DateTimeFormat("vi-VN", { weekday: "short" })
          .format(day)
          .replace(".", ""),
        date: new Intl.DateTimeFormat("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        }).format(day),
        count: tasks.filter((task) => {
          const created = new Date(task.created_at).getTime();
          return created >= day.getTime() && created < next.getTime();
        }).length,
      };
    });
  }, [now, tasks]);
  const maxCreated = Math.max(...creationActivity.map((item) => item.count), 1);
  const attentionTasks = useMemo(
    () =>
      [...active]
        .sort(
          (a, b) =>
            ({ urgent: 0, high: 1, medium: 2, low: 3 })[a.priority] -
              { urgent: 0, high: 1, medium: 2, low: 3 }[b.priority] ||
            new Date(a.deadline || "9999-12-31").getTime() -
              new Date(b.deadline || "9999-12-31").getTime(),
        )
        .slice(0, 4),
    [active],
  );
  const workload = useMemo(
    () =>
      members
        .map((member) => {
          const assigned = active.filter((task) =>
            taskAssigneeIds(task).includes(member.id),
          );
          return {
            member,
            total: assigned.length,
            urgent: assigned.filter((task) => task.priority === "urgent").length,
            overdue: assigned.filter(
              (task) =>
                task.deadline && new Date(task.deadline).getTime() < now.getTime(),
            ).length,
          };
        })
        .filter((item) => item.total > 0)
        .sort((a, b) => b.total - a.total || b.overdue - a.overdue),
    [active, members, now],
  );
  const attentionCount = active.filter(
    (task) =>
      task.priority === "urgent" ||
      task.severity === "critical" ||
      taskAssigneeIds(task).length === 0 ||
      (task.deadline && new Date(task.deadline).getTime() < now.getTime()),
  ).length;
  const dueSoonCount = active.filter(
    (task) =>
      task.deadline && new Date(task.deadline).getTime() - now.getTime() < 4 * 86400000,
  ).length;

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">
            Đang thực hiện{" "}
            <span className="stat-icon blue-bg">
              <Activity size={17} />
            </span>
          </div>
          <strong>
            {active.filter((task) => task.status === "in_progress").length}
            <small> task</small>
          </strong>
          <span className="stat-foot">trên {tasks.length} công việc</span>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            Cần chú ý{" "}
            <span className="stat-icon orange-bg">
              <AlertTriangle size={17} />
            </span>
          </div>
          <strong>
            {attentionCount}
            <small> task</small>
          </strong>
          <span className="stat-foot">khẩn, quá hạn hoặc chưa giao</span>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            Sắp đến hạn{" "}
            <span className="stat-icon purple-bg">
              <Clock3 size={17} />
            </span>
          </div>
          <strong>
            {dueSoonCount}
            <small> task</small>
          </strong>
          <span className="stat-foot">trong 3 ngày tới hoặc quá hạn</span>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            Đã hoàn tất{" "}
            <span className="stat-icon green-bg">
              <CheckCheck size={17} />
            </span>
          </div>
          <strong>
            {tasks.filter((task) => task.status === "done").length}
            <small> task</small>
          </strong>
          <span className="stat-foot">hoàn thành tổng thể</span>
        </div>
      </div>
      <div className="overview-grid">
        <section className="panel status-chart">
          <div className="panel-heading">
            <div>
              <h2>Tiến độ công việc</h2>
              <p>Phân bổ task theo trạng thái</p>
            </div>
            <span className="round-icon">
              <Activity size={17} />
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
                      width: `${tasks.length ? Math.max((item.count / tasks.length) * 100, item.count ? 8 : 0) : 0}%`,
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
              <h2>Nhịp tạo task</h2>
              <p>Số task được tạo trong 14 ngày gần nhất</p>
            </div>
            <span className="round-icon">
              <Activity size={17} />
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
              <b>{creationActivity.reduce((sum, item) => sum + item.count, 0)}</b> task
              mới trong 14 ngày
            </span>
            <span>
              Ngày cao nhất:{" "}
              <b>{Math.max(...creationActivity.map((item) => item.count))}</b>
            </span>
          </div>
        </section>
        <section className="panel attention-panel">
          <div className="panel-heading">
            <div>
              <h2>Cần xử lý trước</h2>
              <p>Ưu tiên cao và task đang mở</p>
            </div>
            <button className="text-button" onClick={onBrowseTasks}>
              <ArrowDownUp size={15} /> Mở danh sách
            </button>
          </div>
          {attentionTasks.length ? (
            <div className="attention-list">
              {attentionTasks.map((task) => (
                <button
                  className="attention-row"
                  key={task.id}
                  onClick={() => onOpenTask(task)}
                >
                  <span className={`pill priority-${task.priority}`}>
                    {copy.priority[task.priority]}
                  </span>
                  <span>
                    <b>
                      {task.code || "TASK"} · {task.title}
                    </b>
                    <small>
                      {copy.status[task.status]} ·{" "}
                      {task.deadline ? dueText(task.deadline, copy) : copy.due.unset}
                    </small>
                  </span>
                  <ChevronDown size={15} />
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-small">Không có task cần xử lý.</div>
          )}
        </section>
        <section className="panel workload-panel">
          <div className="panel-heading">
            <div>
              <h2>Tải công việc</h2>
              <p>Task đang mở theo người phụ trách</p>
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
            <div className="empty-small">Chưa có task đang mở theo người.</div>
          )}
        </section>
      </div>
    </>
  );
}
