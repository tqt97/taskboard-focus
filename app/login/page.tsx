"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { requestEmailOtp, signInWithPassword, verifyEmailOtp } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase-config";

type LoginMode = "password" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const otpValue = otp.join("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const resetFeedback = () => {
    setError("");
    setNotice("");
  };

  const switchMode = (nextMode: LoginMode) => {
    setMode(nextMode);
    setOtpSent(false);
    setOtp(["", "", "", "", "", ""]);
    setCooldown(0);
    resetFeedback();
  };

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    setBusy(true);
    try {
      await signInWithPassword(email.trim(), password);
      router.push("/tasks");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Đăng nhập thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async () => {
    resetFeedback();
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Hãy nhập email hợp lệ trước khi nhận mã OTP.");
      return;
    }
    setBusy(true);
    try {
      await requestEmailOtp(email.trim());
      setOtpSent(true);
      setCooldown(30);
      setNotice("Mã OTP đã được gửi. Hãy kiểm tra email của bạn.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể gửi mã OTP.");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    if (otpValue.length !== 6) {
      setError("Hãy nhập đủ 6 chữ số trong mã OTP.");
      return;
    }
    setBusy(true);
    try {
      await verifyEmailOtp(email.trim(), otpValue);
      router.push("/tasks");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Mã OTP không hợp lệ.");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  };

  const updateOtp = (index: number, value: string) => {
    const next = [...otp];
    const digits = value.replace(/\D/g, "").slice(0, 6);
    if (digits.length > 1) {
      digits.split("").forEach((digit, offset) => {
        if (index + offset < 6) next[index + offset] = digit;
      });
      setOtp(next);
      otpRefs.current[Math.min(index + digits.length, 5)]?.focus();
      return;
    }
    next[index] = digits;
    setOtp(next);
    if (digits && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const content =
    mode === "password" ? (
      <form className="auth-form" onSubmit={submitPassword}>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Mật khẩu</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="primary-button" disabled={busy} type="submit">
          <KeyRound size={16} /> {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    ) : (
      <form className="auth-form" onSubmit={verifyOtp}>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            required
            disabled={otpSent}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {!otpSent ? (
          <button
            className="primary-button"
            disabled={busy}
            type="button"
            onClick={sendOtp}
          >
            <Mail size={16} /> {busy ? "Đang gửi mã…" : "Gửi mã OTP"}
          </button>
        ) : (
          <>
            <div className="otp-field">
              <span>Nhập mã OTP 6 số</span>
              <div className="auth-otp-row">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      otpRefs.current[index] = element;
                    }}
                    aria-label={`OTP số ${index + 1}`}
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(event) => updateOtp(index, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Backspace" && !otp[index] && index > 0) {
                        otpRefs.current[index - 1]?.focus();
                      }
                    }}
                  />
                ))}
              </div>
            </div>
            <button className="primary-button" disabled={busy} type="submit">
              <Check size={16} /> {busy ? "Đang xác thực…" : "Xác nhận OTP"}
            </button>
            <button
              className="text-button"
              type="button"
              disabled={busy || cooldown > 0}
              onClick={sendOtp}
            >
              {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : "Gửi lại mã OTP"}
            </button>
          </>
        )}
      </form>
    );

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <span className="eyebrow">TASKBOARD · CLOUD</span>
        <div className="auth-heading-icon">
          <ShieldCheck size={22} />
        </div>
        <h1 id="login-title">Đăng nhập workspace</h1>
        <p>Đăng nhập bằng mật khẩu hoặc mã OTP gửi tới email Supabase Auth.</p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="form-notice" role="status">
            {notice}
          </div>
        )}
        {isSupabaseConfigured && (
          <div
            className="auth-mode-tabs"
            role="tablist"
            aria-label="Phương thức đăng nhập"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "password"}
              className={mode === "password" ? "selected" : ""}
              onClick={() => switchMode("password")}
            >
              Mật khẩu
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "otp"}
              className={mode === "otp" ? "selected" : ""}
              onClick={() => switchMode("otp")}
            >
              OTP email
            </button>
          </div>
        )}
        {content}
        <button className="text-button" type="button" onClick={() => router.push("/")}>
          <ArrowLeft size={14} /> Tiếp tục local
        </button>
        {!isSupabaseConfigured && (
          <small className="auth-hint">
            OTP chỉ khả dụng khi đã cấu hình Supabase.
          </small>
        )}
      </section>
    </main>
  );
}
