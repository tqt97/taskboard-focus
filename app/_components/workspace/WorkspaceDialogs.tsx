"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Download,
  FileUp,
  LockKeyhole,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import type { BoardData, Member } from "@/lib/types";
import { localeLabels, supportedLocales, type AppLocale } from "@/lib/i18n";

export type ReminderSettings = {
  browserEnabled: boolean;
  leadDays: Record<"Deadline" | "Dev up" | "Staging up" | "Release", number>;
};

const reminderLabels = ["Deadline", "Dev up", "Staging up", "Release"] as const;
const safeSetLocalStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export function SettingsModal({
  data,
  tab,
  setTab,
  onMember,
  onClose,
  onExport,
  onImport,
  onClear,
  displayName,
  onDisplayName,
  reminderSettings,
  browserPermission,
  onReminderSettings,
  onRequestBrowserNotifications,
  onToast,
  locale,
  onLocaleChange,
}: {
  data: BoardData;
  tab: string;
  setTab: (s: string) => void;
  onMember: (m: Member) => void;
  onClose: () => void;
  onExport: () => void;
  onImport: (f?: File) => void;
  onClear: () => void;
  displayName: string;
  onDisplayName: (name: string) => void;
  reminderSettings: ReminderSettings;
  browserPermission: NotificationPermission | "unsupported";
  onReminderSettings: (settings: ReminderSettings) => void;
  onRequestBrowserNotifications: () => Promise<boolean>;
  onToast: (message: string) => void;
  locale: AppLocale;
  onLocaleChange: (locale: AppLocale) => void;
}) {
  const [newName, setNewName] = useState(""),
    [newRole, setNewRole] = useState("Developer"),
    [room, setRoom] = useState(() =>
      (() => {
        try {
          return typeof window === "undefined"
            ? ""
            : localStorage.getItem("taskboard-chatwork-room-id-v1") || "";
        } catch {
          return "";
        }
      })(),
    ),
    [chatworkTestState, setChatworkTestState] = useState<
      "idle" | "sending" | "success" | "error"
    >("idle"),
    [passcode, setPasscode] = useState(() =>
      (() => {
        try {
          return typeof window === "undefined"
            ? ""
            : localStorage.getItem("taskboard-lock-passcode-v1") || "";
        } catch {
          return "";
        }
      })(),
    );
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">WORKSPACE</span>
            <h2 id="settings-modal-title">Cài đặt</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        <div className="settings-tabs">
          {[
            ["members", "Đội ngũ"],
            ["notifications", "Thông báo"],
            ["integrations", "Tích hợp"],
            ["data", "Dữ liệu"],
            ["appearance", "Giao diện"],
          ].map(([k, v]) => (
            <button
              className={tab === k ? "selected" : ""}
              key={k}
              onClick={() => setTab(k)}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="settings-content">
          {tab === "members" && (
            <>
              <div className="setting-intro">
                <h3>Thành viên nhóm</h3>
                <p>Danh sách này dùng để gán người phụ trách task.</p>
              </div>
              {data.members.map((m) => (
                <div className="setting-member" key={m.id}>
                  <span className={`avatar avatar-${m.color}`}>
                    {m.name.slice(0, 1)}
                  </span>
                  <input
                    value={m.name}
                    onChange={(e) => onMember({ ...m, name: e.target.value })}
                  />
                  <input
                    value={m.role}
                    onChange={(e) => onMember({ ...m, role: e.target.value })}
                  />
                  <button
                    className={m.active ? "tiny-toggle on" : "tiny-toggle"}
                    onClick={() => onMember({ ...m, active: !m.active })}
                  >
                    {m.active ? "Đang hoạt động" : "Đã ẩn"}
                  </button>
                </div>
              ))}
              <div className="add-member">
                <input
                  placeholder="Tên thành viên"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <input
                  placeholder="Vai trò"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                />
                <button
                  className="secondary-button"
                  onClick={() => {
                    if (newName.trim()) {
                      onMember({
                        id: crypto.randomUUID(),
                        name: newName.trim(),
                        role: newRole,
                        color: ["blue", "violet", "orange", "green"][
                          data.members.length % 4
                        ],
                        active: true,
                      });
                      setNewName("");
                    }
                  }}
                >
                  <Plus size={15} /> Thêm
                </button>
              </div>
            </>
          )}
          {tab === "notifications" && (
            <>
              <div className="setting-intro">
                <h3>Nhắc mốc công việc</h3>
                <p>
                  Notification center luôn hiển thị mốc sắp đến. Browser reminder chỉ
                  chạy khi workspace đang mở và bạn đã cấp quyền trình duyệt.
                </p>
              </div>
              {reminderLabels.map((x) => (
                <div className="setting-row" key={x}>
                  <span>
                    <b>{x}</b>
                    <small>Nhắc trước khi đến hạn</small>
                  </span>
                  <select
                    value={reminderSettings.leadDays[x]}
                    onChange={(e) =>
                      onReminderSettings({
                        ...reminderSettings,
                        leadDays: {
                          ...reminderSettings.leadDays,
                          [x]: Number(e.target.value),
                        },
                      })
                    }
                  >
                    <option value="0">Đúng ngày</option>
                    <option value="1">1 ngày</option>
                    <option value="3">3 ngày</option>
                    <option value="7">7 ngày</option>
                  </select>
                </div>
              ))}
              <div className="setting-row notification-setting-row">
                <span>
                  <b>Thông báo trình duyệt</b>
                  <small>
                    {browserPermission === "unsupported"
                      ? "Trình duyệt không hỗ trợ"
                      : browserPermission === "denied"
                        ? "Đang bị chặn trong cài đặt trình duyệt"
                        : "Nhắc một lần cho mỗi mốc task"}
                  </small>
                </span>
                <button
                  className={
                    reminderSettings.browserEnabled
                      ? "toggle-switch on"
                      : "toggle-switch"
                  }
                  aria-label="Bật hoặc tắt thông báo trình duyệt"
                  aria-pressed={reminderSettings.browserEnabled}
                  disabled={
                    browserPermission === "denied" ||
                    browserPermission === "unsupported"
                  }
                  onClick={async () => {
                    if (reminderSettings.browserEnabled) {
                      onReminderSettings({
                        ...reminderSettings,
                        browserEnabled: false,
                      });
                    } else {
                      await onRequestBrowserNotifications();
                    }
                  }}
                />
              </div>
              <p className="muted-note">
                Chatwork test và gửi định kỳ cần token server-side. Cấu hình trong tab
                Tích hợp; lịch định kỳ production cần Cron/worker và kho dữ liệu remote.
              </p>
            </>
          )}
          {tab === "integrations" && (
            <>
              <div className="setting-intro">
                <h3>Kết nối dịch vụ</h3>
                <p>
                  Thông tin nhạy cảm phải đặt trong Environment Variables trên Vercel.
                </p>
              </div>
              <div className="integration-card">
                <div className="integration-logo chatwork">C</div>
                <div>
                  <b>Chatwork</b>
                  <small>Gửi thông báo mốc task đến room</small>
                </div>
                <span className="connection-status">Chưa cấu hình</span>
              </div>
              <label className="field">
                <span>
                  Room ID <small>(chỉ lưu tạm trên giao diện này)</small>
                </span>
                <input
                  value={room}
                  onChange={(e) => {
                    setRoom(e.target.value);
                    safeSetLocalStorage(
                      "taskboard-chatwork-room-id-v1",
                      e.target.value.trim(),
                    );
                  }}
                  placeholder="Ví dụ: 123456789"
                />
              </label>
              <button
                className="secondary-button integration-test-button"
                disabled={chatworkTestState === "sending" || !room.trim()}
                onClick={async () => {
                  setChatworkTestState("sending");
                  try {
                    const response = await fetch("/api/notifications/chatwork-test", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ roomId: room.trim() }),
                    });
                    const result = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(result.error || "Gửi thất bại");
                    setChatworkTestState("success");
                    onToast("Đã gửi thông báo test đến Chatwork.");
                  } catch (error) {
                    setChatworkTestState("error");
                    onToast(
                      error instanceof Error ? error.message : "Gửi Chatwork thất bại.",
                    );
                  }
                }}
              >
                <Send size={15} />
                {chatworkTestState === "sending" ? "Đang gửi..." : "Gửi thông báo test"}
              </button>
              {chatworkTestState === "success" && (
                <p className="integration-feedback success">Đã gửi thành công.</p>
              )}
              {chatworkTestState === "error" && (
                <p className="integration-feedback error">
                  Không gửi được. Kiểm tra token và Room ID.
                </p>
              )}
              <div className="integration-card">
                <div className="integration-logo gmail">G</div>
                <div>
                  <b>Gmail</b>
                  <small>Thông báo email (để sau MVP)</small>
                </div>
                <span className="connection-status later">Chưa kết nối</span>
              </div>
              <p className="muted-note">
                Không nhập API token vào đây. Thêm CHATWORK_API_TOKEN và
                CHATWORK_ROOM_ID vào Vercel Environment Variables để tích hợp ở server.
              </p>
            </>
          )}
          {tab === "data" && (
            <>
              <div className="setting-intro">
                <h3>Sao lưu và khôi phục</h3>
                <p>Chuyển dữ liệu workspace giữa máy tính bằng JSON.</p>
              </div>
              <div className="data-actions">
                <button className="secondary-button" onClick={onExport}>
                  <Download size={16} /> Xuất bản sao JSON
                </button>
                <label className="secondary-button upload-button">
                  <FileUp size={16} /> Nhập JSON
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => onImport(e.target.files?.[0])}
                  />
                </label>
              </div>
              <div className="data-summary">
                <span>
                  Task<strong>{data.tasks.length}</strong>
                </span>
                <span>
                  Thành viên<strong>{data.members.length}</strong>
                </span>
                <span>
                  Lưu trữ<strong>Local browser</strong>
                </span>
              </div>
              <button className="danger-button ghost" onClick={onClear}>
                <Trash2 size={15} /> Xóa toàn bộ dữ liệu local
              </button>
              <p className="muted-note">
                Nhập file thay thế toàn bộ dữ liệu đang có trên trình duyệt này. Hãy
                xuất backup trước.
              </p>
            </>
          )}
          {tab === "appearance" && (
            <>
              <div className="setting-intro">
                <h3>Hiển thị và bảo mật</h3>
                <p>
                  Tùy chỉnh thông tin hiển thị và passcode khóa màn hình trên thiết bị
                  này.
                </p>
              </div>
              <label className="field">
                <span>Tên hiển thị</span>
                <input
                  value={displayName}
                  onChange={(e) => onDisplayName(e.target.value)}
                  placeholder="Ví dụ: Tuấn"
                />
              </label>
              <label className="field settings-passcode">
                <span>
                  Passcode khóa màn hình{" "}
                  <small>Để trống để không yêu cầu mật khẩu</small>
                </span>
                <div className="passcode-row">
                  <input
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Để trống"
                  />
                  <button
                    className="secondary-button"
                    onClick={() => {
                      if (safeSetLocalStorage("taskboard-lock-passcode-v1", passcode)) {
                        onClose();
                      } else {
                        onToast("Không thể lưu passcode; hãy kiểm tra quyền lưu.");
                      }
                    }}
                  >
                    Lưu passcode
                  </button>
                </div>
              </label>
              <div className="setting-row">
                <span>
                  <b>Ngôn ngữ</b>
                  <small>Ngôn ngữ ứng dụng</small>
                </span>
                <select
                  value={locale}
                  onChange={(event) => onLocaleChange(event.target.value as AppLocale)}
                >
                  {supportedLocales.map((supportedLocale) => (
                    <option key={supportedLocale} value={supportedLocale}>
                      {localeLabels[supportedLocale]}
                    </option>
                  ))}
                </select>
              </div>
              <p className="muted-note">
                Dark mode có thể bật nhanh bằng biểu tượng mặt trăng ở thanh trên cùng.
              </p>
            </>
          )}
        </div>
        <footer className="modal-footer">
          <span />
          <button className="primary-button" onClick={onClose}>
            Hoàn tất
          </button>
        </footer>
      </section>
    </div>
  );
}
export function ConfirmDialog({
  title,
  body,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="overlay confirm-overlay">
      <section
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="confirm-icon">
          <AlertTriangle size={22} />
        </div>
        <h3 id="confirm-dialog-title">{title}</h3>
        <p>{body}</p>
        <footer>
          <button className="secondary-button" onClick={onCancel}>
            Hủy
          </button>
          <button className="danger-button" onClick={onConfirm}>
            Xác nhận
          </button>
        </footer>
      </section>
    </div>
  );
}
export function LockModal({
  onClose,
  onToast,
}: {
  onClose: () => void;
  onToast: (s: string) => void;
}) {
  const [pass, setPass] = useState("");
  return (
    <div className="overlay">
      <section
        className="confirm-dialog lock-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lock-dialog-title"
      >
        <div className="confirm-icon">
          <LockKeyhole size={22} />
        </div>
        <h3 id="lock-dialog-title">Khóa màn hình</h3>
        <p>
          Màn hình khóa tiện lợi phía client. Không thay thế đăng nhập và không bảo vệ
          dữ liệu API.
        </p>
        <input
          type="password"
          placeholder="Nhập passcode để mở"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
        <footer>
          <button className="secondary-button" onClick={onClose}>
            Đóng
          </button>
          <button
            className="primary-button"
            onClick={() => {
              const expected = localStorage.getItem("taskboard-lock-passcode-v1") || "";
              if (!expected || pass === expected) {
                sessionStorage.setItem(
                  "taskboard-unlocked-until",
                  String(Date.now() + 3600000),
                );
                onToast(
                  expected
                    ? "Đã mở khóa trong 1 giờ"
                    : "Đã mở khóa; passcode đang để trống",
                );
                onClose();
              } else onToast("Passcode chưa đúng");
            }}
          >
            Mở khóa
          </button>
        </footer>
      </section>
    </div>
  );
}
