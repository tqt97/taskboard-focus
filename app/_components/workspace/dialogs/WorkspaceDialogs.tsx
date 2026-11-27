"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CircleCheck,
  CircleX,
  Download,
  Eye,
  EyeOff,
  FileUp,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import type { BoardData, Member } from "@/lib/types";
import {
  indexedDbBoardStorage,
  type LocalBackupSummary,
} from "@/lib/storage/indexed-db-board-storage";
import type { RemoteWorkspaceMember } from "@/lib/repositories/task-repository";
import { getAccessToken } from "@/lib/auth";
import { Select } from "@/app/_components/ui/Select";
import { Button } from "@/app/_components/ui/Button";
import { DialogFrame } from "@/app/_components/ui/DialogFrame";
import { DialogHeader } from "@/app/_components/ui/DialogHeader";
import type { TaskTemplate } from "@/lib/types";
import { TemplateManagerPanel } from "./TemplateManagerPanel";
import { SettingsTabs } from "./SettingsTabs";
import type { ScreenLockConfig } from "@/lib/taskboard/screen-lock";
import styles from "./WorkspaceDialogs.module.css";

export type ReminderSettings = {
  browserEnabled: boolean;
  pushEnabled: boolean;
  leadDays: Record<"Deadline" | "Dev up" | "Staging up" | "Release", number>;
  quietHours: { start: string; end: string };
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
  onDeleteMember,
  canManageMembers = true,
  onClose,
  onExport,
  onImport,
  onClear,
  workspaceId,
  onRestoreBackup,
  displayName,
  onDisplayName,
  screenLockConfig,
  onUpdateScreenLock,
  reminderSettings,
  browserPermission,
  onReminderSettings,
  onRequestBrowserNotifications,
  onTogglePushNotifications,
  onToast,
  remoteMembers = [],
  canManageRemoteMembers = false,
  onRemoteMemberRole,
  onRemoveRemoteMember,
  onInviteRemoteMember,
  templates = [],
  canManageTemplates = false,
  onRenameTemplate,
  onDeleteTemplate,
}: {
  data: BoardData;
  tab: string;
  setTab: (s: string) => void;
  onMember: (m: Member) => void;
  onDeleteMember?: (memberId: string) => Promise<void> | void;
  canManageMembers?: boolean;
  onClose: () => void;
  onExport: () => void;
  onImport: (f?: File) => void;
  onClear: () => void;
  workspaceId: string;
  onRestoreBackup: (data: BoardData) => void;
  displayName: string;
  onDisplayName: (name: string) => void;
  screenLockConfig: ScreenLockConfig | null;
  onUpdateScreenLock: (passcode: string, autoLockMinutes: number) => Promise<void>;
  reminderSettings: ReminderSettings;
  browserPermission: NotificationPermission | "unsupported";
  onReminderSettings: (settings: ReminderSettings) => void;
  onRequestBrowserNotifications: () => Promise<boolean>;
  onTogglePushNotifications: (enabled: boolean) => Promise<boolean>;
  onToast: (message: string) => void;
  remoteMembers?: RemoteWorkspaceMember[];
  canManageRemoteMembers?: boolean;
  onRemoteMemberRole?: (
    userId: string,
    role: RemoteWorkspaceMember["role"],
  ) => Promise<void>;
  onRemoveRemoteMember?: (userId: string) => Promise<void>;
  onInviteRemoteMember?: (
    email: string,
    role: RemoteWorkspaceMember["role"],
  ) => Promise<void>;
  templates?: TaskTemplate[];
  canManageTemplates?: boolean;
  onRenameTemplate?: (id: string, name: string) => boolean;
  onDeleteTemplate?: (id: string) => boolean;
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
          return "";
        } catch {
          return "";
        }
      })(),
    ),
    [showPasscode, setShowPasscode] = useState(false),
    [passcodeError, setPasscodeError] = useState(""),
    [autoLockMinutes, setAutoLockMinutes] = useState(
      screenLockConfig?.autoLockMinutes ?? 15,
    ),
    [remoteUserId, setRemoteUserId] = useState(""),
    [inviteEmail, setInviteEmail] = useState(""),
    [inviteRole, setInviteRole] = useState<RemoteWorkspaceMember["role"]>("member"),
    [memberToDelete, setMemberToDelete] = useState<string | null>(null),
    [deletingMemberId, setDeletingMemberId] = useState<string | null>(null),
    [inviteSending, setInviteSending] = useState(false);
  return (
    <DialogFrame
      panelClassName={`modal settings-modal ${styles.settingsScope}`}
      labelledBy="settings-modal-title"
      onBackdropClick={onClose}
      onEscape={onClose}
    >
      <DialogHeader
        eyebrow="WORKSPACE"
        titleId="settings-modal-title"
        title="Cài đặt"
        closeLabel="Đóng cài đặt"
        onClose={onClose}
      />
      <div className="settings-layout">
        <SettingsTabs tab={tab} onChange={setTab} />
        <div
          className="settings-content"
          role="tabpanel"
          id={`settings-panel-${tab}`}
          aria-labelledby={`settings-tab-${tab}`}
          tabIndex={0}
        >
          {tab === "templates" && (
            <>
              <div className="setting-intro">
                <h3>Template công việc</h3>
                <p>
                  Quản lý các mẫu task dùng lại trong workspace. Khi tạo task, bạn vẫn
                  có thể chọn template ngay cạnh luồng tạo mới.
                </p>
              </div>
              {!canManageTemplates && (
                <div className="empty-small">
                  Bạn chỉ có quyền xem workspace này; các template không thể chỉnh sửa.
                </div>
              )}
              <TemplateManagerPanel
                templates={templates}
                onRename={onRenameTemplate ?? (() => false)}
                onDelete={onDeleteTemplate ?? (() => false)}
                readOnly={!canManageTemplates}
              />
            </>
          )}
          {tab === "members" && (
            <>
              <div className="setting-intro">
                <h3>Thành viên nhóm</h3>
                <p>Danh sách này dùng để gán người phụ trách task.</p>
              </div>
              {(remoteMembers.length > 0 || canManageRemoteMembers) && (
                <div className="remote-members-panel">
                  <div className="setting-intro">
                    <h4>Quyền thành viên cloud</h4>
                    <p>
                      Mời bằng email sẽ gửi lời mời qua Supabase Auth và gán quyền ngay
                      khi tài khoản được tạo. User ID vẫn dùng được cho tài khoản đã có.
                    </p>
                  </div>
                  {remoteMembers.map((member) => (
                    <div className="remote-member-row" key={member.user_id}>
                      <code>{member.user_id}</code>
                      <Select
                        aria-label={`Quyền cloud của ${member.user_id}`}
                        disabled={!canManageRemoteMembers || member.role === "owner"}
                        value={member.role}
                        options={[
                          { value: "owner", label: "Owner" },
                          { value: "admin", label: "Admin" },
                          { value: "member", label: "Member" },
                          { value: "viewer", label: "Viewer" },
                        ]}
                        onValueChange={(value) =>
                          void onRemoteMemberRole?.(
                            member.user_id,
                            value as RemoteWorkspaceMember["role"],
                          )
                        }
                      />
                      <Button
                        variant="icon"
                        className="mini danger-action"
                        type="button"
                        title="Xóa thành viên cloud"
                        aria-label={`Xóa thành viên ${member.user_id}`}
                        disabled={!canManageRemoteMembers || member.role === "owner"}
                        onClick={() => void onRemoveRemoteMember?.(member.user_id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                  {canManageRemoteMembers && (
                    <div className="remote-member-invite">
                      <input
                        aria-label="Email thành viên mới"
                        type="email"
                        placeholder="email@example.com"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                      />
                      <Select
                        aria-label="Quyền thành viên được mời"
                        value={inviteRole}
                        options={[
                          { value: "admin", label: "Admin" },
                          { value: "member", label: "Member" },
                          { value: "viewer", label: "Viewer" },
                        ]}
                        onValueChange={(value) =>
                          setInviteRole(value as RemoteWorkspaceMember["role"])
                        }
                      />
                      <Button
                        variant="secondary"
                        type="button"
                        disabled={!inviteEmail.trim() || inviteSending}
                        onClick={async () => {
                          setInviteSending(true);
                          try {
                            await onInviteRemoteMember?.(
                              inviteEmail.trim(),
                              inviteRole,
                            );
                            setInviteEmail("");
                          } finally {
                            setInviteSending(false);
                          }
                        }}
                      >
                        <Send size={14} />{" "}
                        {inviteSending ? "Đang gửi…" : "Mời qua email"}
                      </Button>
                    </div>
                  )}
                  {canManageRemoteMembers && (
                    <div className="remote-member-add">
                      <input
                        aria-label="Supabase user ID mới"
                        placeholder="Supabase user ID"
                        value={remoteUserId}
                        onChange={(event) => setRemoteUserId(event.target.value)}
                      />
                      <Button
                        variant="secondary"
                        type="button"
                        disabled={!remoteUserId.trim()}
                        onClick={() => {
                          void onRemoteMemberRole?.(remoteUserId.trim(), "member");
                          setRemoteUserId("");
                        }}
                      >
                        <Plus size={14} /> Thêm member
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {data.members.map((m) => (
                <div className="setting-member" key={m.id}>
                  <span className={`avatar avatar-${m.color}`}>
                    {m.name.slice(0, 1)}
                  </span>
                  <input
                    aria-label={`Tên thành viên ${m.name}`}
                    value={m.name}
                    disabled={!canManageMembers}
                    onChange={(e) => onMember({ ...m, name: e.target.value })}
                  />
                  <input
                    aria-label={`Vai trò công việc của ${m.name}`}
                    value={m.role}
                    disabled={!canManageMembers}
                    onChange={(e) => onMember({ ...m, role: e.target.value })}
                  />
                  <Select
                    aria-label={`Quyền workspace của ${m.name}`}
                    disabled={!canManageMembers}
                    value={m.access_role || "member"}
                    options={[
                      { value: "owner", label: "Owner" },
                      { value: "admin", label: "Admin" },
                      { value: "member", label: "Member" },
                      { value: "viewer", label: "Viewer" },
                    ]}
                    onValueChange={(value) =>
                      onMember({
                        ...m,
                        access_role: value as NonNullable<Member["access_role"]>,
                      })
                    }
                  />
                  <Button
                    variant="icon"
                    className={
                      m.active
                        ? "mini member-status-toggle active"
                        : "mini member-status-toggle"
                    }
                    type="button"
                    aria-label={
                      m.active ? `Ẩn thành viên ${m.name}` : `Hiện thành viên ${m.name}`
                    }
                    aria-pressed={m.active}
                    title={m.active ? "Ẩn thành viên" : "Hiện thành viên"}
                    disabled={!canManageMembers}
                    onClick={() => onMember({ ...m, active: !m.active })}
                  >
                    {m.active ? <CircleCheck size={16} /> : <CircleX size={16} />}
                  </Button>
                  {memberToDelete === m.id ? (
                    <>
                      <Button
                        variant="danger"
                        className="mini danger-action"
                        type="button"
                        aria-label={`Xác nhận xóa ${m.name}`}
                        disabled={deletingMemberId === m.id}
                        onClick={async () => {
                          setDeletingMemberId(m.id);
                          try {
                            await onDeleteMember?.(m.id);
                            setMemberToDelete(null);
                          } finally {
                            setDeletingMemberId(null);
                          }
                        }}
                      >
                        {deletingMemberId === m.id ? "Đang xóa…" : "Xóa"}
                      </Button>
                      <Button
                        variant="icon"
                        className="mini"
                        type="button"
                        aria-label={`Hủy xóa ${m.name}`}
                        disabled={deletingMemberId === m.id}
                        onClick={() => setMemberToDelete(null)}
                      >
                        <X size={14} />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="icon"
                      className="mini danger-action"
                      type="button"
                      aria-label={`Xóa thành viên ${m.name}`}
                      title={`Xóa thành viên ${m.name}`}
                      disabled={!canManageMembers}
                      onClick={() => setMemberToDelete(m.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              ))}
              <div className="add-member">
                <input
                  aria-label="Tên thành viên mới"
                  placeholder="Tên thành viên"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <input
                  aria-label="Vai trò thành viên mới"
                  placeholder="Vai trò"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                />
                <Button
                  variant="secondary"
                  type="button"
                  disabled={!canManageMembers}
                  onClick={() => {
                    if (newName.trim()) {
                      onMember({
                        id: crypto.randomUUID(),
                        name: newName.trim(),
                        role: newRole,
                        access_role: "member",
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
                </Button>
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
                  <Select
                    aria-label={`Nhắc trước: ${x}`}
                    value={String(reminderSettings.leadDays[x])}
                    options={[
                      { value: "0", label: "Đúng ngày" },
                      { value: "1", label: "1 ngày" },
                      { value: "3", label: "3 ngày" },
                      { value: "7", label: "7 ngày" },
                    ]}
                    onValueChange={(value) =>
                      onReminderSettings({
                        ...reminderSettings,
                        leadDays: {
                          ...reminderSettings.leadDays,
                          [x]: Number(value),
                        },
                      })
                    }
                  />
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
                <Button
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
              <div className="setting-row notification-setting-row">
                <span>
                  <b>Nhắc nền khi đóng app</b>
                  <small>
                    {reminderSettings.pushEnabled
                      ? "Đã đăng ký push cho tài khoản owner"
                      : "Cần đăng nhập và cấu hình VAPID trên server"}
                  </small>
                </span>
                <Button
                  className={
                    reminderSettings.pushEnabled ? "toggle-switch on" : "toggle-switch"
                  }
                  aria-label="Bật hoặc tắt nhắc nền"
                  aria-pressed={reminderSettings.pushEnabled}
                  disabled={browserPermission === "unsupported"}
                  onClick={async () => {
                    await onTogglePushNotifications(!reminderSettings.pushEnabled);
                  }}
                />
              </div>
              {browserPermission === "denied" && (
                <p className="muted-note notification-permission-help">
                  Để bật lại: mở quyền trang web từ biểu tượng cạnh thanh địa chỉ, cho
                  phép Thông báo, rồi quay lại ứng dụng. Nếu dùng ứng dụng đã cài, kiểm
                  tra quyền thông báo của ứng dụng trong cài đặt hệ điều hành.
                </p>
              )}
              <div className="setting-row quiet-hours-row">
                <span>
                  <b>Quiet hours</b>
                  <small>Không hiện browser reminder trong khoảng này</small>
                </span>
                <div className="quiet-hours-inputs">
                  <input
                    type="time"
                    aria-label="Bắt đầu quiet hours"
                    value={reminderSettings.quietHours.start}
                    onChange={(e) =>
                      onReminderSettings({
                        ...reminderSettings,
                        quietHours: {
                          ...reminderSettings.quietHours,
                          start: e.target.value,
                        },
                      })
                    }
                  />
                  <span>đến</span>
                  <input
                    type="time"
                    aria-label="Kết thúc quiet hours"
                    value={reminderSettings.quietHours.end}
                    onChange={(e) =>
                      onReminderSettings({
                        ...reminderSettings,
                        quietHours: {
                          ...reminderSettings.quietHours,
                          end: e.target.value,
                        },
                      })
                    }
                  />
                </div>
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
              <Button
                variant="secondary"
                className="integration-test-button"
                disabled={chatworkTestState === "sending" || !room.trim()}
                onClick={async () => {
                  setChatworkTestState("sending");
                  try {
                    const accessToken = await getAccessToken();
                    if (!accessToken) {
                      throw new Error("Đăng nhập bằng tài khoản owner để gửi test.");
                    }
                    const response = await fetch("/api/notifications/chatwork-test", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${accessToken}`,
                      },
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
              </Button>
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
                <Button variant="secondary" onClick={onExport}>
                  <Download size={16} /> Xuất bản sao JSON
                </Button>
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
              <LocalBackupList workspaceId={workspaceId} onRestore={onRestoreBackup} />
              <Button variant="danger" className="ghost" onClick={onClear}>
                <Trash2 size={15} /> Xóa toàn bộ dữ liệu local
              </Button>
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
                  <small>Để trống nếu giữ passcode hiện tại · 6 chữ số</small>
                </span>
                <div className="passcode-row">
                  <input
                    type={showPasscode ? "text" : "password"}
                    inputMode="numeric"
                    aria-label="Passcode mới"
                    value={passcode}
                    maxLength={6}
                    onChange={(e) => {
                      setPasscode(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setPasscodeError("");
                    }}
                    placeholder="123456"
                  />
                  <Button
                    variant="icon"
                    type="button"
                    aria-label={showPasscode ? "Ẩn passcode mới" : "Hiện passcode mới"}
                    title={showPasscode ? "Ẩn passcode mới" : "Hiện passcode mới"}
                    onClick={() => setShowPasscode((value) => !value)}
                  >
                    {showPasscode ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (passcode && passcode.length !== 6) {
                        setPasscodeError("Passcode mới phải gồm đúng 6 chữ số.");
                        return;
                      }
                      void onUpdateScreenLock(passcode, autoLockMinutes);
                    }}
                  >
                    <Check size={15} />
                    Lưu bảo mật
                  </Button>
                </div>
                {passcodeError && (
                  <small className="field-error">{passcodeError}</small>
                )}
              </label>
              <label className="field">
                <span>Thời gian tự khóa</span>
                <Select
                  aria-label="Thời gian tự khóa"
                  value={String(autoLockMinutes)}
                  options={[
                    { value: "0", label: "Không tự khóa" },
                    { value: "1", label: "Sau 1 phút không hoạt động" },
                    { value: "5", label: "Sau 5 phút không hoạt động" },
                    { value: "15", label: "Sau 15 phút không hoạt động" },
                    { value: "30", label: "Sau 30 phút không hoạt động" },
                    { value: "60", label: "Sau 60 phút không hoạt động" },
                  ]}
                  onValueChange={(value) => setAutoLockMinutes(Number(value))}
                />
              </label>
              <p className="muted-note">
                Dark mode có thể bật nhanh bằng biểu tượng mặt trăng ở thanh trên cùng.
              </p>
            </>
          )}
        </div>
      </div>
      <footer className="modal-footer">
        <span />
        <Button variant="primary" onClick={onClose}>
          <Check size={15} />
          Hoàn tất
        </Button>
      </footer>
    </DialogFrame>
  );
}

function LocalBackupList({
  workspaceId,
  onRestore,
}: {
  workspaceId: string;
  onRestore: (data: BoardData) => void;
}) {
  const [backups, setBackups] = useState<LocalBackupSummary[]>([]);

  useEffect(() => {
    void indexedDbBoardStorage.listBackups(workspaceId).then(setBackups);
  }, [workspaceId]);

  return (
    <section className="local-backups" aria-label="Bản sao tự động trên thiết bị">
      <div>
        <b>Bản sao tự động trên thiết bị</b>
        <small>
          Giữ 7 bản gần nhất, mỗi ngày một bản. Dùng khi cần khôi phục dữ liệu.
        </small>
      </div>
      {backups.length ? (
        <ul>
          {backups.map((backup) => (
            <li key={backup.key}>
              <span>
                {new Intl.DateTimeFormat("vi-VN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(backup.createdAt))}
              </span>
              <Button
                variant="text"
                onClick={async () => {
                  const snapshot = await indexedDbBoardStorage.loadBackup(backup.key);
                  if (!snapshot) return;
                  onRestore(snapshot.data);
                }}
              >
                Xem và khôi phục
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <small>Chưa có bản sao; ứng dụng sẽ tạo sau lần lưu dữ liệu đầu tiên.</small>
      )}
    </section>
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
    <DialogFrame
      overlayClassName="confirm-overlay"
      panelClassName="confirm-dialog"
      labelledBy="confirm-dialog-title"
      onEscape={onCancel}
    >
      <div className="confirm-icon">
        <AlertTriangle size={22} />
      </div>
      <h3 id="confirm-dialog-title">{title}</h3>
      <p>{body}</p>
      <footer>
        <Button variant="secondary" onClick={onCancel}>
          <X size={15} />
          Hủy
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          <Trash2 size={15} />
          Xác nhận
        </Button>
      </footer>
    </DialogFrame>
  );
}
