import { useEffect, type RefObject } from "react";

export function useWorkspaceShortcuts({
  canEdit,
  modalOpen,
  searchRef,
  onQuickCapture,
}: {
  canEdit: boolean;
  modalOpen: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  onQuickCapture: () => void;
}) {
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (!typing && !modalOpen && canEdit && event.key.toLowerCase() === "n") {
        event.preventDefault();
        onQuickCapture();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [canEdit, modalOpen, onQuickCapture, searchRef]);
}
