"use client";
import { useState } from "react";
import { Link2, Plus, Trash2, X } from "lucide-react";
import type { Member, Task, TaskLink, Status, Priority, Severity } from "@/lib/types";

const labels: Record<Status, string> = {
  todo: "Chưa làm",
  in_progress: "Đang làm",
  blocked: "Đang review",
  done: "Hoàn tất",
};
const priorityLabels: Record<Priority, string> = {
  urgent: "Khẩn cấp",
  high: "Cao",
  medium: "Vừa",
  low: "Thấp",
};
const severityLabels: Record<Severity, string> = {
  critical: "Nghiêm trọng",
  high: "Cao",
  medium: "Vừa",
  low: "Thấp",
};
const dateOnly = (s: string) => (s ? new Date(s).toISOString().slice(0, 10) : "");
const stamp = (s: string) => (s ? new Date(s).toISOString() : "");
const legacyLinks = (task: Task): TaskLink[] =>
  task.primary_links?.length
    ? task.primary_links
    : (task.links || []).map((url, i) => ({
        label: i === 0 ? "Tài liệu" : "Link",
        url,
      }));

export function TaskModal({
  task,
  tasks,
  prefix,
  members,
  isNew,
  onClose,
  onSave,
  onDelete,
  onPrefixChange,
}: {
  task: Task;
  tasks: Task[];
  prefix: string;
  members: Member[];
  isNew: boolean;
  onClose: () => void;
  onSave: (t: Task) => void;
  onDelete: () => void;
  onPrefixChange: (prefix: string) => void;
}) {
  const [form, setForm] = useState<Task>(task),
    [usePrefix, setUsePrefix] = useState(task.custom_code !== true),
    [localPrefix, setLocalPrefix] = useState(prefix),
    [primary, setPrimary] = useState<TaskLink[]>(legacyLinks(task)),
    [secondary, setSecondary] = useState<TaskLink[]>(task.secondary_links || []),
    [assigneeIds, setAssigneeIds] = useState<string[]>(
      task.assignee_ids?.length
        ? task.assignee_ids
        : task.assignee_id
          ? [task.assignee_id]
          : [],
    ),
    [error, setError] = useState("");
  const field = <K extends keyof Task>(key: K, value: Task[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setLinks = (
    kind: "primary" | "secondary",
    index: number,
    key: keyof TaskLink,
    value: string,
  ) => {
    const setter = kind === "primary" ? setPrimary : setSecondary;
    setter((list) =>
      list.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  };
  const addLink = (kind: "primary" | "secondary") =>
    (kind === "primary" ? setPrimary : setSecondary)((list) => [
      ...list,
      { label: kind === "primary" ? "Redmine" : "Tài liệu", url: "" },
    ]);
  const removeLink = (kind: "primary" | "secondary", index: number) =>
    (kind === "primary" ? setPrimary : setSecondary)((list) =>
      list.filter((_, i) => i !== index),
    );
  const save = () => {
    const links = [...primary, ...secondary].filter((link) => link.url.trim());
    const title = form.title.trim();
    const description = form.description.trim();
    const nextAction = form.next_action?.trim() || "";
    const reviewNote = form.review_note?.trim() || "";
    const normalizedPrefix = localPrefix.trim();
    if (!title) {
      setError("Vui lòng nhập tên task.");
      return;
    }
    if (title.length > 500) {
      setError("Tên task không được vượt quá 500 ký tự.");
      return;
    }
    if (description.length > 10000) {
      setError("Mô tả không được vượt quá 10.000 ký tự.");
      return;
    }
    if (nextAction.length > 1000) {
      setError("Bước tiếp theo không được vượt quá 1.000 ký tự.");
      return;
    }
    if (reviewNote.length > 2000) {
      setError("Ghi chú review không được vượt quá 2.000 ký tự.");
      return;
    }
    if (usePrefix && !normalizedPrefix) {
      setError("Vui lòng nhập prefix hoặc bỏ chọn Dùng prefix.");
      return;
    }
    if (usePrefix && normalizedPrefix.length > 100) {
      setError("Prefix không được vượt quá 100 ký tự.");
      return;
    }
    if (form.code.trim().length > 100) {
      setError("Mã task không được vượt quá 100 ký tự.");
      return;
    }
    const dependencies = form.blocked_by || [];
    const dependencyGraph = new Map(
      tasks.map((candidate) => [candidate.id, candidate.blocked_by || []]),
    );
    dependencyGraph.set(form.id, dependencies);
    const reachesCurrent = (id: string, visited = new Set<string>()): boolean => {
      if (id === form.id) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      return (dependencyGraph.get(id) || []).some((dependency) =>
        reachesCurrent(dependency, visited),
      );
    };
    if (dependencies.some((dependency) => reachesCurrent(dependency))) {
      setError("Không thể tạo vòng lặp giữa các task phụ thuộc nhau.");
      return;
    }
    if (links.some((link) => link.label.trim().length > 120)) {
      setError("Tên link không được vượt quá 120 ký tự.");
      return;
    }
    if (links.some((link) => link.url.trim().length > 2048)) {
      setError("URL không được vượt quá 2.048 ký tự.");
      return;
    }
    if (links.some((link) => !/^https?:\/\//i.test(link.url.trim()))) {
      setError("Link phải bắt đầu bằng http:// hoặc https://.");
      return;
    }
    setError("");
    if (usePrefix) onPrefixChange(normalizedPrefix);
    const codeSuffix = form.code.replace(prefix, "").trim();
    const finalCode = usePrefix ? `${normalizedPrefix}${codeSuffix}` : form.code.trim();
    const normalizeLinks = (items: TaskLink[]) =>
      items
        .filter((link) => link.url.trim())
        .map((link) => ({ label: link.label.trim(), url: link.url.trim() }));
    onSave({
      ...form,
      title,
      description,
      next_action: nextAction,
      review_note: reviewNote,
      code: finalCode,
      custom_code: !usePrefix,
      primary_links: normalizeLinks(primary),
      secondary_links: normalizeLinks(secondary),
      assignee_ids: assigneeIds,
      assignee_id: assigneeIds[0] || "",
      links: [],
    });
  };
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="modal task-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">
              {isNew ? "TẠO CÔNG VIỆC" : "CHI TIẾT CÔNG VIỆC"}
            </span>
            <h2 id="task-modal-title">{isNew ? "Thêm task mới" : "Thông tin task"}</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        <div className="modal-body">
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="form-grid">
            <label className="field full">
              <span>
                Tên task <b>*</b>
              </span>
              <input
                autoFocus
                value={form.title}
                aria-invalid={Boolean(error && !form.title.trim())}
                onChange={(e) => field("title", e.target.value)}
                placeholder="Ví dụ: Hoàn thiện luồng thanh toán"
              />
            </label>
            <div className="field full">
              <span>
                Mã task <small>Prefix mặc định có thể đổi trong từng workspace</small>
              </span>
              <div className="code-builder">
                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={usePrefix}
                    onChange={(e) => {
                      setUsePrefix(e.target.checked);
                      if (e.target.checked && !form.code) field("code", localPrefix);
                    }}
                  />{" "}
                  Dùng prefix
                </label>
                {usePrefix ? (
                  <>
                    <input
                      className="prefix-input"
                      value={localPrefix}
                      onChange={(e) => {
                        setLocalPrefix(e.target.value);
                      }}
                      placeholder="MENSQZIN-"
                    />
                    <input
                      value={form.code.replace(prefix, "").replace(localPrefix, "")}
                      onChange={(e) => field("code", e.target.value)}
                      placeholder="248"
                    />
                  </>
                ) : (
                  <input
                    value={form.code}
                    onChange={(e) => field("code", e.target.value)}
                    placeholder="Mã tự custom"
                  />
                )}
              </div>
            </div>
            <div className="field full assignee-field">
              <span>
                Người phụ trách{" "}
                <small>
                  {assigneeIds.length
                    ? `${assigneeIds.length} người đã chọn`
                    : "Chưa giao"}
                </small>
              </span>
              <div className="assignee-picker">
                {members
                  .filter((m) => m.active)
                  .map((member) => {
                    const checked = assigneeIds.includes(member.id);
                    return (
                      <label
                        className={`assignee-option${checked ? " selected" : ""}`}
                        key={member.id}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setAssigneeIds((ids) =>
                              checked
                                ? ids.filter((id) => id !== member.id)
                                : [...ids, member.id],
                            )
                          }
                        />
                        <span className={`avatar avatar-${member.color}`}>
                          {member.name.slice(0, 1)}
                        </span>
                        <span>
                          <b>{member.name}</b>
                          <small>{member.role}</small>
                        </span>
                      </label>
                    );
                  })}
                {!members.some((member) => member.active) && (
                  <small>Chưa có thành viên active</small>
                )}
              </div>
            </div>
            <div className="field-row field-row-3 full">
              <label className="field">
                <span>Trạng thái</span>
                <select
                  value={form.status}
                  onChange={(e) => field("status", e.target.value as Status)}
                >
                  {Object.entries(labels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Thứ tự ưu tiên</span>
                <select
                  value={form.priority}
                  onChange={(e) => field("priority", e.target.value as Priority)}
                >
                  {Object.entries(priorityLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Độ nghiêm trọng</span>
                <select
                  value={form.severity}
                  onChange={(e) => field("severity", e.target.value as Severity)}
                >
                  {Object.entries(severityLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field-row field-row-3 full">
              {(
                [
                  ["dev_up", "Dev up"],
                  ["staging_up", "Staging up"],
                  ["release_at", "Release"],
                ] as const
              ).map(([key, label]) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <input
                    type="date"
                    value={dateOnly(form[key])}
                    onChange={(e) => field(key, stamp(e.target.value))}
                  />
                </label>
              ))}
            </div>
            <label className="field">
              <span>Deadline</span>
              <input
                type="date"
                value={dateOnly(form.deadline)}
                onChange={(e) => field("deadline", stamp(e.target.value))}
              />
            </label>
            <label className="field full">
              <span>Mô tả / ghi chú</span>
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => field("description", e.target.value)}
                placeholder="Bối cảnh, yêu cầu, lưu ý..."
              />
            </label>
            <label className="field full">
              <span>Bước tiếp theo</span>
              <input
                value={form.next_action || ""}
                onChange={(e) => field("next_action", e.target.value)}
                placeholder="Ví dụ: Chờ QA xác nhận luồng thanh toán"
              />
            </label>
            <label className="field full">
              <span>Ghi chú review / vướng mắc</span>
              <textarea
                rows={3}
                value={form.review_note || ""}
                onChange={(e) => field("review_note", e.target.value)}
                placeholder="Điều cần kiểm tra, phản hồi hoặc lý do đang review..."
              />
            </label>
            <label className="field full">
              <span>Phụ thuộc task khác</span>
              <select
                multiple
                value={form.blocked_by || []}
                onChange={(e) =>
                  field(
                    "blocked_by",
                    Array.from(e.target.selectedOptions, (option) => option.value),
                  )
                }
              >
                {tasks
                  .filter((candidate) => candidate.id !== form.id)
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.code || "TASK"} · {candidate.title}
                    </option>
                  ))}
              </select>
            </label>
            {form.activity?.length ? (
              <div className="task-activity full">
                <div className="link-section-heading">
                  <span>
                    <b>Lịch sử thay đổi</b>
                    <small>Những cập nhật gần nhất của task</small>
                  </span>
                </div>
                <div className="task-activity-list">
                  {form.activity
                    .slice(-5)
                    .reverse()
                    .map((item) => (
                      <div className="task-activity-row" key={item.id}>
                        <span>{item.summary}</span>
                        <small>
                          {new Intl.DateTimeFormat("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(item.at))}
                        </small>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}
            <div className="link-section full">
              <div className="link-section-heading">
                <span>
                  <b>Link chính</b>
                  <small>Những link cần mở mỗi lần xử lý task</small>
                </span>
                <button className="secondary-button" onClick={() => addLink("primary")}>
                  <Plus size={14} /> Thêm link chính
                </button>
              </div>
              {primary.map((link, i) => (
                <div className="link-row" key={`p-${i}`}>
                  <Link2 size={15} />
                  <input
                    value={link.label}
                    onChange={(e) => setLinks("primary", i, "label", e.target.value)}
                    placeholder="Redmine / Spec / Design"
                  />
                  <input
                    value={link.url}
                    onChange={(e) => setLinks("primary", i, "url", e.target.value)}
                    placeholder="https://..."
                  />
                  <button
                    className="icon-button mini"
                    onClick={() => removeLink("primary", i)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="link-section full">
              <div className="link-section-heading">
                <span>
                  <b>Link phụ</b>
                  <small>Tài liệu tham khảo, log, PR hoặc link liên quan</small>
                </span>
                <button
                  className="secondary-button"
                  onClick={() => addLink("secondary")}
                >
                  <Plus size={14} /> Thêm link phụ
                </button>
              </div>
              {secondary.map((link, i) => (
                <div className="link-row" key={`s-${i}`}>
                  <Link2 size={15} />
                  <input
                    value={link.label}
                    onChange={(e) => setLinks("secondary", i, "label", e.target.value)}
                    placeholder="Tên link"
                  />
                  <input
                    value={link.url}
                    onChange={(e) => setLinks("secondary", i, "url", e.target.value)}
                    placeholder="https://..."
                  />
                  <button
                    className="icon-button mini"
                    onClick={() => removeLink("secondary", i)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <footer className="modal-footer">
          {!isNew && (
            <button className="danger-button ghost" onClick={onDelete}>
              <Trash2 size={15} /> Xóa task
            </button>
          )}
          <span />
          <button className="secondary-button" onClick={onClose}>
            Hủy
          </button>
          <button
            className="primary-button"
            disabled={!form.title.trim()}
            onClick={save}
          >
            Lưu task
          </button>
        </footer>
      </section>
    </div>
  );
}
