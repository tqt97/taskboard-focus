"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  useEffect,
  useCallback,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type SelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

type SelectProps = {
  value: string;
  options: readonly SelectOption[];
  onValueChange: (value: string) => void;
  "aria-label": string;
  className?: string;
  disabled?: boolean;
  leadingIcon?: ReactNode;
};

export function Select({
  value,
  options,
  onValueChange,
  "aria-label": ariaLabel,
  className = "",
  disabled = false,
  leadingIcon,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [listStyle, setListStyle] = useState<CSSProperties>();
  const listId = useId();
  const selectedOption = options.find((option) => option.value === value);
  const selectedIndex = options.findIndex((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !listRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  const updateListPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const estimatedHeight = Math.min(
      options.length * 40 + 12,
      Math.min(300, window.innerHeight * 0.6),
    );
    const hasRoomBelow = window.innerHeight - rect.bottom - 8 >= estimatedHeight;
    const top = hasRoomBelow
      ? rect.bottom + 7
      : Math.max(12, rect.top - estimatedHeight - 7);
    const estimatedWidth = Math.min(Math.max(rect.width, 220), 320);
    const left = Math.min(
      Math.max(12, rect.left),
      Math.max(12, window.innerWidth - estimatedWidth - 12),
    );
    setListStyle({
      top,
      left,
      minWidth: Math.max(rect.width, className === "header-locale" ? 176 : 0),
    });
  }, [className, options.length]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => updateListPosition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, updateListPosition]);

  const focusOption = (index: number) => {
    requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLButtonElement>(`[data-option-index="${index}"]`)
        ?.focus();
    });
  };

  const openAt = (index: number) => {
    updateListPosition();
    setOpen(true);
    focusOption(index);
  };

  const moveFocus = (current: number, direction: 1 | -1) => {
    if (!options.length) return;
    let index = current;
    for (let count = 0; count < options.length; count += 1) {
      index = (index + direction + options.length) % options.length;
      if (!options[index].disabled) {
        focusOption(index);
        return;
      }
    }
  };

  const closeAndFocusTrigger = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const listbox = open ? (
    <div
      className={`ui-select-listbox${className ? ` ${className}-listbox` : ""}`}
      id={listId}
      ref={listRef}
      role="listbox"
      aria-label={ariaLabel}
      style={listStyle}
    >
      {options.map((option, index) => (
        <button
          className={`ui-select-option${option.value === value ? " selected" : ""}`}
          id={`${listId}-option-${index}`}
          data-option-index={index}
          key={option.value}
          type="button"
          role="option"
          aria-selected={option.value === value}
          disabled={option.disabled}
          tabIndex={-1}
          onClick={() => {
            onValueChange(option.value);
            closeAndFocusTrigger();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeAndFocusTrigger();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              moveFocus(index, event.key === "ArrowDown" ? 1 : -1);
            } else if (event.key === "Home" || event.key === "End") {
              event.preventDefault();
              const targetIndex = event.key === "Home" ? 0 : options.length - 1;
              focusOption(targetIndex);
            }
          }}
        >
          <span>{option.label}</span>
          {option.value === value && <Check size={15} aria-hidden="true" />}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div
      className={`ui-select${className ? ` ${className}` : ""}${open ? " open" : ""}`}
      ref={rootRef}
      onBlur={(event: FocusEvent<HTMLDivElement>) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (
          !event.currentTarget.contains(nextTarget) &&
          !listRef.current?.contains(nextTarget)
        ) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        className="ui-select-trigger"
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-valuetext={
          typeof selectedOption?.label === "string" ? selectedOption.label : undefined
        }
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && selectedIndex >= 0 ? `${listId}-option-${selectedIndex}` : undefined
        }
        disabled={disabled}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            const firstEnabled = options.findIndex((option) => !option.disabled);
            openAt(selectedIndex >= 0 ? selectedIndex : Math.max(firstEnabled, 0));
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            setOpen(false);
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openAt(selectedIndex >= 0 ? selectedIndex : 0);
          } else if (event.key === "Home") {
            event.preventDefault();
            openAt(0);
          } else if (event.key === "End") {
            event.preventDefault();
            openAt(options.length - 1);
          }
        }}
      >
        {leadingIcon}
        <span className="ui-select-value">{selectedOption?.label ?? "—"}</span>
        <ChevronDown className="ui-select-chevron" size={15} aria-hidden="true" />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(listbox, document.body)
        : null}
    </div>
  );
}
