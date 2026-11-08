"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, Bell, BookOpen, Building2, CalendarDays, Check, ChevronDown, CircleAlert, ClipboardCheck, DoorOpen, LayoutDashboard, LogOut, Menu, QrCode, Search, ShieldCheck, UsersRound, Wrench, X } from "lucide-react";
import { demoAuth, rolePath, type DemoAccount, type Role } from "@/lib/demo-auth";
import { demoCampusApi } from "@/lib/demo-campus";
import { campusApi } from "@/lib/campus-api";
import type { WorkspaceContext, WorkspaceData } from "@/lib/workspace-types";
import { roleName } from "@/lib/workspace-types";
import { AdminViews } from "@/components/admin-views";
import { LearningViews } from "@/components/learning-views";

const nav = {
  ADMIN: [{ id: "overview", title: "Tổng quan", icon: LayoutDashboard }, { id: "rooms", title: "Phòng & thiết bị", icon: DoorOpen }, { id: "bookings", title: "Yêu cầu đặt phòng", icon: CalendarDays }, { id: "users", title: "Người dùng", icon: UsersRound }, { id: "incidents", title: "Sự cố", icon: Wrench }],
  TEACHER: [{ id: "overview", title: "Tổng quan", icon: LayoutDashboard }, { id: "schedule", title: "Lịch giảng dạy", icon: CalendarDays }, { id: "bookings", title: "Đặt phòng", icon: DoorOpen }, { id: "attendance", title: "Điểm danh", icon: ClipboardCheck }, { id: "incidents", title: "Báo cáo sự cố", icon: Wrench }],
  STUDENT: [{ id: "overview", title: "Tổng quan", icon: LayoutDashboard }, { id: "schedule", title: "Lịch của tôi", icon: CalendarDays }, { id: "bookings", title: "Đặt phòng tự học", icon: DoorOpen }, { id: "seats", title: "Tìm chỗ ngồi", icon: Search }, { id: "checkin", title: "Check-in QR", icon: QrCode }],
};
const headings: Record<Role, { title: string; subtitle: string; kicker: string }> = {
  ADMIN: { title: "Vận hành campus, trong tầm tay.", subtitle: "Một góc nhìn rõ ràng cho mọi không gian, lịch đặt và yêu cầu hỗ trợ.", kicker: "KHÔNG GIAN QUẢN TRỊ" },
  TEACHER: { title: "Mỗi buổi dạy, thật trọn vẹn.", subtitle: "Lịch giảng, phòng học và lớp của bạn — cùng một nơi để chuẩn bị tốt hơn.", kicker: "KHÔNG GIAN GIẢNG VIÊN" },
  STUDENT: { title: "Học tập theo cách của bạn.", subtitle: "Theo dõi lịch học, tìm chỗ ngồi và sẵn sàng cho buổi học tiếp theo.", kicker: "KHÔNG GIAN SINH VIÊN" },
};

export function RoleWorkspace({ role }: { role: Role }) {
  const router = useRouter();
  const [account, setAccount] = useState<DemoAccount | null>(null);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [pendingAction, setPendingAction] = useState<{ title: string; detail: string; action: () => void } | null>(null);
  const [edits, setEdits] = useState<Partial<WorkspaceData>>({});
  const { data: source, error, isLoading, mutate } = useSWR(account ? `campus-live-${role}-${account.id}` : null, async (): Promise<WorkspaceData> => {
    const [apiRooms, apiReservations, apiSessions, incidents, users, equipment] = await Promise.all([campusApi.rooms(), campusApi.reservations(), campusApi.sessions(), demoCampusApi.incidents(), demoCampusApi.users(), demoCampusApi.equipment()]);
    const rooms = apiRooms.map(room => ({ ...room, status: room.status as "ACTIVE" | "MAINTENANCE" }));
    const reservations = apiReservations.map(reservation => ({ ...reservation, roomCode: rooms.find(room => room.id === reservation.roomId)?.code }));
    const sessions = apiSessions.map(session => ({ id: session.id, bookingId: session.bookingId, subject: session.title, className: session.courseCode, roomId: session.roomId, roomCode: rooms.find(room => room.id === session.roomId)?.code ?? "", startTime: session.startTime, endTime: session.endTime, status: "Sắp diễn ra" as const, calendarStatus: session.calendarStatus ?? "SCHEDULED" as const, teacherId: reservations.find(booking => booking.id === session.bookingId)?.userId ?? 2 }));
    const seats: WorkspaceData["seats"] = [];
    return { rooms, reservations, seats, incidents, sessions, users, equipment };
  }, { revalidateOnMount: true, revalidateOnFocus: true, refreshInterval: 30000 });
  useEffect(() => { const current = demoAuth.current(); setAccount(current); setChecked(true); if (!current) router.replace(role === "ADMIN" ? "/admin/login" : "/login"); else if (current.role !== role) router.replace("/forbidden"); }, [role, router]);
  useEffect(() => { setEdits({}); }, [role, account?.id]);
  useEffect(() => { if (source) setEdits({}); }, [source]);
  const items = nav[role];
  const data: WorkspaceData | null = source ? { ...source, ...edits } : null;
  const go = (next: string) => { setTab(next); setMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const flash = (text: string) => { setNotice(text); window.setTimeout(() => setNotice(""), 5000); };
  const update: WorkspaceContext["update"] = (key, next) => setEdits(previous => ({ ...previous, [key]: next }));
  const context: WorkspaceContext | null = account && data ? { role, account, data, update, notice: flash, confirm: (title, detail, action) => setPendingAction({ title, detail, action }), navigate: go } : null;
  const signOut = () => { demoAuth.signOut(); router.replace(role === "ADMIN" ? "/admin/login" : "/login"); };
  if (!checked || !account || account.role !== role) return <main className="ws-loading" role="status">Đang kiểm tra phiên đăng nhập...</main>;
  const displayName = account.name.startsWith("Demo ") ? roleName[role] : account.name;
  return <div className="ws-root"><header className="ws-header"><div className="ws-header-main"><Link href="/" className="ws-brand"><span className="ws-brand-icon"><Building2 size={20} /></span><span>TDTU <strong>Smart Campus</strong><small>KHÔNG GIAN CHO TƯƠNG LAI</small></span></Link><div className="ws-header-right"><div className="ws-user"><span className="ws-avatar">{displayName.slice(0, 1)}</span><span><strong>{displayName}</strong><small>{roleName[role]}</small></span></div><button type="button" className="ws-logout" onClick={signOut} title="Đăng xuất" aria-label="Đăng xuất"><LogOut size={18} /></button></div><button type="button" className="ws-mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Đóng menu" : "Mở menu"} aria-expanded={menuOpen}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button></div><nav className={`ws-nav ${menuOpen ? "open" : ""}`} aria-label="Điều hướng theo vai trò">{items.map(item => <button type="button" key={item.id} onClick={() => go(item.id)} className={tab === item.id ? "active" : ""} aria-current={tab === item.id ? "page" : undefined}><item.icon size={16} />{item.title}</button>)}<button type="button" className="ws-mobile-signout" onClick={signOut}><LogOut size={16} /> Đăng xuất</button></nav></header>
    <main className="ws-main"><div className="ws-topline"><span>TRANG CHỦ <ArrowRight size={12} /> {roleName[role].toUpperCase()} <ArrowRight size={12} /> {items.find(item => item.id === tab)?.title.toUpperCase()}</span><span className="ws-topline-date">{new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "long", year: "numeric" }).format(new Date())}</span></div><section className="ws-hero"><div className="ws-hero-copy"><span className="ws-hero-kicker"><span /> {headings[role].kicker}</span><h1>Xin chào, {displayName}</h1><h2>{headings[role].title}</h2><p>{headings[role].subtitle}</p></div><div className="ws-hero-architecture" aria-hidden="true"><span /><span /><span /><span /></div><div className="ws-hero-role">{roleName[role]} / TDTU</div></section><div className="ws-content-head"><div><span className="ws-section-kicker">{headings[role].kicker} / {items.find(item => item.id === tab)?.title.toUpperCase()}</span><h2>{items.find(item => item.id === tab)?.title}</h2></div></div>
    {isLoading && <div className="ws-empty" role="status">Đang tải dữ liệu...</div>}
    {error && !source && <div className="ws-empty" role="alert"><CircleAlert size={28} /><h3>Không thể tải dữ liệu</h3><p>{error instanceof Error ? error.message : "Vui lòng thử lại."}</p><button className="ws-button" onClick={() => mutate()}>Tải lại</button></div>}
    {context && (role === "ADMIN" ? <AdminViews tab={tab} context={context} /> : <LearningViews tab={tab} context={context} />)}
    <footer className="ws-footer"><span>© {new Date().getFullYear()} TDTU Smart Campus</span><Link href="/">Về trang chủ <ArrowRight size={14} /></Link></footer></main>
    {notice && <div className="ws-toast" role="status"><Check size={17} />{notice}<button type="button" onClick={() => setNotice("")} aria-label="Đóng thông báo"><X size={15} /></button></div>}
    {pendingAction && <div className="ws-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setPendingAction(null); }}><div role="alertdialog" aria-modal="true" aria-labelledby="ws-confirm-title" aria-describedby="ws-confirm-detail" className="ws-dialog"><span className="ws-dialog-icon"><ShieldCheck size={23} /></span><h2 id="ws-confirm-title">{pendingAction.title}</h2><p id="ws-confirm-detail">{pendingAction.detail}</p><div className="ws-dialog-actions"><button className="ws-button secondary" onClick={() => setPendingAction(null)}>Quay lại</button><button className="ws-button" onClick={() => { pendingAction.action(); setPendingAction(null); }}>Xác nhận <ArrowRight size={16} /></button></div></div></div>}
  </div>;
}
