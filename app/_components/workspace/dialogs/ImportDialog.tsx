"use client";

import { useMemo, useState } from "react";
import { GitMerge, Replace, X } from "lucide-react";
import type { BoardData } from "@/lib/types";
import { previewBoardImport } from "@/lib/taskboard/import-merge";

export function ImportDialog({
  current,
  incoming,
  onCancel,
  onReplace,
  onMerge,
}: {
  current: BoardData;
  incoming: BoardData;
  onCancel: () => void;
  onReplace: () => void;
  onMerge: (keepIncoming: ReadonlySet<string>) => void;
}) {
  const preview = useMemo(
    () => previewBoardImport(current, incoming),
    [current, incoming],
  );
  const [keepIncoming, setKeepIncoming] = useState<Set<string>>(
    () => new Set(preview.conflicts.map((item) => item.id)),
  );
  const [showAll, setShowAll] = useState(false);
  const conflicts = showAll ? preview.conflicts : preview.conflicts.slice(0, 20);
  return (
    <div className="overlay" role="presentation">
      <section
        className="modal import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">IMPORT PREVIEW</span>
            <h2 id="import-title">Kiểm tra backup trước khi nhập</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Đóng import preview"
            title="Đóng"
            onClick={onCancel}
          >
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">
          <div className="import-summary">
            <b>{incoming.tasks.length} task trong backup</b>
            <span>
              {preview.newTasks} task mới · {preview.conflicts.length} task khác phiên
              bản
            </span>
          </div>
          {preview.conflicts.length > 0 ? (
            <div className="import-conflicts">
              <p>
                Với mỗi conflict, chọn bản backup để ghi đè; bỏ chọn sẽ giữ bản local.
              </p>
              {conflicts.map((item) => (
                <label className="import-conflict" key={item.id}>
                  <input
                    type="checkbox"
                    checked={keepIncoming.has(item.id)}
                    onChange={(event) =>
                      setKeepIncoming((currentSet) => {
                        const next = new Set(currentSet);
                        if (event.target.checked) next.add(item.id);
                        else next.delete(item.id);
                        return next;
                      })
                    }
                  />
                  <span>
                    <b>{item.local.code || item.id}</b>
                    <small>Local: {item.local.title}</small>
                    <small>Backup: {item.incoming.title}</small>
                  </span>
                </label>
              ))}
              {preview.conflicts.length > 20 && (
                <button
                  className="text-button"
                  onClick={() => setShowAll((value) => !value)}
                >
                  {showAll ? "Thu gọn" : `Xem đủ ${preview.conflicts.length} conflict`}
                </button>
              )}
            </div>
          ) : (
            <p className="setting-help">
              Không có task trùng phiên bản. Merge sẽ chỉ thêm task mới vào workspace
              hiện tại.
            </p>
          )}
          <footer className="modal-footer import-actions">
            <button className="secondary-button" onClick={onCancel}>
              Hủy
            </button>
            <button className="secondary-button" onClick={onReplace}>
              <Replace size={15} /> Thay thế toàn bộ
            </button>
            <button className="primary-button" onClick={() => onMerge(keepIncoming)}>
              <GitMerge size={15} /> Merge đã chọn
            </button>
          </footer>
          <small className="setting-help">
            Thay thế toàn bộ vẫn có thể hoàn tác trong 10 giây sau khi xác nhận.
          </small>
        </div>
      </section>
    </div>
  );
}
