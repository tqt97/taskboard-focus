"use client";

import { useState } from "react";
import { CornerDownLeft, X } from "lucide-react";

export function QuickCapture({
  onSave,
  onClose,
}: {
  onSave: (title: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");

  return (
    <div
      className="overlay quick-capture-overlay"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form
        className="quick-capture modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-capture-title"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim()) onSave(title.trim());
        }}
      >
        <header className="modal-header">
          <div>
            <h2 id="quick-capture-title">Ghi nhanh vào Inbox</h2>
            <small>Chỉ cần tiêu đề; bạn có thể phân loại và bổ sung sau.</small>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Đóng"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">
          <label className="field">
            <span>Tên công việc</span>
            <input
              autoFocus
              maxLength={500}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ví dụ: Gửi bản tổng hợp cho khách hàng"
            />
          </label>
        </div>
        <footer className="modal-footer">
          <span />
          <button type="button" className="secondary-button" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="primary-button" disabled={!title.trim()}>
            <CornerDownLeft size={15} /> Lưu vào Inbox
          </button>
        </footer>
      </form>
    </div>
  );
}
