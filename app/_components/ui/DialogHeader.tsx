import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

type DialogHeaderProps = {
  titleId: string;
  title: ReactNode;
  closeLabel: string;
  onClose: () => void;
  eyebrow?: ReactNode;
  description?: ReactNode;
};

export function DialogHeader({
  titleId,
  title,
  closeLabel,
  onClose,
  eyebrow,
  description,
}: DialogHeaderProps) {
  return (
    <header className="modal-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 id={titleId}>{title}</h2>
        {description}
      </div>
      <Button
        variant="icon"
        type="button"
        aria-label={closeLabel}
        title={closeLabel}
        onClick={onClose}
      >
        <X size={19} />
      </Button>
    </header>
  );
}
