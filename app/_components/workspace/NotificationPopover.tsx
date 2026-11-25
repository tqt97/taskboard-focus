"use client";
import { AlertTriangle, Bell, Check, CheckCheck, Clock3, X } from "lucide-react";

export type BoardNotification = {
  id: string;
  taskId: string;
  title: string;
  detail: string;
  overdue: boolean;
  read: boolean;
};

export function NotificationPopover({
  items,
  onRead,
  onReadAll,
  onOpenTask,
  onClose,
}: {
  items: BoardNotification[];
  onRead: (id: string) => void;
  onReadAll: () => void;
  onOpenTask: (taskId: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="notification-popover">
      <header>
        <div>
          <b>Thông báo</b>
          <small>
            {items.filter((item) => !item.read).length
              ? `${items.filter((item) => !item.read).length} chưa xem`
              : "Bạn đã xem hết"}
          </small>
        </div>
        <div className="notification-actions">
          <button
            aria-label="Đánh dấu tất cả đã xem"
            onClick={onReadAll}
            disabled={!items.some((item) => !item.read)}
            title="Đánh dấu tất cả đã xem"
          >
            <CheckCheck size={15} />
          </button>
          <button onClick={onClose} aria-label="Đóng thông báo" title="Đóng thông báo">
            <X size={15} />
          </button>
        </div>
      </header>
      {items.length ? (
        <div className="notification-list">
          {items.map((item) => (
            <button
              className={item.read ? "notification-row read" : "notification-row"}
              key={item.id}
              onClick={() => {
                onRead(item.id);
                onOpenTask(item.taskId);
              }}
            >
              <span
                className={
                  item.overdue ? "notification-icon overdue" : "notification-icon"
                }
              >
                {item.overdue ? <AlertTriangle size={15} /> : <Clock3 size={15} />}
              </span>
              <span>
                <b>{item.title}</b>
                <small>{item.detail}</small>
              </span>
              {item.read ? (
                <Check size={14} className="notification-read" />
              ) : (
                <i className="unread-dot" />
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="notification-empty">
          <Bell size={20} />
          <span>Chưa có deadline cần chú ý.</span>
        </div>
      )}
    </div>
  );
}
