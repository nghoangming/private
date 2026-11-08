"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ActivatePage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("token") ?? ""); }, []);
  const activate = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/v1/auth/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      if (!response.ok) { const body = await response.json().catch(() => null) as { message?: string } | null; throw new Error(body?.message ?? "Không thể kích hoạt tài khoản."); }
      setDone(true); setMessage("Tài khoản đã được kích hoạt. Bạn có thể đăng nhập.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Không thể kích hoạt tài khoản."); }
    finally { setBusy(false); }
  };
  return <main className="auth-page" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}><section className="ws-profile-dialog" style={{ width: "min(480px, 90vw)" }}><h1>Kích hoạt tài khoản</h1><p>Đặt mật khẩu để hoàn tất xác thực email.</p>{!token ? <p role="alert">Liên kết xác thực không hợp lệ.</p> : done ? <Link href="/login">Đến trang đăng nhập</Link> : <form className="ws-form" onSubmit={activate}><label className="ws-field">Mật khẩu mới<input type="password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></label><button className="ws-button" disabled={busy}>Kích hoạt</button></form>}{message && <p role="status">{message}</p>}</section></main>;
}
