"use client";

import dynamic from "next/dynamic";
import {
  Bell,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
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
import { useEffect, useRef, useState, type FocusEvent, type RefObject } from "react";
import type { AppLocale } from "@/lib/i18n";
import type { SyncState } from "@/lib/repositories/task-repository";
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
  isOnline: boolean;
}) {
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const localeMenuRef = useRef<HTMLDivElement>(null);
  const localeTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!localeMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!localeMenuRef.current?.contains(event.target as Node)) {
        setLocaleMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [localeMenuOpen]);
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
      <button
        className="sidebar-collapse"
        aria-label={sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
        title={sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
        onClick={onToggleSidebar}
      >
        {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
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
        <button
          className="mobile-menu-button"
          aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
          title={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
          aria-expanded={mobileMenuOpen}
          onClick={onToggleMobileMenu}
        >
          {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
        {mobileMenuOpen && (
          <>
            <button
              className="mobile-nav-backdrop"
              aria-label="Đóng menu"
              onClick={onToggleMobileMenu}
            />
            <nav className="mobile-nav" aria-label="Điều hướng mobile">
              <div className="mobile-nav-header">
                <b>Menu</b>
                <button
                  className="mobile-nav-close"
                  aria-label="Đóng menu"
                  onClick={onToggleMobileMenu}
                >
                  <X size={17} />
                </button>
              </div>
              <button
                className={view === "overview" ? "active" : ""}
                onClick={() => onNavigate("/")}
              >
                <LayoutDashboard size={17} /> Tổng quan
              </button>
              <span className="nav-divider" aria-hidden="true" />
              <button
                className={view === "today" ? "active" : ""}
                onClick={() => onNavigate("/today")}
              >
                <CalendarDays size={17} /> Hôm nay <span>{counts.today}</span>
              </button>
              <span className="nav-divider" aria-hidden="true" />
              <button
                className={view === "drafts" ? "active" : ""}
                onClick={() => onNavigate("/drafts")}
              >
                <FilePenLine size={17} /> Bản nháp <span>{counts.drafts}</span>
              </button>
              <span className="nav-divider" aria-hidden="true" />
              <button
                className={view === "tasks" ? "active" : ""}
                onClick={() => onNavigate("/tasks")}
              >
                <ListTodo size={17} /> Danh sách task <span>{counts.active}</span>
              </button>
              <span className="nav-divider" aria-hidden="true" />
              <button
                className={view === "timeline" ? "active" : ""}
                onClick={() => onNavigate("/timeline")}
              >
                <CalendarRange size={17} /> Lịch & timeline
              </button>
            </nav>
          </>
        )}
        <button
          className="header-quick-capture primary-button"
          disabled={!canEdit}
          title="Ghi nhanh task (N)"
          aria-label="Ghi nhanh task (N)"
          onClick={onQuickCapture}
        >
          <Plus size={16} /> <span>Ghi nhanh</span> <kbd>N</kbd>
        </button>
        <div
          ref={localeMenuRef}
          className={`header-locale-wrap${localeMenuOpen ? " open" : ""}`}
          onBlur={(event: FocusEvent<HTMLDivElement>) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setLocaleMenuOpen(false);
            }
          }}
        >
          <button
            ref={localeTriggerRef}
            className="header-locale"
            type="button"
            title="Đổi ngôn ngữ"
            aria-label={`Ngôn ngữ: ${localeLabels[locale]}`}
            aria-haspopup="menu"
            aria-expanded={localeMenuOpen}
            aria-controls="locale-options"
            onClick={() => setLocaleMenuOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setLocaleMenuOpen(true);
                requestAnimationFrame(() =>
                  document
                    .querySelector<HTMLButtonElement>("#locale-options button")
                    ?.focus(),
                );
              }
            }}
          >
            <Languages size={16} aria-hidden="true" />
            <span>{localeLabels[locale]}</span>
            <ChevronDown
              className="header-locale-chevron"
              size={13}
              aria-hidden="true"
            />
          </button>
          {localeMenuOpen && (
            <div
              className="header-locale-menu"
              id="locale-options"
              role="menu"
              aria-label="Chọn ngôn ngữ"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setLocaleMenuOpen(false);
                  localeTriggerRef.current?.focus();
                  return;
                }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const options = Array.from(
                    event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
                  );
                  const currentIndex = options.indexOf(
                    document.activeElement as HTMLButtonElement,
                  );
                  const step = event.key === "ArrowDown" ? 1 : -1;
                  options[
                    (currentIndex + step + options.length) % options.length
                  ]?.focus();
                } else if (event.key === "Home" || event.key === "End") {
                  event.preventDefault();
                  const options =
                    event.currentTarget.querySelectorAll<HTMLButtonElement>("button");
                  (event.key === "Home"
                    ? options[0]
                    : options[options.length - 1]
                  )?.focus();
                }
              }}
            >
              {supportedLocales.map((supportedLocale) => (
                <button
                  key={supportedLocale}
                  className={`header-locale-option${locale === supportedLocale ? " selected" : ""}`}
                  type="button"
                  role="menuitemradio"
                  aria-checked={locale === supportedLocale}
                  onClick={() => {
                    onLocaleChange(supportedLocale as AppLocale);
                    setLocaleMenuOpen(false);
                    localeTriggerRef.current?.focus();
                  }}
                >
                  <span>{localeLabels[supportedLocale]}</span>
                  {locale === supportedLocale && <Check size={15} aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="header-utility-actions" aria-label="Công cụ workspace">
          {cloudConfigured && cloudUserEmail ? (
            <>
              <button
                className="icon-button"
                aria-label="Đẩy workspace lên cloud"
                title="Đẩy workspace lên cloud"
                onClick={() => void onSync("push")}
                disabled={syncState.status === "syncing"}
              >
                <CloudUpload size={17} />
              </button>
              <button
                className="icon-button"
                aria-label="Tải workspace từ cloud"
                title="Tải workspace từ cloud"
                onClick={() => void onSync("pull")}
                disabled={syncState.status === "syncing"}
              >
                <CloudDownload size={17} />
              </button>
            </>
          ) : cloudConfigured ? (
            <button
              className="icon-button"
              aria-label="Đăng nhập cloud"
              title="Đăng nhập cloud để đồng bộ workspace"
              onClick={() => onNavigate("/login")}
            >
              <LogIn size={17} />
            </button>
          ) : null}
          <button
            className="icon-button"
            aria-label="Tải dữ liệu"
            title="Tải dữ liệu"
            onClick={onExport}
          >
            <Download size={18} />
          </button>
        </div>
        <div className="notification-wrap" ref={notificationRef}>
          <button
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
          </button>
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
        <button
          className="icon-button"
          aria-label="Đổi giao diện"
          title={dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
          onClick={onToggleDark}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          className="icon-button"
          aria-label="Cài đặt"
          title="Mở cài đặt workspace"
          onClick={onOpenSettings}
        >
          <Settings2 size={18} />
        </button>
        <span className="avatar avatar-blue">T</span>
      </div>
    </header>
  );
}
