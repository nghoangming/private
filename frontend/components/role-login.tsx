"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Building2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { demoAccounts, demoAuth, rolePath, type Role } from "@/lib/demo-auth";

export function RoleLogin({ admin = false }: { admin?: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(admin ? "ADMIN" : "STUDENT");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);
  const chooseDemo = (next: Role) => { const account = demoAccounts.find(item => item.role === next); if (account) { setRole(next); setEmail(account.email); setPassword(""); setError(""); } };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setBusy(true);
    try { const account = await demoAuth.signIn(email, password, role); router.replace(rolePath(account.role)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể đăng nhập. Vui lòng thử lại."); }
    finally { setBusy(false); }
  };
  return <main className="auth-page"><div className="auth-visual"><div className="auth-visual-shade" /><div className="auth-visual-content"><Link href="/" className="auth-back"><ArrowLeft size={16} /> Về trang chủ</Link><div className="auth-visual-bottom"><span className="eyebrow">TDTU SMART CAMPUS / KHÔNG GIAN CHO TƯƠNG LAI</span><h1>Một không gian.<br /><em>Muôn khả năng.</em></h1><p>Kết nối lịch học, phòng học và mọi trải nghiệm trong khuôn viên trường — tất cả bắt đầu tại đây.</p><div className="auth-visual-rule"><span>01</span><div /><span>03</span></div></div></div></div><div className="auth-form-side"><div className="auth-mobile-top"><Link href="/" className="brand"><span className="brand-icon"><Building2 size={21} /></span><span className="brand-name">TDTU <strong>Smart Campus</strong><small>KHÔNG GIAN CHO TƯƠNG LAI</small></span></Link></div><div className="auth-form-wrap"><div className="auth-kicker"><span /> CỔNG THÔNG TIN TDTU</div><h2>{admin ? "Chào mừng Quản trị viên." : "Chào mừng trở lại."}</h2><p className="auth-subtitle">{admin ? "Truy cập không gian quản trị campus của bạn." : "Đăng nhập để tiếp tục hành trình học tập của bạn."}</p>{!admin && <div className="auth-role-picker" role="group" aria-label="Chọn vai trò"><button type="button" className={role === "STUDENT" ? "selected" : ""} onClick={() => { setRole("STUDENT"); setError(""); }}><UserRound size={19} /> Sinh viên</button><button type="button" className={role === "TEACHER" ? "selected" : ""} onClick={() => { setRole("TEACHER"); setError(""); }}><BookOpen size={19} /> Giảng viên</button></div>}{admin && <div className="auth-admin-label"><ShieldCheck size={18} /> Khu vực dành riêng cho Quản trị viên</div>}
    <form onSubmit={submit} className="auth-fields"><label>Email TDTU<span className="auth-input"><Mail size={18} /><input type="email" autoComplete="username" placeholder="tenban@tdtu.edu.vn" required value={email} onChange={e => setEmail(e.target.value)} /></span></label><label>Mật khẩu<span className="auth-input"><LockKeyhole size={18} /><input type={visible ? "text" : "password"} autoComplete="current-password" placeholder="Nhập mật khẩu" minLength={6} required value={password} onChange={e => setPassword(e.target.value)} /><button type="button" aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label><button className="auth-forgot" type="button" onClick={() => setForgot(!forgot)}>Quên mật khẩu?</button>{forgot && <div className="auth-help" role="status">Chức năng khôi phục mật khẩu chưa được hỗ trợ. Liên hệ quản trị viên.</div>}{error && <div className="auth-error" role="alert">{error}</div>}<button type="submit" className="auth-submit" disabled={busy}>{busy ? "Đang xác thực..." : "Đăng nhập"}<ArrowRight size={18} /></button></form>
    <div className="demo-credentials"><strong>THỬ TÀI KHOẢN MINH HỌA</strong><p>Nhấn để điền email mẫu, sau đó nhập mật khẩu của tài khoản.</p><div className="demo-accounts">{demoAccounts.filter(item => admin ? item.role === "ADMIN" : item.role !== "ADMIN").map(item => <button key={item.role} type="button" onClick={() => chooseDemo(item.role)}><span>{item.role === "ADMIN" ? "Quản trị" : item.role === "TEACHER" ? "Giảng viên" : "Sinh viên"}</span><small>{item.email}</small><ArrowRight size={14} /></button>)}</div></div><div className="auth-switch">{admin ? <>Không phải Quản trị viên? <Link href="/login">Đăng nhập Sinh viên / Giảng viên</Link></> : <>Bạn là Quản trị viên? <Link href="/admin/login">Đăng nhập Quản trị</Link></>}</div></div><span className="auth-copyright">© 2026 TDTU Smart Campus · Giao diện minh họa</span></div></main>;
}
