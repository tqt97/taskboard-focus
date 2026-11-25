"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPassword } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signInWithPassword(email.trim(), password);
      router.push("/tasks");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Đăng nhập thất bại.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <span className="eyebrow">TASKBOARD · CLOUD</span>
        <h1>Đăng nhập workspace</h1>
        <p>Chỉ dùng account cá nhân đã được tạo trong Supabase Auth.</p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
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
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
        <button className="text-button" type="button" onClick={() => router.push("/")}>
          Tiếp tục local
        </button>
      </form>
    </main>
  );
}
