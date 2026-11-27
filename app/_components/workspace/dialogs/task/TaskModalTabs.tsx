import { MessageCircle } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/app/_components/ui/Button";

export type TaskModalTab = "details" | "history" | "comments";

export function TaskModalTabs({
  activeTab,
  isNew,
  activityCount,
  commentCount,
  onChange,
}: {
  activeTab: TaskModalTab;
  isNew: boolean;
  activityCount: number;
  commentCount: number;
  onChange: (tab: TaskModalTab) => void;
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabs: Array<{ id: TaskModalTab; label: string }> = [
    { id: "details", label: "Thông tin task" },
    { id: "history", label: "Lịch sử thay đổi" },
    ...(isNew ? [] : [{ id: "comments" as const, label: "Thảo luận" }]),
  ];

  return (
    <div className="modal-tabs" role="tablist" aria-label="Nội dung task">
      {tabs.map((tab) => (
        <Button
          className={`modal-tab${activeTab === tab.id ? " active" : ""}`}
          type="button"
          role="tab"
          id={`task-tab-${tab.id}`}
          aria-selected={activeTab === tab.id}
          aria-controls={`task-${tab.id}-panel`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          ref={(element) => {
            tabRefs.current[tabs.indexOf(tab)] = element;
          }}
          key={tab.id}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const currentIndex = tabs.indexOf(tab);
            const nextIndex =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? tabs.length - 1
                  : (currentIndex +
                      (event.key === "ArrowRight" ? 1 : -1) +
                      tabs.length) %
                    tabs.length;
            const next = tabs[nextIndex];
            onChange(next.id);
            tabRefs.current[nextIndex]?.focus();
          }}
        >
          {tab.id === "comments" && <MessageCircle size={14} />}
          {tab.label}
          {tab.id === "history" && activityCount > 0 ? (
            <span>{activityCount}</span>
          ) : null}
          {tab.id === "comments" && commentCount > 0 ? (
            <span>{commentCount}</span>
          ) : null}
        </Button>
      ))}
    </div>
  );
}
