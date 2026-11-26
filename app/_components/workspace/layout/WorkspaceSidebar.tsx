"use client";

import { Button } from "@/app/_components/ui/Button";
import {
  CalendarDays,
  CalendarRange,
  FilePenLine,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  Plus,
} from "lucide-react";
import type { LocalWorkspaceSummary } from "@/lib/storage/indexed-db-board-storage";
import { Select } from "@/app/_components/ui/Select";
import type { WorkspaceView } from "./workspace-routes";

export type WorkspaceNavigationCounts = {
  active: number;
  today: number;
  drafts: number;
};

export function WorkspaceSidebar({
  collapsed,
  view,
  counts,
  workspaceId,
  workspaceName,
  workspaces,
  onSwitchWorkspace,
  onCreateWorkspace,
  onNavigate,
  displayName,
  onLock,
}: {
  collapsed: boolean;
  view: WorkspaceView;
  counts: WorkspaceNavigationCounts;
  workspaceId: string;
  workspaceName: string;
  workspaces: LocalWorkspaceSummary[];
  onSwitchWorkspace: (workspaceId: string) => void | Promise<void>;
  onCreateWorkspace: () => void | Promise<void>;
  onNavigate: (path: string) => void;
  displayName: string;
  onLock: () => void;
}) {
  return (
    <aside className={collapsed ? "sidebar collapsed" : "sidebar"}>
      <div className="brand">
        <div className="brand-mark">
          <ListTodo size={21} />
        </div>
        <div>
          <strong>Taskboard</strong>
          <small title={workspaceName}>{workspaceName}</small>
        </div>
      </div>
      <div className="sidebar-workspace">
        <span className="sidebar-workspace-label">Workspace hiện tại</span>
        <div className="workspace-switcher-wrap">
          <Select
            className="workspace-switcher"
            aria-label="Chọn workspace"
            value={workspaceId}
            options={[
              ...(!workspaces.some((workspace) => workspace.id === "default")
                ? [{ value: "default", label: "Workspace cá nhân" }]
                : []),
              ...workspaces.map((workspace) => ({
                value: workspace.id,
                label: workspace.name,
              })),
            ]}
            onValueChange={(value) => void onSwitchWorkspace(value)}
          />
          <Button
            variant="icon"
            className="mini"
            type="button"
            aria-label="Tạo workspace"
            title="Tạo workspace mới"
            onClick={() => void onCreateWorkspace()}
          >
            <Plus size={14} />
          </Button>
        </div>
      </div>
      <nav>
        <Button
          className={view === "overview" ? "nav-item active" : "nav-item"}
          onClick={() => onNavigate("/")}
        >
          <LayoutDashboard size={18} />
          Tổng quan
        </Button>
        <span className="nav-divider" aria-hidden="true" />
        <Button
          className={view === "today" ? "nav-item active" : "nav-item"}
          onClick={() => onNavigate("/today")}
        >
          <CalendarDays size={18} />
          Hôm nay<span className="nav-count">{counts.today}</span>
        </Button>
        <span className="nav-divider" aria-hidden="true" />
        <Button
          className={view === "drafts" ? "nav-item active" : "nav-item"}
          onClick={() => onNavigate("/drafts")}
        >
          <FilePenLine size={18} />
          Bản nháp<span className="nav-count">{counts.drafts}</span>
        </Button>
        <span className="nav-divider" aria-hidden="true" />
        <Button
          className={view === "tasks" ? "nav-item active" : "nav-item"}
          onClick={() => onNavigate("/tasks")}
        >
          <ListTodo size={18} />
          Danh sách task<span className="nav-count">{counts.active}</span>
        </Button>
        <span className="nav-divider" aria-hidden="true" />
        <Button
          className={view === "timeline" ? "nav-item active" : "nav-item"}
          onClick={() => onNavigate("/timeline")}
        >
          <CalendarRange size={18} />
          Lịch & timeline
        </Button>
      </nav>
      <div className="sidebar-bottom">
        <div className="profile">
          <span className="avatar avatar-blue">T</span>
          <span>
            <b>{displayName}</b>
            <small>Local workspace</small>
          </span>
          <Button
            variant="icon"
            title="Khóa màn hình"
            aria-label="Khóa màn hình"
            onClick={onLock}
          >
            <LockKeyhole size={16} />
          </Button>
        </div>
      </div>
    </aside>
  );
}
