"use client";

import { useMemo, useState } from "react";
import { GitMerge, Replace } from "lucide-react";
import type { BoardData } from "@/lib/types";
import { previewBoardImport } from "@/lib/taskboard/import-merge";
import { Button } from "@/app/_components/ui/Button";
import { DialogFrame } from "@/app/_components/ui/DialogFrame";
import { DialogHeader } from "@/app/_components/ui/DialogHeader";

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
    <DialogFrame panelClassName="modal import-modal" labelledBy="import-title">
      <DialogHeader
        eyebrow="IMPORT PREVIEW"
        titleId="import-title"
        title="Kiểm tra backup trước khi nhập"
        closeLabel="Đóng import preview"
        onClose={onCancel}
      />
      <div className="modal-body">
        <div className="import-summary">
          <b>{incoming.tasks.length} task trong backup</b>
          <span>
            {preview.newTasks} task mới · {preview.conflicts.length} task khác phiên bản
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
              <Button variant="text" onClick={() => setShowAll((value) => !value)}>
                {showAll ? "Thu gọn" : `Xem đủ ${preview.conflicts.length} conflict`}
              </Button>
            )}
          </div>
        ) : (
          <p className="setting-help">
            Không có task trùng phiên bản. Merge sẽ chỉ thêm task mới vào workspace hiện
            tại.
          </p>
        )}
        <footer className="modal-footer import-actions">
          <Button variant="secondary" onClick={onCancel}>
            Hủy
          </Button>
          <Button variant="secondary" onClick={onReplace}>
            <Replace size={15} /> Thay thế toàn bộ
          </Button>
          <Button variant="primary" onClick={() => onMerge(keepIncoming)}>
            <GitMerge size={15} /> Merge đã chọn
          </Button>
        </footer>
        <small className="setting-help">
          Thay thế toàn bộ vẫn có thể hoàn tác trong 10 giây sau khi xác nhận.
        </small>
      </div>
    </DialogFrame>
  );
}
