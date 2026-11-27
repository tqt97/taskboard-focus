"use client";

import { Button } from "@/app/_components/ui/Button";
import { useRef, useState } from "react";
import { Check, Clock3, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { Select } from "@/app/_components/ui/Select";
import { DialogFrame } from "@/app/_components/ui/DialogFrame";
import {
  createScreenLockConfig,
  defaultScreenLockConfig,
  type ScreenLockConfig,
  verifyPasscode,
} from "@/lib/taskboard/screen-lock";

const defaultPasscodeLength = 6;

export function ScreenLockGate({
  config,
  onConfigured,
  onUnlocked,
  onReset,
}: {
  config: ScreenLockConfig | null;
  onConfigured: (config: ScreenLockConfig) => Promise<void>;
  onUnlocked: () => void;
  onReset: () => Promise<void>;
}) {
  const [name, setName] = useState(defaultScreenLockConfig.displayName);
  const passcodeLength = defaultPasscodeLength;
  const acceptsLegacyPasscode = config?.legacyPasscodeLength === 4;
  const [digits, setDigits] = useState<string[]>(() =>
    config
      ? emptyDigits(passcodeLength)
      : setupDigits(defaultScreenLockConfig.passcode, defaultPasscodeLength),
  );
  const [minutes, setMinutes] = useState(defaultScreenLockConfig.autoLockMinutes);
  const [errors, setErrors] = useState<{ name?: string; passcode?: string }>({});
  const [showPasscode, setShowPasscode] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const setup = !config;
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const passcode = digits.join("");

  const updateDigits = (next: string[], focusIndex?: number) => {
    setDigits(next);
    setErrors((current) => ({ ...current, passcode: undefined }));
    if (focusIndex !== undefined) inputRefs.current[focusIndex]?.focus();
  };

  const handleDigitChange = (index: number, value: string) => {
    const pasted = value.replace(/\D/g, "").slice(0, passcodeLength);
    if (pasted.length > 1) {
      const next = setupDigits(pasted, passcodeLength);
      updateDigits(next, Math.min(pasted.length, passcodeLength - 1));
      return;
    }
    const next = [...digits];
    next[index] = pasted;
    updateDigits(next, pasted && index < passcodeLength - 1 ? index + 1 : undefined);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, passcodeLength);
    if (pasted)
      updateDigits(
        setupDigits(pasted, passcodeLength),
        Math.min(pasted.length, passcodeLength - 1),
      );
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = "";
      updateDigits(next, index - 1);
    }
    if (event.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < passcodeLength - 1)
      inputRefs.current[index + 1]?.focus();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: { name?: string; passcode?: string } = {};
    if (setup) {
      if (name.trim().length < 2) {
        nextErrors.name = "Tên hiển thị cần ít nhất 2 ký tự.";
      }
    }
    const validLength =
      passcode.length === passcodeLength ||
      (acceptsLegacyPasscode && passcode.length === 4);
    if (!validLength || /\D/.test(passcode)) {
      nextErrors.passcode = acceptsLegacyPasscode
        ? "Hãy nhập đủ 6 chữ số, hoặc nhập mã cũ 4 số để nâng cấp."
        : "Hãy nhập đủ 6 chữ số.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      if (nextErrors.name) return;
      inputRefs.current[digits.findIndex((digit) => !digit)]?.focus();
      return;
    }
    setBusy(true);
    try {
      if (setup) {
        await onConfigured(await createScreenLockConfig(name, passcode, minutes));
        return;
      }
      const valid = await verifyPasscode(config, passcode);
      if (!valid) {
        setDigits(emptyDigits(passcodeLength));
        setErrors({ passcode: "Passcode chưa đúng. Hãy thử lại." });
        inputRefs.current[0]?.focus();
        return;
      }
      onUnlocked();
    } catch {
      setErrors({
        passcode: "Không thể xử lý passcode lúc này. Hãy thử lại.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      portal
      panelAs="form"
      panelClassName="screen-lock-card"
      overlayClassName="screen-lock-gate"
      labelledBy="screen-lock-title"
      describedBy="screen-lock-description"
      onSubmit={submit}
    >
      <div className="screen-lock-icon">
        {setup ? <ShieldCheck size={25} /> : <LockKeyhole size={25} />}
      </div>
      <p className="eyebrow">TASKBOARD FOCUS</p>
      <h1 id="screen-lock-title">
        {setup ? "Thiết lập màn hình" : "Workspace đang khóa"}
      </h1>
      <p className="screen-lock-description" id="screen-lock-description">
        {setup
          ? "Tạo tên hiển thị và passcode để bảo vệ thao tác trên thiết bị này."
          : acceptsLegacyPasscode
            ? "Nhập 6 số mới, hoặc dùng mã cũ 4 số để mở khóa và nâng cấp."
            : "Nhập passcode để tiếp tục sử dụng workspace."}
      </p>
      {setup && (
        <label className={`screen-lock-field ${errors.name ? "has-error" : ""}`}>
          <span>Tên hiển thị</span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setErrors((current) => ({ ...current, name: undefined }));
            }}
            autoFocus
          />
          {errors.name && (
            <small className="screen-lock-field-error" role="alert">
              {errors.name}
            </small>
          )}
        </label>
      )}
      <div className={`screen-lock-field ${errors.passcode ? "has-error" : ""}`}>
        <div className="screen-lock-field-heading">
          <span>Passcode</span>
          <Button
            className="screen-lock-show-passcode"
            type="button"
            onClick={() => setShowPasscode((value) => !value)}
            aria-pressed={showPasscode}
          >
            {showPasscode ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{showPasscode ? "Ẩn passcode" : "Hiện passcode"}</span>
          </Button>
        </div>
        <div className="screen-lock-otp-row">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputRefs.current[index] = element;
              }}
              className="screen-lock-otp-input"
              type={showPasscode ? "text" : "password"}
              inputMode="numeric"
              autoFocus={!setup && index === 0}
              aria-label={`Passcode số ${index + 1}`}
              value={digit}
              maxLength={1}
              onChange={(event) => handleDigitChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              onPaste={handlePaste}
            />
          ))}
        </div>
        {errors.passcode && (
          <small className="screen-lock-field-error" role="alert">
            {errors.passcode}
          </small>
        )}
      </div>
      {setup && (
        <label className="screen-lock-field">
          <span>
            <Clock3 size={14} /> Tự khóa sau
          </span>
          <Select
            aria-label="Tự khóa sau"
            value={String(minutes)}
            options={[
              { value: "0", label: "Không tự khóa" },
              { value: "1", label: "1 phút không hoạt động" },
              { value: "5", label: "5 phút không hoạt động" },
              { value: "15", label: "15 phút không hoạt động" },
              { value: "30", label: "30 phút không hoạt động" },
              { value: "60", label: "60 phút không hoạt động" },
            ]}
            onValueChange={(value) => setMinutes(Number(value))}
          />
        </label>
      )}
      {setup && (
        <p className="screen-lock-default-note">
          <strong>Tạo passcode riêng cho thiết bị này</strong>
          <small>
            Đây là lớp khóa giao diện trên thiết bị, không thay thế đăng nhập cloud.
            Không dùng lại mã PIN dễ đoán.
          </small>
        </p>
      )}
      <Button
        variant="primary"
        className="screen-lock-submit"
        type="submit"
        disabled={busy}
      >
        <Check size={16} /> {setup ? "Bắt đầu sử dụng" : "Mở khóa"}
      </Button>
      {!setup && (
        <div className="screen-lock-reset">
          {!resetOpen ? (
            <Button
              variant="text"
              className="screen-lock-reset-trigger"
              type="button"
              onClick={() => setResetOpen(true)}
            >
              Quên passcode hoặc đang dùng mã cũ?
            </Button>
          ) : (
            <div className="screen-lock-reset-confirm">
              <p>
                Reset chỉ xóa khóa màn hình, không xóa task. Nhập <b>RESET</b> để xác
                nhận.
              </p>
              <input
                aria-label="Xác nhận reset passcode"
                value={resetConfirmation}
                onChange={(event) =>
                  setResetConfirmation(event.target.value.toUpperCase())
                }
                placeholder="RESET"
                autoCapitalize="characters"
                autoFocus
              />
              <div>
                <Button
                  variant="text"
                  type="button"
                  onClick={() => {
                    setResetOpen(false);
                    setResetConfirmation("");
                  }}
                >
                  Hủy
                </Button>
                <Button
                  variant="danger"
                  type="button"
                  disabled={resetConfirmation.trim() !== "RESET" || busy}
                  onClick={() => void onReset()}
                >
                  Reset khóa màn hình
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </DialogFrame>
  );
}

function setupDigits(value: string, length: number) {
  return Array.from({ length }, (_, index) => value[index] || "");
}

function emptyDigits(length: number) {
  return Array.from({ length }, () => "");
}
