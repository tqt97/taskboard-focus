import type { FormEventHandler, ReactNode } from "react";

type DialogFrameProps = {
  children: ReactNode;
  labelledBy: string;
  panelClassName: string;
  overlayClassName?: string;
  panelAs?: "section" | "form";
  onBackdropClick?: () => void;
  onSubmit?: FormEventHandler<HTMLFormElement>;
};

export function DialogFrame({
  children,
  labelledBy,
  panelClassName,
  overlayClassName = "",
  panelAs = "section",
  onBackdropClick,
  onSubmit,
}: DialogFrameProps) {
  const panelProps = {
    className: panelClassName,
    role: "dialog" as const,
    "aria-modal": true as const,
    "aria-labelledby": labelledBy,
    children,
  };

  return (
    <div
      className={`overlay${overlayClassName ? ` ${overlayClassName}` : ""}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onBackdropClick?.();
      }}
    >
      {panelAs === "form" ? (
        <form {...panelProps} onSubmit={onSubmit} />
      ) : (
        <section {...panelProps} />
      )}
    </div>
  );
}
