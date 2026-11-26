"use client";

import { useRef, useState } from "react";
import { Check, Clock3, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import {
  createScreenLockConfig,
  defaultScreenLockConfig,
  type ScreenLockConfig,
  verifyPasscode,
} from "@/lib/taskboard/screen-lock";

export function ScreenLockGate({
  config,
  onConfigured,
  onUnlocked,
}: {
  config: ScreenLockConfig | null;
  onConfigured: (config: ScreenLockConfig) => Promise<void>;
  onUnlocked: () => void;
}) {
  const [name, setName] = useState(defaultScreenLockConfig.displayName);
  const [digits, setDigits] = useState<string[]>(() =>
    config ? emptyDigits() : setupDigits(defaultScreenLockConfig.passcode),
  );
  const [minutes, setMinutes] = useState(defaultScreenLockConfig.autoLockMinutes);
  const [errors, setErrors] = useState<{ name?: string; passcode?: string }>({});
  const [showPasscode, setShowPasscode] = useState(false);
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
    const pasted = value.replace(/\D/g, "").slice(0, 4);
    if (pasted.length > 1) {
      const next = setupDigits(pasted);
      updateDigits(next, Math.min(pasted.length, 3));
      return;
    }
    const next = [...digits];
    next[index] = pasted;
    updateDigits(next, pasted && index < 3 ? index + 1 : undefined);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted) updateDigits(setupDigits(pasted), Math.min(pasted.length, 3));
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
    if (event.key === "ArrowRight" && index < 3) inputRefs.current[index + 1]?.focus();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: { name?: string; passcode?: string } = {};
    if (setup) {
      if (name.trim().length < 2) {
        nextErrors.name = "Tên hiển thị cần ít nhất 2 ký tự.";
      }
    }
    if (!/^\d{4}$/.test(passcode)) {
      nextErrors.passcode = "Hãy nhập đủ 4 chữ số.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      if (nextErrors.name) return;
      inputRefs.current[digits.findIndex((digit) => !digit)]?.focus();
      return;
    }
    setBusy(true);
    if (setup) {
      await onConfigured(await createScreenLockConfig(name, passcode, minutes));
      setBusy(false);
      return;
    }
    const valid = await verifyPasscode(config, passcode);
    setBusy(false);
    if (!valid) {
      setDigits(["", "", "", ""]);
      setErrors({ passcode: "Passcode chưa đúng. Hãy thử lại." });
      inputRefs.current[0]?.focus();
      return;
    }
    onUnlocked();
  };

  return (
    <div className="screen-lock-gate" role="presentation">
      <form
        className="screen-lock-card"
        role="dialog"
        aria-modal="true"
        onSubmit={submit}
      >
        <div className="screen-lock-icon">
          {setup ? <ShieldCheck size={25} /> : <LockKeyhole size={25} />}
        </div>
        <p className="eyebrow">TASKBOARD FOCUS</p>
        <h1>{setup ? "Thiết lập màn hình" : "Workspace đang khóa"}</h1>
        <p className="screen-lock-description">
          {setup
            ? "Tạo tên hiển thị và passcode để bảo vệ thao tác trên thiết bị này."
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
              <small className="screen-lock-field-error">{errors.name}</small>
            )}
          </label>
        )}
        <div className={`screen-lock-field ${errors.passcode ? "has-error" : ""}`}>
          <div className="screen-lock-field-heading">
            <span>Passcode</span>
            <button
              className="screen-lock-show-passcode"
              type="button"
              onClick={() => setShowPasscode((value) => !value)}
              aria-pressed={showPasscode}
            >
              {showPasscode ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{showPasscode ? "Ẩn passcode" : "Hiện passcode"}</span>
            </button>
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
            <select
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
            >
              <option value={0}>Không tự khóa</option>
              <option value={1}>1 phút không hoạt động</option>
              <option value={5}>5 phút không hoạt động</option>
              <option value={15}>15 phút không hoạt động</option>
              <option value={30}>30 phút không hoạt động</option>
              <option value={60}>60 phút không hoạt động</option>
            </select>
          </label>
        )}
        {setup && (
          <p className="screen-lock-default-note">
            <strong>Mặc định tiện lợi</strong>
            <span className="screen-lock-default-values">
              <span>
                <small>Tên hiển thị</small>
                <b>Anonymous</b>
              </span>
              <span>
                <small>Passcode</small>
                <b>1234</b>
              </span>
            </span>
            <small>Bạn nên đổi passcode trước khi dùng dữ liệu nhạy cảm.</small>
          </p>
        )}
        <button
          className="primary-button screen-lock-submit"
          type="submit"
          disabled={busy}
        >
          <Check size={16} /> {setup ? "Bắt đầu sử dụng" : "Mở khóa"}
        </button>
      </form>
    </div>
  );
}

function setupDigits(value: string) {
  return Array.from({ length: 4 }, (_, index) => value[index] || "");
}

function emptyDigits() {
  return ["", "", "", ""];
}
