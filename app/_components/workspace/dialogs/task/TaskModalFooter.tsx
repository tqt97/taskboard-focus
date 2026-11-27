import { Archive, Check, Copy, FilePenLine, RotateCcw, X } from "lucide-react";
import { Button } from "@/app/_components/ui/Button";

export function TaskModalFooter({
  isNew,
  archived,
  readOnly,
  hasTitle,
  onRestore,
  onDelete,
  onSaveTemplate,
  onClose,
  onSaveDraft,
  onSave,
}: {
  isNew: boolean;
  archived: boolean;
  readOnly: boolean;
  hasTitle: boolean;
  onRestore: () => void;
  onDelete: () => void;
  onSaveTemplate: () => void;
  onClose: () => void;
  onSaveDraft: () => void;
  onSave: () => void;
}) {
  return (
    <footer className="modal-footer">
      {!isNew && (
        <Button
          variant="danger"
          className="ghost"
          type="button"
          disabled={readOnly}
          onClick={archived ? onRestore : onDelete}
        >
          {archived ? <RotateCcw size={15} /> : <Archive size={15} />}
          {archived ? "Khôi phục task" : "Lưu trữ task"}
        </Button>
      )}
      {!isNew && (
        <Button
          variant="text"
          type="button"
          disabled={readOnly}
          onClick={onSaveTemplate}
        >
          <Copy size={14} />
          Lưu thành template
        </Button>
      )}
      <span />
      <Button variant="secondary" type="button" onClick={onClose}>
        <X size={15} />
        Hủy
      </Button>
      <Button
        variant="secondary"
        type="button"
        disabled={readOnly || !hasTitle}
        onClick={onSaveDraft}
      >
        <FilePenLine size={15} />
        Lưu nháp
      </Button>
      <Button
        variant="primary"
        type="button"
        disabled={readOnly || !hasTitle}
        onClick={onSave}
      >
        <Check size={15} />
        Lưu task
      </Button>
    </footer>
  );
}
