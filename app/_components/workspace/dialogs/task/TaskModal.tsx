"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  ListChecks,
  MessageCircle,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type {
  Member,
  Task,
  TaskAttachment,
  TaskLink,
  TaskChecklistItem,
  TaskComment,
  Status,
  Priority,
  Severity,
} from "@/lib/types";
import {
  fromDateInputValue,
  fromDateTimeLocalValue,
  toDateInputValue,
  toDateTimeLocalValue,
} from "@/lib/taskboard/dates";
import type { AppLocale } from "@/lib/i18n";
import { TaskHistoryPanel } from "./TaskHistoryPanel";
import { TaskCommentsPanel } from "./TaskCommentsPanel";

const labels: Record<Status, string> = {
  todo: "Chưa làm",
  in_progress: "Đang làm",
  review: "Chờ review",
  blocked: "Bị chặn",
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
const linkPurposes = ["", "Redmine", "Tài liệu", "Spec", "Design", "PR", "Log"];
const isSafeHttpUrl = (value: string) => /^https?:\/\//i.test(value.trim());
const legacyLinks = (task: Task): TaskLink[] => {
  const structured = [...(task.primary_links || []), ...(task.secondary_links || [])];
  return structured.length
    ? structured
    : (task.links || []).map((url, i) => ({
        label: i === 0 ? "Tài liệu" : "Link",
        url,
      }));
};

export function TaskModal({
  task,
  tasks,
  prefix,
  members,
  isNew,
  onClose,
  onSave,
  onDelete,
  onRestore,
  onSaveTemplate,
  onUploadAttachment,
  onResolveAttachmentUrl,
  onDiscardAttachments,
  onPrefixChange,
  locale,
  commentAuthorId,
  onAddComment,
  onToggleCommentPin,
  readOnly = false,
}: {
  task: Task;
  tasks: Task[];
  prefix: string;
  members: Member[];
  isNew: boolean;
  onClose: () => void;
  onSave: (t: Task) => void;
  onDelete: () => void;
  onRestore: () => void;
  onSaveTemplate: () => void;
  onUploadAttachment: (file: File) => Promise<TaskAttachment | null>;
  onResolveAttachmentUrl: (storagePath: string) => Promise<string | null>;
  onDiscardAttachments?: (storagePaths: string[]) => void;
  onPrefixChange: (prefix: string) => void;
  locale: AppLocale;
  commentAuthorId?: string;
  onAddComment?: (taskId: string, comment: TaskComment) => void;
  onToggleCommentPin?: (taskId: string, commentId: string) => void;
  readOnly?: boolean;
}) {
  const [form, setForm] = useState<Task>(task),
    [usePrefix, setUsePrefix] = useState(task.custom_code !== true),
    [localPrefix, setLocalPrefix] = useState(prefix),
    [links, setLinks] = useState<TaskLink[]>(legacyLinks(task)),
    [attachments, setAttachments] = useState<TaskAttachment[]>(task.attachments || []),
    [checklist, setChecklist] = useState<TaskChecklistItem[]>(task.checklist || []),
    [uploadingAttachment, setUploadingAttachment] = useState(false),
    [activeTab, setActiveTab] = useState<"details" | "history" | "comments">("details"),
    [resourcesOpen, setResourcesOpen] = useState(
      Boolean((task.attachments || []).length || legacyLinks(task).length),
    ),
    [dependencySearch, setDependencySearch] = useState(""),
    [assigneeIds, setAssigneeIds] = useState<string[]>(
      task.assignee_ids?.length
        ? task.assignee_ids
        : task.assignee_id
          ? [task.assignee_id]
          : [],
    ),
    [error, setError] = useState("");
  const uploadedPathsRef = useRef(new Set<string>());
  const closeModal = () => {
    const unsavedPaths = [...uploadedPathsRef.current];
    uploadedPathsRef.current.clear();
    if (unsavedPaths.length) onDiscardAttachments?.(unsavedPaths);
    onClose();
  };
  useEffect(() => {
    let active = true;
    void Promise.all(
      (task.attachments || []).map(async (attachment) => {
        if (!attachment.storage_path) return attachment;
        const url = await onResolveAttachmentUrl(attachment.storage_path);
        return url ? { ...attachment, url } : attachment;
      }),
    ).then((next) => {
      if (active && next.length) setAttachments(next);
    });
    return () => {
      active = false;
    };
  }, [onResolveAttachmentUrl, task.attachments]);
  const field = <K extends keyof Task>(key: K, value: Task[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const dependencyIds = form.blocked_by || [];
  const dependencyMatches = useMemo(() => {
    const query = dependencySearch.trim().toLowerCase();
    return tasks.filter(
      (candidate) =>
        candidate.id !== form.id &&
        (!query ||
          `${candidate.code} ${candidate.title}`.toLowerCase().includes(query)),
    );
  }, [dependencySearch, form.id, tasks]);
  const dependencyCandidates = useMemo(() => {
    const selected = tasks.filter(
      (candidate) => candidate.id !== form.id && dependencyIds.includes(candidate.id),
    );
    const selectedIds = new Set(selected.map((candidate) => candidate.id));
    return [
      ...selected,
      ...dependencyMatches
        .filter((candidate) => !selectedIds.has(candidate.id))
        .slice(0, Math.max(0, 100 - selected.length)),
    ];
  }, [dependencyIds, dependencyMatches, form.id, tasks]);
  const toggleDependency = (id: string) =>
    field(
      "blocked_by",
      dependencyIds.includes(id)
        ? dependencyIds.filter((dependencyId) => dependencyId !== id)
        : [...dependencyIds, id],
    );
  const addAttachment = () =>
    setAttachments((items) =>
      [...items, { id: crypto.randomUUID(), name: "", url: "" }].slice(-50),
    );
  const updateLink = (index: number, key: keyof TaskLink, value: string) =>
    setLinks((list) =>
      list.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    );
  const addLink = () => setLinks((list) => [...list, { label: "", url: "" }]);
  const removeLink = (index: number) =>
    setLinks((list) => list.filter((_, itemIndex) => itemIndex !== index));
  const addChecklistItem = () =>
    setChecklist((items) =>
      [...items, { id: crypto.randomUUID(), title: "", done: false }].slice(-100),
    );
  const setSnooze = (days: number) =>
    field("snoozed_until", new Date(Date.now() + days * 86400000).toISOString());
  const save = () => {
    const filledLinks = links.filter((link) => link.url.trim());
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
    if (
      checklist.some((item) => !item.title.trim()) ||
      checklist.some((item) => item.title.trim().length > 500)
    ) {
      setError("Mỗi mục checklist cần có nội dung và không quá 500 ký tự.");
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
    if (filledLinks.some((link) => link.label.trim().length > 120)) {
      setError("Tên link không được vượt quá 120 ký tự.");
      return;
    }
    if (filledLinks.some((link) => link.url.trim().length > 2048)) {
      setError("URL không được vượt quá 2.048 ký tự.");
      return;
    }
    if (filledLinks.some((link) => !/^https?:\/\//i.test(link.url.trim()))) {
      setError("Link phải bắt đầu bằng http:// hoặc https://.");
      return;
    }
    if (
      attachments.some(
        (attachment) =>
          !attachment.name.trim() || !/^https?:\/\//i.test(attachment.url.trim()),
      )
    ) {
      setError("File đính kèm cần có tên và URL http/https hợp lệ.");
      return;
    }
    setError("");
    if (usePrefix) onPrefixChange(normalizedPrefix);
    const codeSuffix = form.code.replace(prefix, "").trim();
    const finalCode = usePrefix ? `${normalizedPrefix}${codeSuffix}` : form.code.trim();
    const normalizeLinks = (items: TaskLink[]) =>
      items
        .filter((link) => link.url.trim())
        .map((link) => ({
          label: link.label.trim() || "Link",
          url: link.url.trim(),
        }));
    onSave({
      ...form,
      title,
      description,
      next_action: nextAction,
      review_note: reviewNote,
      code: finalCode,
      custom_code: !usePrefix,
      primary_links: normalizeLinks(links),
      secondary_links: [],
      inbox: form.inbox === true,
      snoozed_until: form.status === "done" ? undefined : form.snoozed_until,
      attachments: attachments.map((attachment) => ({
        ...attachment,
        name: attachment.name.trim(),
        url: attachment.url.trim(),
      })),
      checklist: checklist.map((item) => ({ ...item, title: item.title.trim() })),
      assignee_ids: assigneeIds,
      assignee_id: assigneeIds[0] || "",
      links: [],
    });
  };
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && closeModal()}
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
          <button
            className="icon-button"
            aria-label="Đóng cửa sổ task"
            title="Đóng cửa sổ task"
            onClick={closeModal}
          >
            <X size={19} />
          </button>
        </header>
        {readOnly && (
          <div className="readonly-notice" role="status">
            Workspace này đang ở chế độ chỉ xem. Bạn không có quyền chỉnh sửa task.
          </div>
        )}
        <div className="modal-body">
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-tabs" role="tablist" aria-label="Nội dung task">
            <button
              className={`modal-tab${activeTab === "details" ? " active" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeTab === "details"}
              aria-controls="task-details-panel"
              onClick={() => setActiveTab("details")}
            >
              Thông tin task
            </button>
            <button
              className={`modal-tab${activeTab === "history" ? " active" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeTab === "history"}
              aria-controls="task-history-panel"
              onClick={() => setActiveTab("history")}
            >
              Lịch sử thay đổi
              {form.activity?.length ? <span>{form.activity.length}</span> : null}
            </button>
            {!isNew && (
              <button
                className={`modal-tab${activeTab === "comments" ? " active" : ""}`}
                type="button"
                role="tab"
                aria-selected={activeTab === "comments"}
                aria-controls="task-comments-panel"
                onClick={() => setActiveTab("comments")}
              >
                <MessageCircle size={14} /> Thảo luận
                {form.comments?.length ? <span>{form.comments.length}</span> : null}
              </button>
            )}
          </div>
          {activeTab === "details" ? (
            <fieldset className="task-form-fieldset" disabled={readOnly}>
              <div className="form-grid" id="task-details-panel" role="tabpanel">
                <section
                  className="form-block full"
                  aria-labelledby="task-core-heading"
                >
                  <div className="form-block-heading">
                    <div>
                      <h3 id="task-core-heading">Thông tin chính</h3>
                      <p>Tên, mã và người phụ trách công việc.</p>
                    </div>
                  </div>
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
                  <label className="inbox-toggle field full">
                    <span>
                      <b>Inbox cần triage</b>
                      <small>Giữ task ở Inbox cho đến khi bạn phân loại xong.</small>
                    </span>
                    <input
                      type="checkbox"
                      checked={form.inbox === true}
                      onChange={(event) => field("inbox", event.target.checked)}
                    />
                  </label>
                  <div className="field full">
                    <span>
                      Mã task{" "}
                      <small>Prefix mặc định có thể đổi trong từng workspace</small>
                    </span>
                    <div className="code-builder">
                      <label className="checkbox-line">
                        <input
                          type="checkbox"
                          checked={usePrefix}
                          onChange={(e) => {
                            setUsePrefix(e.target.checked);
                            if (e.target.checked && !form.code)
                              field("code", localPrefix);
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
                            value={form.code
                              .replace(prefix, "")
                              .replace(localPrefix, "")}
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
                </section>
                <section
                  className="form-block full"
                  aria-labelledby="task-planning-heading"
                >
                  <div className="form-block-heading">
                    <div>
                      <h3 id="task-planning-heading">Tiến độ và thời hạn</h3>
                      <p>Xác định mức độ ưu tiên và các mốc cần theo dõi.</p>
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
                          value={toDateInputValue(form[key])}
                          onChange={(e) =>
                            field(key, fromDateInputValue(e.target.value))
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <label className="field">
                    <span>Deadline</span>
                    <input
                      type="date"
                      value={toDateInputValue(form.deadline)}
                      onChange={(e) =>
                        field("deadline", fromDateInputValue(e.target.value))
                      }
                    />
                  </label>
                  <div className="field full">
                    <span>
                      Hoãn đến{" "}
                      <small>Chỉ hiện ngoài card khi task đang được hoãn.</small>
                    </span>
                    <p className="field-hint">
                      Dùng để tạm ẩn task khỏi Today. Task hoàn tất sẽ tự bỏ mốc hoãn.
                    </p>
                    <div className="field-row field-row-3">
                      <input
                        type="datetime-local"
                        aria-label="Hoãn đến"
                        value={toDateTimeLocalValue(form.snoozed_until || "")}
                        onChange={(event) =>
                          field(
                            "snoozed_until",
                            fromDateTimeLocalValue(event.target.value) || undefined,
                          )
                        }
                        disabled={readOnly}
                      />
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setSnooze(1)}
                        disabled={readOnly}
                      >
                        1 ngày
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setSnooze(7)}
                        disabled={readOnly}
                      >
                        1 tuần
                      </button>
                      {form.snoozed_until && (
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => field("snoozed_until", undefined)}
                          disabled={readOnly}
                        >
                          Bỏ hoãn
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="field full recurrence-field">
                    <span>
                      Lặp lại task <small>Tự tạo nhắc việc theo chu kỳ đã chọn.</small>
                    </span>
                    <p className="field-hint">
                      Dùng khi công việc lặp lại đều đặn, ví dụ kiểm tra báo cáo mỗi
                      tuần.
                    </p>
                    <div className="field-row field-row-3">
                      <select
                        aria-label="Tần suất lặp lại"
                        value={form.recurrence?.frequency || "none"}
                        onChange={(e) =>
                          field(
                            "recurrence",
                            e.target.value === "none"
                              ? undefined
                              : {
                                  frequency: e.target.value as
                                    "daily" | "weekly" | "monthly",
                                  interval: form.recurrence?.interval || 1,
                                },
                          )
                        }
                      >
                        <option value="none">Không lặp</option>
                        <option value="daily">Mỗi ngày</option>
                        <option value="weekly">Mỗi tuần</option>
                        <option value="monthly">Mỗi tháng</option>
                      </select>
                      {form.recurrence && (
                        <input
                          type="number"
                          min={1}
                          max={365}
                          aria-label="Khoảng lặp"
                          value={form.recurrence.interval}
                          onChange={(e) =>
                            field("recurrence", {
                              ...form.recurrence!,
                              interval: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                      )}
                      {form.recurrence && (
                        <input
                          type="date"
                          aria-label="Ngày kết thúc lặp"
                          value={toDateInputValue(form.recurrence.until || "")}
                          onChange={(e) =>
                            field("recurrence", {
                              ...form.recurrence!,
                              until: fromDateInputValue(e.target.value) || undefined,
                            })
                          }
                        />
                      )}
                    </div>
                  </div>
                </section>
                <section
                  className="form-block full"
                  aria-labelledby="task-detail-heading"
                >
                  <div className="form-block-heading">
                    <div>
                      <h3 id="task-detail-heading">Nội dung công việc</h3>
                      <p>Bối cảnh, bước tiếp theo và ghi chú review.</p>
                    </div>
                  </div>
                  <label className="field full">
                    <span>Mô tả / ghi chú</span>
                    <textarea
                      rows={4}
                      value={form.description}
                      onChange={(e) => field("description", e.target.value)}
                      placeholder="Bối cảnh, yêu cầu, lưu ý..."
                    />
                  </label>
                  <div className="checklist-panel field full">
                    <div className="checklist-heading">
                      <div>
                        <b>
                          <ListChecks size={15} /> Checklist
                        </b>
                        <small>Chia task thành các bước nhỏ để dễ hoàn thành.</small>
                      </div>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={addChecklistItem}
                      >
                        <Plus size={14} /> Thêm bước
                      </button>
                    </div>
                    {checklist.length ? (
                      <div className="checklist-list">
                        {checklist.map((item, index) => (
                          <div className="checklist-row" key={item.id}>
                            <input
                              type="checkbox"
                              checked={item.done}
                              aria-label={`Hoàn thành bước ${index + 1}`}
                              onChange={(event) =>
                                setChecklist((items) =>
                                  items.map((current) =>
                                    current.id === item.id
                                      ? { ...current, done: event.target.checked }
                                      : current,
                                  ),
                                )
                              }
                            />
                            <input
                              value={item.title}
                              aria-label={`Nội dung bước ${index + 1}`}
                              placeholder="Ví dụ: Kiểm tra trên mobile"
                              onChange={(event) =>
                                setChecklist((items) =>
                                  items.map((current) =>
                                    current.id === item.id
                                      ? { ...current, title: event.target.value }
                                      : current,
                                  ),
                                )
                              }
                            />
                            <button
                              className="icon-button mini"
                              type="button"
                              title="Xóa bước checklist"
                              aria-label={`Xóa bước ${index + 1}`}
                              onClick={() =>
                                setChecklist((items) =>
                                  items.filter((current) => current.id !== item.id),
                                )
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="checklist-empty">Chưa có bước checklist.</p>
                    )}
                  </div>
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
                </section>
                <section
                  className="form-block full"
                  aria-labelledby="task-relation-heading"
                >
                  <div className="form-block-heading">
                    <div>
                      <h3 id="task-relation-heading">Quan hệ và tài liệu</h3>
                      <p>Chọn các task cần hoàn tất trước và gắn tài liệu liên quan.</p>
                    </div>
                  </div>
                  <label className="field full">
                    <span>
                      Phụ thuộc task khác{" "}
                      <small>{dependencyIds.length} task đã chọn</small>
                    </span>
                    <p className="field-hint" id="dependency-help">
                      Đây là các task phải hoàn tất trước khi task hiện tại sẵn sàng. Có
                      thể chọn nhiều task.
                    </p>
                    <div
                      className="dependency-picker"
                      aria-describedby="dependency-help"
                    >
                      <input
                        type="search"
                        className="dependency-search"
                        aria-label="Tìm task phụ thuộc"
                        placeholder="Tìm theo mã hoặc tiêu đề..."
                        value={dependencySearch}
                        onChange={(event) => setDependencySearch(event.target.value)}
                      />
                      {(dependencySearch || dependencyMatches.length > 100) && (
                        <small className="dependency-result-count">
                          {dependencyMatches.length > 100
                            ? `Có ${dependencyMatches.length} task phù hợp; đang hiển thị tối đa 100.`
                            : `${dependencyMatches.length} task phù hợp.`}
                        </small>
                      )}
                      {dependencyCandidates.length ? (
                        <div className="dependency-list">
                          {dependencyCandidates.map((candidate) => {
                            const checked = dependencyIds.includes(candidate.id);
                            return (
                              <label
                                className={`dependency-option${checked ? " selected" : ""}`}
                                key={candidate.id}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleDependency(candidate.id)}
                                />
                                <span>
                                  <b>{candidate.code || "TASK"}</b>
                                  <small>{candidate.title}</small>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="field-hint">Chưa có task khác để chọn.</p>
                      )}
                    </div>
                  </label>
                  <details
                    className="resource-details field full"
                    open={resourcesOpen}
                    onToggle={(event) => setResourcesOpen(event.currentTarget.open)}
                  >
                    <summary className="resource-summary">
                      <span className="resource-summary-copy">
                        <b>Tài liệu & liên kết</b>
                        <small>
                          {attachments.length || links.length
                            ? `${attachments.length} file · ${links.length} liên kết`
                            : "Chưa có tài liệu hoặc liên kết"}
                        </small>
                      </span>
                      <span className="resource-summary-control">
                        <span>{resourcesOpen ? "Thu gọn" : "Mở rộng"}</span>
                        <ChevronDown size={16} aria-hidden="true" />
                      </span>
                    </summary>
                    <div className="attachment-panel field full">
                      <div className="attachment-heading">
                        <div>
                          <b>File đính kèm</b>
                          <small>
                            Thêm URL hoặc upload file để mở nhanh khi xử lý task.
                          </small>
                        </div>
                        <div className="attachment-actions">
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={addAttachment}
                          >
                            <Plus size={14} /> Thêm URL
                          </button>
                          <label className="attachment-upload-button">
                            <Upload size={14} />
                            {uploadingAttachment ? "Đang upload…" : "Upload file"}
                            <input
                              type="file"
                              hidden
                              disabled={uploadingAttachment}
                              onChange={async (event) => {
                                const file = event.target.files?.[0];
                                event.currentTarget.value = "";
                                if (!file) return;
                                setUploadingAttachment(true);
                                const uploaded = await onUploadAttachment(file);
                                if (uploaded) {
                                  if (uploaded.storage_path)
                                    uploadedPathsRef.current.add(uploaded.storage_path);
                                  setAttachments((items) =>
                                    [...items, uploaded].slice(-50),
                                  );
                                }
                                setUploadingAttachment(false);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                      {!attachments.length ? (
                        <div className="attachment-empty">
                          <FileText size={22} />
                          <span>
                            <b>Chưa có file đính kèm</b>
                            <small>Upload file hoặc thêm URL thủ công.</small>
                          </span>
                        </div>
                      ) : (
                        <div className="attachment-list">
                          {attachments.map((attachment, index) => (
                            <div className="attachment-card" key={attachment.id}>
                              <FileText size={18} />
                              <div className="attachment-fields">
                                <input
                                  aria-label={`Tên file ${index + 1}`}
                                  value={attachment.name}
                                  placeholder="Tên file"
                                  onChange={(e) =>
                                    setAttachments((items) =>
                                      items.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? { ...item, name: e.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                                <input
                                  aria-label={`URL file ${index + 1}`}
                                  value={attachment.url}
                                  placeholder="https://..."
                                  onChange={(e) =>
                                    setAttachments((items) =>
                                      items.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? { ...item, url: e.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              {isSafeHttpUrl(attachment.url) ? (
                                <a
                                  className="attachment-open-button"
                                  href={attachment.url.trim()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Mở file đính kèm ${index + 1} trong tab mới`}
                                  title="Mở file trong tab mới"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <ExternalLink size={15} />
                                </a>
                              ) : (
                                <span
                                  className="attachment-open-spacer"
                                  aria-hidden="true"
                                />
                              )}
                              <button
                                className="icon-button mini"
                                type="button"
                                aria-label="Xóa file đính kèm"
                                title="Xóa file đính kèm"
                                onClick={() => {
                                  const removed = attachments[index];
                                  if (removed?.storage_path) {
                                    const wasUploadedInSession =
                                      uploadedPathsRef.current.delete(
                                        removed.storage_path,
                                      );
                                    if (wasUploadedInSession) {
                                      onDiscardAttachments?.([removed.storage_path]);
                                    }
                                  }
                                  setAttachments((items) =>
                                    items.filter((_, itemIndex) => itemIndex !== index),
                                  );
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="link-section full">
                      <div className="link-section-heading">
                        <span>
                          <b>Liên kết và tài liệu</b>
                          <small>
                            Chọn mục đích của link; nếu chưa biết có thể để trống.
                          </small>
                        </span>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={addLink}
                        >
                          <Plus size={14} /> Thêm liên kết
                        </button>
                      </div>
                      {!links.length ? (
                        <p className="link-empty">Chưa có liên kết nào.</p>
                      ) : (
                        links.map((link, index) => {
                          const isKnownPurpose = linkPurposes.includes(link.label);
                          const purposeValue = isKnownPurpose
                            ? link.label
                            : "__custom__";
                          return (
                            <div
                              className="link-row link-row-unified"
                              key={`link-${index}`}
                            >
                              <Link2 size={15} />
                              <select
                                aria-label={`Mục đích liên kết ${index + 1}`}
                                value={purposeValue}
                                onChange={(event) =>
                                  updateLink(
                                    index,
                                    "label",
                                    event.target.value === "__custom__"
                                      ? ""
                                      : event.target.value,
                                  )
                                }
                              >
                                {linkPurposes.map((purpose) => (
                                  <option key={purpose || "empty"} value={purpose}>
                                    {purpose || "Chưa phân loại"}
                                  </option>
                                ))}
                                <option value="__custom__">Khác</option>
                              </select>
                              {purposeValue === "__custom__" && (
                                <input
                                  className="link-purpose-input"
                                  aria-label={`Tên mục đích liên kết ${index + 1}`}
                                  value={link.label}
                                  onChange={(event) =>
                                    updateLink(index, "label", event.target.value)
                                  }
                                  placeholder="Tên mục đích"
                                />
                              )}
                              {purposeValue !== "__custom__" && (
                                <span
                                  className="link-purpose-spacer"
                                  aria-hidden="true"
                                />
                              )}
                              <input
                                className="link-url"
                                aria-label={`URL liên kết ${index + 1}`}
                                value={link.url}
                                onChange={(event) =>
                                  updateLink(index, "url", event.target.value)
                                }
                                placeholder="https://..."
                              />
                              {isSafeHttpUrl(link.url) ? (
                                <a
                                  className="link-open-button"
                                  href={link.url.trim()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Mở liên kết ${index + 1} trong tab mới`}
                                  title="Mở liên kết trong tab mới"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <ExternalLink size={15} />
                                </a>
                              ) : (
                                <span className="link-open-spacer" aria-hidden="true" />
                              )}
                              <button
                                className="icon-button mini"
                                type="button"
                                aria-label={`Xóa liên kết ${index + 1}`}
                                title="Xóa liên kết"
                                onClick={() => removeLink(index)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </details>
                </section>
              </div>
            </fieldset>
          ) : activeTab === "history" ? (
            <TaskHistoryPanel activity={form.activity} locale={locale} />
          ) : (
            <TaskCommentsPanel
              comments={form.comments}
              members={members}
              locale={locale}
              authorId={commentAuthorId}
              canComment={!isNew && !readOnly}
              onAddComment={(comment) => {
                onAddComment?.(form.id, comment);
                setForm((current) => ({
                  ...current,
                  comments: [...(current.comments || []), comment],
                }));
              }}
              onTogglePin={(commentId) => {
                onToggleCommentPin?.(form.id, commentId);
                setForm((current) => ({
                  ...current,
                  comments: (current.comments || []).map((comment) =>
                    comment.id === commentId
                      ? { ...comment, pinned: !comment.pinned }
                      : comment,
                  ),
                }));
              }}
            />
          )}
        </div>
        <footer className="modal-footer">
          {!isNew && (
            <button
              className="danger-button ghost"
              disabled={readOnly}
              onClick={task.archived_at ? onRestore : onDelete}
            >
              {task.archived_at ? <RotateCcw size={15} /> : <Archive size={15} />}
              {task.archived_at ? "Khôi phục task" : "Lưu trữ task"}
            </button>
          )}
          {!isNew && (
            <button
              className="text-button"
              type="button"
              disabled={readOnly}
              onClick={onSaveTemplate}
            >
              <Copy size={14} />
              Lưu thành template
            </button>
          )}
          <span />
          <button className="secondary-button" onClick={closeModal}>
            <X size={15} />
            Hủy
          </button>
          <button
            className="primary-button"
            disabled={readOnly || !form.title.trim()}
            onClick={save}
          >
            <Check size={15} />
            Lưu task
          </button>
        </footer>
      </section>
    </div>
  );
}
