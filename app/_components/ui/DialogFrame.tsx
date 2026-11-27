import {
  useEffect,
  useRef,
  type FormEventHandler,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";

type DialogFrameProps = {
  children: ReactNode;
  labelledBy: string;
  panelClassName: string;
  overlayClassName?: string;
  panelAs?: "section" | "form";
  portal?: boolean;
  describedBy?: string;
  onBackdropClick?: () => void;
  onEscape?: () => void;
  onSubmit?: FormEventHandler<HTMLFormElement>;
};

export function DialogFrame({
  children,
  labelledBy,
  panelClassName,
  overlayClassName = "",
  panelAs = "section",
  portal = false,
  describedBy,
  onBackdropClick,
  onEscape,
  onSubmit,
}: DialogFrameProps) {
  const panelRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(
    typeof document === "undefined"
      ? null
      : (document.activeElement as HTMLElement | null),
  );
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const getFocusable = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);

    const focusInitialElement = () => {
      const current = document.activeElement as Node | null;
      if (!current || !panel.contains(current)) {
        (
          panel.querySelector<HTMLElement>("[data-dialog-initial-focus]") ||
          getFocusable()[0] ||
          panel
        ).focus();
      }
    };

    focusInitialElement();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onEscapeRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    panel.addEventListener("keydown", handleKeyDown);
    return () => {
      panel.removeEventListener("keydown", handleKeyDown);
      if (restoreFocusRef.current?.isConnected) restoreFocusRef.current.focus();
    };
  }, []);

  const panelProps = {
    className: panelClassName,
    role: "dialog" as const,
    "aria-modal": true as const,
    "aria-labelledby": labelledBy,
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    tabIndex: -1,
    children,
  };

  const dialog = (
    <div
      className={`overlay${overlayClassName ? ` ${overlayClassName}` : ""}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onBackdropClick?.();
      }}
    >
      {panelAs === "form" ? (
        <form
          {...panelProps}
          ref={panelRef as Ref<HTMLFormElement>}
          onSubmit={onSubmit}
        />
      ) : (
        <section {...panelProps} ref={panelRef as Ref<HTMLElement>} />
      )}
    </div>
  );

  return portal && typeof document !== "undefined"
    ? createPortal(dialog, document.body)
    : dialog;
}
