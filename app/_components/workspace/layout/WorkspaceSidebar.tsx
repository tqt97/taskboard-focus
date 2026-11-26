"use client";

import {
  CalendarDays,
  CalendarRange,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  Plus,
  ChevronDown,
} from "lucide-react";
import type { LocalWorkspaceSummary } from "@/lib/storage/indexed-db-board-storage";
import type { WorkspaceView } from "./workspace-routes";

export type WorkspaceNavigationCounts = {
  active: number;
  today: number;
  inbox: number;
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
          <div className="workspace-switcher-display" aria-hidden="true">
            <span className="workspace-switcher-name">{workspaceName}</span>
            <ChevronDown size={15} />
          </div>
          <select
            className="workspace-switcher"
            aria-label="Chọn workspace"
            value={workspaceId}
            onChange={(event) => void onSwitchWorkspace(event.target.value)}
          >
            {!workspaces.some((workspace) => workspace.id === "default") && (
              <option value="default">Workspace cá nhân</option>
            )}
            {workspaces.map((workspace) => (
              <option value={workspace.id} key={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <button
            className="icon-button mini"
            type="button"
            aria-label="Tạo workspace"
            title="Tạo workspace mới"
            onClick={() => void onCreateWorkspace()}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      <nav>
        <button
          className={view === "overview" ? "nav-item active" : "nav-item"}
          onClick={() => onNavigate("/")}
        >
          <LayoutDashboard size={18} />
          Tổng quan
        </button>
        <button
          className={view === "tasks" ? "nav-item active" : "nav-item"}
          onClick={() => onNavigate("/tasks")}
        >
          <ListTodo size={18} />
          Danh sách task<span className="nav-count">{counts.active}</span>
        </button>
        <button
          className={view === "today" ? "nav-item active" : "nav-item"}
          onClick={() => onNavigate("/today")}
        >
          <CalendarDays size={18} />
          Hôm nay<span className="nav-count">{counts.today}</span>
        </button>
        <button
          className={view === "inbox" ? "nav-item active" : "nav-item"}
          onClick={() => onNavigate("/inbox")}
        >
          <ListTodo size={18} />
          Inbox<span className="nav-count">{counts.inbox}</span>
        </button>
        <button
          className={view === "timeline" ? "nav-item active" : "nav-item"}
          onClick={() => onNavigate("/timeline")}
        >
          <CalendarRange size={18} />
          Lịch & timeline
        </button>
      </nav>
      <div className="sidebar-bottom">
        <div className="profile">
          <span className="avatar avatar-blue">T</span>
          <span>
            <b>{displayName}</b>
            <small>Local workspace</small>
          </span>
          <button
            className="icon-button"
            title="Khóa màn hình"
            aria-label="Khóa màn hình"
            onClick={onLock}
          >
            <LockKeyhole size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
