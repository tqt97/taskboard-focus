import {
  Bell,
  Database,
  FileText,
  Palette,
  Plug,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useRef } from "react";
import { Button } from "@/app/_components/ui/Button";

type SettingItem = readonly [string, string, LucideIcon];

const groups: ReadonlyArray<{ label: string; items: ReadonlyArray<SettingItem> }> = [
  {
    label: "Cài đặt nhanh",
    items: [
      ["notifications", "Thông báo", Bell],
      ["appearance", "Giao diện", Palette],
    ],
  },
  {
    label: "Workspace",
    items: [
      ["members", "Đội ngũ", Users],
      ["integrations", "Tích hợp", Plug],
      ["data", "Dữ liệu", Database],
      ["templates", "Template", FileText],
    ],
  },
] as const;

export function SettingsTabs({
  tab,
  onChange,
}: {
  tab: string;
  onChange: (tab: string) => void;
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const items = groups.flatMap((group) => group.items);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = items.findIndex(([itemId]) => itemId === id);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length;
    const nextId = items[nextIndex][0];
    onChange(nextId);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="settings-tabs" role="tablist" aria-label="Nội dung cài đặt">
      {groups.map((group) => (
        <div className="settings-tab-group" key={group.label}>
          <span className="settings-tab-group-label">{group.label}</span>
          {group.items.map(([id, label, Icon]) => (
            <Button
              className={tab === id ? "selected" : ""}
              type="button"
              role="tab"
              id={`settings-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`settings-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              ref={(element) => {
                tabRefs.current[items.findIndex(([itemId]) => itemId === id)] = element;
              }}
              key={id}
              onClick={() => onChange(id)}
              onKeyDown={(event) => handleKeyDown(event, id)}
            >
              <Icon size={15} /> {label}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
