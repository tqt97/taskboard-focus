"use client";

import { useState } from "react";
import { CornerDownLeft } from "lucide-react";
import { Button } from "@/app/_components/ui/Button";
import { DialogFrame } from "@/app/_components/ui/DialogFrame";
import { DialogHeader } from "@/app/_components/ui/DialogHeader";

export function QuickCapture({
  onSave,
  onClose,
}: {
  onSave: (title: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");

  return (
    <DialogFrame
      panelAs="form"
      panelClassName="quick-capture modal"
      overlayClassName="quick-capture-overlay"
      labelledBy="quick-capture-title"
      describedBy="quick-capture-description"
      onBackdropClick={onClose}
      onEscape={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        if (title.trim()) onSave(title.trim());
      }}
    >
      <DialogHeader
        titleId="quick-capture-title"
        title="Lưu bản nháp"
        description={
          <small id="quick-capture-description">
            Chỉ cần tiêu đề; bạn có thể phân loại và bổ sung sau.
          </small>
        }
        closeLabel="Đóng"
        onClose={onClose}
      />
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
        <Button variant="secondary" type="button" onClick={onClose}>
          Hủy
        </Button>
        <Button variant="primary" type="submit" disabled={!title.trim()}>
          <CornerDownLeft size={15} /> Lưu bản nháp
        </Button>
      </footer>
    </DialogFrame>
  );
}
