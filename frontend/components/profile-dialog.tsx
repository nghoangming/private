"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { campusApi } from "@/lib/campus-api";
import type { DemoAccount } from "@/lib/demo-auth";

export function ProfileDialog({ account, close, signOut, updated }: { account: DemoAccount; close: () => void; signOut: () => void; updated: (name: string) => void }) {
  const { data, error, mutate } = useSWR(`profile-${account.id}`, campusApi.myProfile);
  const [section, setSection] = useState<"profile" | "security">("profile");
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setName(data.name); }, [data]);
  const saveName = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try { const saved = await campusApi.updateProfile(name); updated(saved.name); await mutate(saved); setMessage("Đã lưu hồ sơ."); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Không thể lưu hồ sơ."); }
    finally { setBusy(false); }
  };
  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try { await campusApi.changePassword(currentPassword, newPassword); setCurrentPassword(""); setNewPassword(""); setMessage("Đã đổi mật khẩu."); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Không thể đổi mật khẩu."); }
    finally { setBusy(false); }
  };
  return <div className="ws-seat-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><section className="ws-detail ws-profile-dialog" role="dialog" aria-modal="true" aria-label="Tài khoản của tôi"><div className="ws-detail-head"><div><span className="ws-section-kicker">TÀI KHOẢN CỦA TÔI</span><h3>{data?.name ?? account.name}</h3><p>{account.email}</p></div><button type="button" className="ws-row-action" onClick={close}>Đóng</button></div><div className="ws-inline-actions"><button type="button" className={`ws-button ${section === "profile" ? "" : "secondary"}`} onClick={() => { setSection("profile"); setMessage(""); }}>Hồ sơ</button><button type="button" className={`ws-button ${section === "security" ? "" : "secondary"}`} onClick={() => { setSection("security"); setMessage(""); }}>Bảo mật</button></div>{error && <p className="ws-form-error">Không thể tải hồ sơ.</p>}{section === "profile" ? <form className="ws-form" onSubmit={saveName}><label className="ws-field">Họ và tên<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label><div className="ws-detail-grid"><div><small>MÃ TÀI KHOẢN</small><strong>{data?.code ?? "—"}</strong></div><div><small>EMAIL</small><strong>{data?.email ?? account.email}</strong></div><div><small>KHOA</small><strong>{data?.faculty ?? "Chưa cập nhật"}</strong></div></div><button className="ws-button" disabled={busy || !data}>Lưu hồ sơ</button></form> : <form className="ws-form" onSubmit={savePassword}><label className="ws-field">Mật khẩu hiện tại<input type="password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label><label className="ws-field">Mật khẩu mới<input type="password" required minLength={8} value={newPassword} onChange={event => setNewPassword(event.target.value)} /></label><button className="ws-button" disabled={busy}>Đổi mật khẩu</button></form>}{message && <p role="status">{message}</p>}<button type="button" className="ws-button secondary" onClick={signOut}>Đăng xuất</button></section></div>;
}
