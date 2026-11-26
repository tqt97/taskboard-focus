"use client";

import { useMemo, useState } from "react";
import { Cloud, Laptop, Merge, X } from "lucide-react";
import type { Task } from "@/lib/types";
import { formatConflictValue, getConflictFields } from "@/lib/taskboard/conflicts";

export function ConflictDialog({
  local,
  remote,
  message,
  remainingConflicts = 0,
  onResolve,
  onClose,
}: {
  local: Task;
  remote: Task;
  message: string;
  remainingConflicts?: number;
  onResolve: (
    resolution: "local" | "remote" | "merge",
    remoteFields?: ReadonlySet<keyof Task>,
  ) => Promise<void>;
  onClose: () => void;
}) {
  const fields = useMemo(() => getConflictFields(local, remote), [local, remote]);
  const [remoteFields, setRemoteFields] = useState<Set<keyof Task>>(
    () => new Set(fields.map((field) => field.key)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const resolve = async (resolution: "local" | "remote" | "merge") => {
    setSaving(true);
    setError("");
    try {
      await onResolve(resolution, remoteFields);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xử lý conflict.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="overlay" role="presentation">
      <section
        className="modal conflict-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">CONFLICT CENTER</span>
            <h2 id="conflict-title">Task có phiên bản khác trên cloud</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Đóng conflict center"
            title="Đóng"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">
          <div className="form-error" role="alert">
            {message}
          </div>
          <p className="setting-help">
            Chọn bản đầy đủ hoặc merge từng field. Lựa chọn sẽ được ghi lại trong
            activity của task ở bước tiếp theo.
          </p>
          {remainingConflicts > 1 && (
            <p className="setting-help">
              Còn {remainingConflicts - 1} task conflict khác đang chờ xử lý.
            </p>
          )}
          <div className="conflict-columns">
            <article>
              <h3>
                <Laptop size={16} /> Local
              </h3>
              <strong>{local.title}</strong>
              <small>{local.updated_at}</small>
            </article>
            <article>
              <h3>
                <Cloud size={16} /> Remote
              </h3>
              <strong>{remote.title}</strong>
              <small>{remote.updated_at}</small>
            </article>
          </div>
          <div className="conflict-fields">
            {fields.map((field) => (
              <label key={String(field.key)} className="conflict-field">
                <input
                  type="checkbox"
                  checked={remoteFields.has(field.key)}
                  onChange={(event) =>
                    setRemoteFields((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(field.key);
                      else next.delete(field.key);
                      return next;
                    })
                  }
                />
                <span>
                  <b>{field.label}</b>
                  <small>Local: {formatConflictValue(field.local)}</small>
                  <small>Remote: {formatConflictValue(field.remote)}</small>
                </span>
              </label>
            ))}
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <footer className="modal-footer conflict-actions">
            <button
              className="secondary-button"
              disabled={saving}
              onClick={() => void resolve("local")}
            >
              <Laptop size={15} /> Giữ local
            </button>
            <button
              className="secondary-button"
              disabled={saving}
              onClick={() => void resolve("remote")}
            >
              <Cloud size={15} /> Lấy remote
            </button>
            <button
              className="primary-button"
              disabled={saving || remoteFields.size === 0}
              onClick={() => void resolve("merge")}
            >
              <Merge size={15} /> Merge field đã chọn
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}
