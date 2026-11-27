"use client";

import { Button } from "@/app/_components/ui/Button";
import dynamic from "next/dynamic";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CalendarRange,
  CloudDownload,
  CloudUpload,
  ChevronLeft,
  ChevronRight,
  Download,
  FilePenLine,
  Languages,
  LayoutDashboard,
  ListTodo,
  LogIn,
  Menu,
  Moon,
  Plus,
  Settings2,
  Sun,
  WifiOff,
  X,
} from "lucide-react";
import type { RefObject } from "react";
import type { AppLocale } from "@/lib/i18n";
import type { SyncState } from "@/lib/repositories/task-repository";
import { Select } from "@/app/_components/ui/Select";
import type { BoardNotification } from "../dialogs/NotificationPopover";
import type { WorkspaceView } from "./workspace-routes";
import type { WorkspaceNavigationCounts } from "./WorkspaceSidebar";

const NotificationPopover = dynamic(
  () =>
    import("../dialogs/NotificationPopover").then(
      (module) => module.NotificationPopover,
    ),
  { ssr: false },
);

export function WorkspaceHeader({
  view,
  counts,
  sidebarCollapsed,
  onToggleSidebar,
  mobileMenuOpen,
  onToggleMobileMenu,
  onNavigate,
  canEdit,
  onQuickCapture,
  locale,
  localeLabels,
  supportedLocales,
  onLocaleChange,
  cloudConfigured,
  cloudUserEmail,
  syncState,
  onSync,
  onExport,
  notificationRef,
  notifications,
  unreadNotificationCount,
  notificationsOpen,
  onToggleNotifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onOpenTaskFromNotification,
  onCloseNotifications,
  dark,
  onToggleDark,
  onOpenSettings,
  onLock,
  isOnline,
}: {
  view: WorkspaceView;
  counts: WorkspaceNavigationCounts;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  onNavigate: (path: string) => void;
  canEdit: boolean;
  onQuickCapture: () => void;
  locale: AppLocale;
  localeLabels: Record<AppLocale, string>;
  supportedLocales: readonly AppLocale[];
  onLocaleChange: (locale: AppLocale) => void;
  cloudConfigured: boolean;
  cloudUserEmail: string;
  syncState: SyncState;
  onSync: (direction: "push" | "pull") => void | Promise<void>;
  onExport: () => void;
  notificationRef: RefObject<HTMLDivElement | null>;
  notifications: BoardNotification[];
  unreadNotificationCount: number;
  notificationsOpen: boolean;
  onToggleNotifications: () => void;
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onOpenTaskFromNotification: (taskId: string) => void;
  onCloseNotifications: () => void;
  dark: boolean;
  onToggleDark: () => void;
  onOpenSettings: () => void;
  onLock: () => void;
  isOnline: boolean;
}) {
  const viewLabel =
    view === "overview"
      ? "Tổng quan"
      : view === "today"
        ? "Hôm nay"
        : view === "timeline"
          ? "Lịch & timeline"
          : "Danh sách task";

  return (
    <header className="topbar">
      <Button
        className="sidebar-collapse"
        aria-label={sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
        title={sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
        onClick={onToggleSidebar}
      >
        {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </Button>
      <div className="mobile-brand">
        <div className="brand-mark">
          <ListTodo size={19} />
        </div>
        <strong>Taskboard</strong>
      </div>
      <div className="breadcrumbs">
        Workspace <span>/</span> {viewLabel}
      </div>
      {!isOnline && (
        <span className="offline-indicator" role="status">
          <WifiOff size={14} /> Ngoại tuyến · thay đổi sẽ đồng bộ khi có mạng
        </span>
      )}
      <div className="top-actions">
        <Button
          className="mobile-menu-button"
          aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
          title={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
          aria-expanded={mobileMenuOpen}
          onClick={onToggleMobileMenu}
        >
          {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
        </Button>
        {mobileMenuOpen && (
          <>
            <Button
              className="mobile-nav-backdrop"
              aria-label="Đóng menu"
              onClick={onToggleMobileMenu}
            />
            <nav className="mobile-nav" aria-label="Điều hướng mobile">
              <div className="mobile-nav-header">
                <b>Menu</b>
                <Button
                  className="mobile-nav-close"
                  aria-label="Đóng menu"
                  onClick={onToggleMobileMenu}
                >
                  <X size={17} />
                </Button>
              </div>
              <Button
                className={view === "overview" ? "active" : ""}
                onClick={() => onNavigate("/")}
              >
                <LayoutDashboard size={17} /> Tổng quan
              </Button>
              <span className="nav-divider" aria-hidden="true" />
              <Button
                className={view === "today" ? "active" : ""}
                onClick={() => onNavigate("/today")}
              >
                <CalendarDays size={17} /> Hôm nay <span>{counts.today}</span>
              </Button>
              <span className="nav-divider" aria-hidden="true" />
              <Button
                className={view === "drafts" ? "active" : ""}
                onClick={() => onNavigate("/drafts")}
              >
                <FilePenLine size={17} /> Bản nháp <span>{counts.drafts}</span>
              </Button>
              <span className="nav-divider" aria-hidden="true" />
              <Button
                className={view === "tasks" ? "active" : ""}
                onClick={() => onNavigate("/tasks")}
              >
                <ListTodo size={17} /> Danh sách task <span>{counts.active}</span>
              </Button>
              <span className="nav-divider" aria-hidden="true" />
              <Button
                className={view === "timeline" ? "active" : ""}
                onClick={() => onNavigate("/timeline")}
              >
                <CalendarRange size={17} /> Lịch & timeline
              </Button>
              <span className="nav-divider" aria-hidden="true" />
              <Button onClick={onLock}>
                <Moon size={17} /> Khóa màn hình
              </Button>
            </nav>
          </>
        )}
        <Button
          className="header-quick-capture primary-button"
          disabled={!canEdit}
          title="Ghi nhanh task (N)"
          aria-label="Ghi nhanh task (N)"
          onClick={onQuickCapture}
        >
          <Plus size={16} /> <span>Ghi nhanh</span> <kbd>N</kbd>
        </Button>
        <Select
          className="header-locale"
          aria-label="Đổi ngôn ngữ"
          value={locale}
          leadingIcon={<Languages size={16} aria-hidden="true" />}
          options={supportedLocales.map((supportedLocale) => ({
            value: supportedLocale,
            label: localeLabels[supportedLocale],
          }))}
          onValueChange={(value) => onLocaleChange(value as AppLocale)}
        />
        <div className="header-utility-actions" aria-label="Công cụ workspace">
          <Button
            variant="icon"
            aria-label="Mở hướng dẫn sử dụng"
            title="Hướng dẫn sử dụng"
            onClick={() => onNavigate("/guide")}
          >
            <BookOpen size={17} />
          </Button>
          {cloudConfigured && cloudUserEmail ? (
            <>
              <Button
                variant="icon"
                aria-label="Đẩy workspace lên cloud"
                title="Đẩy workspace lên cloud"
                onClick={() => void onSync("push")}
                disabled={syncState.status === "syncing"}
              >
                <CloudUpload size={17} />
              </Button>
              <Button
                variant="icon"
                aria-label="Tải workspace từ cloud"
                title="Tải workspace từ cloud"
                onClick={() => void onSync("pull")}
                disabled={syncState.status === "syncing"}
              >
                <CloudDownload size={17} />
              </Button>
            </>
          ) : cloudConfigured ? (
            <Button
              variant="icon"
              aria-label="Đăng nhập cloud"
              title="Đăng nhập cloud để đồng bộ workspace"
              onClick={() => onNavigate("/login")}
            >
              <LogIn size={17} />
            </Button>
          ) : null}
          <Button
            variant="icon"
            aria-label="Tải dữ liệu"
            title="Tải dữ liệu"
            onClick={onExport}
          >
            <Download size={18} />
          </Button>
        </div>
        <div className="notification-wrap" ref={notificationRef}>
          <Button
            className={
              unreadNotificationCount ? "icon-button has-unread" : "icon-button"
            }
            aria-label="Thông báo"
            title="Thông báo"
            onClick={onToggleNotifications}
          >
            <Bell size={18} />
            {unreadNotificationCount > 0 && (
              <span className="notification-badge">
                {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
              </span>
            )}
          </Button>
          {notificationsOpen && (
            <NotificationPopover
              items={notifications}
              onRead={onMarkNotificationRead}
              onReadAll={onMarkAllNotificationsRead}
              onOpenTask={onOpenTaskFromNotification}
              onClose={onCloseNotifications}
            />
          )}
        </div>
        <Button
          variant="icon"
          aria-label="Đổi giao diện"
          title={dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
          onClick={onToggleDark}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </Button>
        <Button
          variant="icon"
          aria-label="Cài đặt"
          title="Mở cài đặt workspace"
          onClick={onOpenSettings}
        >
          <Settings2 size={18} />
        </Button>
        <span className="avatar avatar-blue">T</span>
      </div>
    </header>
  );
}
