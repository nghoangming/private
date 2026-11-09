"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { ArrowRight, CalendarDays, DoorOpen, Plus, Search, UsersRound, Wrench } from "lucide-react";
import type { Incident, Reservation, Room } from "@/lib/admin-data";
import type { WorkspaceContext } from "@/lib/workspace-types";
import { bookingName, incidentName, roleName, viDate, viTime } from "@/lib/workspace-types";
import { campusApi } from "@/lib/campus-api";
import { RoomApiDetails, ReservationApiDetails } from "@/components/api-details";

const category: Record<Incident["category"], string> = { PROJECTOR: "Máy chiếu", AC: "Điều hòa", LIGHTING: "Chiếu sáng", SOUND: "Âm thanh", OTHER: "Khác" };
const input = (label: string, name: string, value = "", props: React.InputHTMLAttributes<HTMLInputElement> = {}) => <label className="ws-field">{label}<input name={name} defaultValue={value} required {...props} /></label>;
function Status({ text, tone }: { text: string; tone: string }) { return <span className={`ws-tag ${tone.toLowerCase()}`}>{text}</span>; }
function Blank({ text = "Chưa có kết quả phù hợp. Hãy thử bộ lọc khác." }: { text?: string }) { return <div className="ws-empty"><Search size={25} /><h3>Chưa có dữ liệu</h3><p>{text}</p></div>; }
function PageNav({ page, total, onPage }: { page: number; total: number; onPage: (next: number) => void }) {
  const pages = Math.ceil(total / 5);
  if (pages <= 1) return null;
  return <nav className="ws-pagination" aria-label="Phân trang danh sách"><span>Hiển thị {(page - 1) * 5 + 1}–{Math.min(page * 5, total)} / {total}</span><div><button type="button" disabled={page === 1} onClick={() => onPage(page - 1)} aria-label="Trang trước">‹</button>{Array.from({ length: pages }, (_, index) => <button type="button" key={index} className={page === index + 1 ? "active" : ""} aria-current={page === index + 1 ? "page" : undefined} onClick={() => onPage(index + 1)}>{index + 1}</button>)}<button type="button" disabled={page === pages} onClick={() => onPage(page + 1)} aria-label="Trang sau">›</button></div></nav>;
}

export function AdminViews({ tab, context: c }: { tab: string; context: WorkspaceContext }) {
  const { rooms, reservations, incidents } = c.data;
  if (tab === "overview") {
    const metrics = [
      { label: "Phòng đang hoạt động", value: rooms.filter(x => x.status === "ACTIVE").length, sub: `${rooms.filter(x => x.status === "MAINTENANCE").length} phòng đang bảo trì`, icon: DoorOpen, tab: "rooms" },
      { label: "Yêu cầu chờ duyệt", value: reservations.filter(x => x.status === "PENDING").length, sub: "Cần kiểm tra lịch phòng", icon: CalendarDays, tab: "bookings" },
      { label: "Người dùng", value: c.data.users.length, sub: "Tài khoản trong hệ thống", icon: UsersRound, tab: "users" },
      { label: "Sự cố chưa xử lý", value: incidents.filter(x => x.status !== "RESOLVED").length, sub: "Cần theo dõi", icon: Wrench, tab: "incidents" },
    ];
    return <><div className="ws-overview">{metrics.map(x => <button type="button" key={x.label} className="ws-metric" onClick={() => c.navigate(x.tab)}><span className="ws-metric-icon"><x.icon size={18} /></span><ArrowRight size={14} className="ws-metric-arrow" /><span className="ws-metric-label">{x.label}</span><strong>{String(x.value).padStart(2, "0")}</strong><small>{x.sub}</small></button>)}</div><div className="ws-columns"><div className="ws-panel"><div className="ws-panel-header"><div><h3>Hoạt động gần đây</h3><p>Các yêu cầu đặt phòng và báo cáo mới nhất</p></div><button className="ws-row-action" onClick={() => c.navigate("bookings")}>Xem tất cả <ArrowRight size={14} /></button></div><div className="ws-activity">{reservations.slice(0, 3).map(x => <div className="ws-activity-row" key={x.id}><span className="ws-activity-icon"><CalendarDays size={16} /></span><div><strong>Yêu cầu #{x.id} · {x.roomCode}</strong><small>{bookingName[x.status]} · {viDate(x.startTime)} · {viTime(x.startTime)}</small></div><Status text={bookingName[x.status]} tone={x.status} /></div>)}{incidents.slice(0, 2).map(x => <div className="ws-activity-row" key={x.id}><span className="ws-activity-icon"><Wrench size={16} /></span><div><strong>Sự cố #{x.id} · {x.roomCode}</strong><small>{category[x.category]} · {x.reporterName}</small></div><Status text={incidentName[x.status]} tone={x.status} /></div>)}</div></div></div></>;
  }
  if (tab === "rooms") return <RoomsView context={c} />;
  if (tab === "bookings") return <BookingsView context={c} />;
  if (tab === "users") return <UsersView context={c} />;
  return <AdminIncidents context={c} />;
}

function RoomsView({ context: c }: { context: WorkspaceContext }) {
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState("ALL"); const [selected, setSelected] = useState<number | null>(null); const [form, setForm] = useState<"create" | "edit" | null>(null); const [error, setError] = useState("");
  const room = c.data.rooms.find(x => x.id === selected);
  const visible = c.data.rooms.filter(x => (filter === "ALL" || x.status === filter) && `${x.code} ${x.name} ${x.location}`.toLowerCase().includes(query.toLowerCase()));
  const saveRoom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const data = {
      code: String(values.get("code") ?? "").trim().toUpperCase(),
      name: String(values.get("name") ?? "").trim(),
      location: String(values.get("location") ?? "").trim(),
      capacity: Number(values.get("capacity")),
      status: (values.get("status") === "MAINTENANCE" ? "MAINTENANCE" : "ACTIVE") as "ACTIVE" | "MAINTENANCE",
      type: String(values.get("type") ?? "THEORY") as "THEORY" | "LAB" | "STUDY",
    };
    if (!data.code || !data.name || !Number.isInteger(data.capacity) || data.capacity < 1 || data.capacity > 10000) {
      setError("Vui lòng điền mã, tên và sức chứa từ 1 đến 10000."); return;
    }
    try {
      const saved = form === "edit" && room ? await campusApi.updateRoom(room.id, data) : await campusApi.createRoom(data);
      c.update("rooms", form === "edit" ? c.data.rooms.map(x => x.id === saved.id ? saved : x) : [saved, ...c.data.rooms]);
      setSelected(saved.id); setForm(null); setError("");
      c.notice(`Đã ${form === "edit" ? "cập nhật" : "tạo"} phòng ${saved.code} trên backend.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể lưu phòng."); }
  };
  return <><div className="ws-tools"><div className="ws-tools-left"><label className="ws-search"><Search size={16} /><input aria-label="Tìm phòng" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm mã phòng, tên hoặc tòa nhà..." /></label><select className="ws-select" aria-label="Lọc trạng thái phòng" value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="MAINTENANCE">Bảo trì</option></select></div><button className="ws-button" onClick={() => { setSelected(null); setForm("create"); setError(""); }}><Plus size={15} /> Thêm phòng</button></div><div className="ws-card-grid">{visible.map(x => <article className="ws-room-card" key={x.id} data-selected={selected === x.id}><div className="ws-room-card-top"><span className="ws-room-code">{x.code}</span><Status text={x.status === "ACTIVE" ? "Hoạt động" : "Bảo trì"} tone={x.status} /></div><div className="ws-room-card-body"><h3>{x.name}</h3><p>{x.location} · {x.capacity} chỗ</p><button className="ws-row-action" onClick={() => { setSelected(x.id); setForm(null); }}>Xem chi tiết & thiết bị <ArrowRight size={14} /></button></div></article>)}</div>{visible.length === 0 && <Blank />}
  {form && <div className="ws-admin-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setForm(null); }}><section className="ws-detail ws-admin-editor" role="dialog" aria-modal="true" aria-label={form === "create" ? "Thêm phòng mới" : `Chỉnh sửa phòng ${room?.code}`}><div className="ws-detail-head"><div><span className="ws-section-kicker">PHÒNG HỌC / BIỂU MẪU</span><h3>{form === "create" ? "Thêm phòng mới" : `Chỉnh sửa phòng ${room?.code}`}</h3></div><button className="ws-row-action" onClick={() => setForm(null)}>Đóng</button></div><form className="ws-form" onSubmit={saveRoom}>{input("Mã phòng", "code", form === "edit" ? room?.code : "", { maxLength: 20 })}{input("Tên phòng", "name", form === "edit" ? room?.name : "", { maxLength: 100 })}{input("Vị trí", "location", form === "edit" ? room?.location : "", { maxLength: 120 })}{input("Sức chứa", "capacity", form === "edit" ? String(room?.capacity ?? "") : "", { type: "number", min: 1, max: 10000 })}<label className="ws-field">Loại phòng<select name="type" defaultValue={form === "edit" ? room?.type : "THEORY"}><option value="THEORY">Phòng lý thuyết</option><option value="LAB">Phòng thực hành</option><option value="STUDY">Phòng tự học</option></select></label><label className="ws-field">Trạng thái<select name="status" defaultValue={form === "edit" ? room?.status : "ACTIVE"}><option value="ACTIVE">Hoạt động</option><option value="MAINTENANCE">Bảo trì</option></select></label><div className="ws-form-note">Loại phòng và sức chứa sẽ được lưu trên backend; các ghế tương ứng được tạo trong cơ sở dữ liệu.</div>{error && <div className="ws-form-error" role="alert">{error}</div>}<div className="ws-form-actions"><button type="button" className="ws-button secondary" onClick={() => setForm(null)}>Hủy</button><button className="ws-button" type="submit">{form === "create" ? "Tạo phòng" : "Lưu thay đổi"}</button></div></form></section></div>}
  {room && !form && <div className="ws-admin-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}><section className="ws-detail ws-room-dialog" role="dialog" aria-modal="true" aria-label={`Chi tiết phòng ${room.code}`}><div className="ws-detail-head"><div><span className="ws-section-kicker">CHI TIẾT PHÒNG / {room.code}</span><h3>{room.name}</h3><p>{room.location}</p></div><button className="ws-row-action" onClick={() => setSelected(null)}>Đóng</button></div><div className="ws-detail-grid"><div><small>MÃ PHÒNG</small><strong>{room.code}</strong></div><div><small>SỨC CHỨA</small><strong>{room.capacity} chỗ</strong></div><div><small>TRẠNG THÁI</small><Status text={room.status === "ACTIVE" ? "Hoạt động" : "Bảo trì"} tone={room.status} /></div></div>{error && <div className="ws-form-error" role="alert">{error}</div>}<RoomApiDetails id={room.id} /><div className="ws-inline-actions" style={{ marginTop: 18 }}><button className="ws-button secondary" onClick={() => { setForm("edit"); setError(""); }}>Chỉnh sửa thông tin</button><button className="ws-button secondary" onClick={() => c.confirm("Đổi trạng thái phòng?", `Phòng ${room.code} sẽ chuyển sang ${room.status === "ACTIVE" ? "bảo trì" : "hoạt động"} trên backend.`, async () => { try { const saved = await campusApi.updateRoom(room.id, { code: room.code, name: room.name, location: room.location, type: room.type ?? "THEORY", capacity: room.capacity ?? 1, status: room.status === "ACTIVE" ? "MAINTENANCE" : "ACTIVE" }); c.update("rooms", c.data.rooms.map(x => x.id === saved.id ? saved : x)); c.notice("Đã cập nhật trạng thái phòng trên backend."); } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể đổi trạng thái phòng."); } })}>{room.status === "ACTIVE" ? "Chuyển sang bảo trì" : "Mở lại phòng"}</button></div><details className="ws-resource-section"><summary><span><strong>Thiết bị & tài nguyên</strong><small>{c.data.equipment.filter(x => x.roomId === room.id).length} thiết bị · Thay đổi chỉ lưu trong phiên làm việc</small></span><span className="ws-resource-toggle">Mở quản lý</span></summary><div className="ws-resource-content">{c.data.equipment.filter(x => x.roomId === room.id).map(x => <div className="ws-activity-row" key={x.id}><span className="ws-activity-icon"><Wrench size={15} /></span><div><strong>{x.name}</strong><small>{x.status}</small></div><button className="ws-row-action" onClick={() => { c.update("equipment", c.data.equipment.map(item => item.id === x.id ? { ...item, status: item.status === "Tốt" ? "Cần kiểm tra" : "Tốt" } : item)); c.notice("Thay đổi thiết bị hiện chỉ lưu trong phiên làm việc."); }}>Đổi trạng thái</button></div>)}{!c.data.equipment.some(x => x.roomId === room.id) && <p>Chưa có thiết bị cho phòng này.</p>}<form className="ws-inline-actions" style={{ marginTop: 16 }} onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); const name = String(values.get("equipment") ?? "").trim(); if (!name) return; c.update("equipment", [...c.data.equipment, { id: Math.max(0, ...c.data.equipment.map(x => x.id)) + 1, roomId: room.id, name, status: "Tốt" }]); form.reset(); c.notice("Thiết bị hiện chỉ lưu trong phiên làm việc."); }}><label className="ws-field">Thêm thiết bị / tài nguyên<input name="equipment" required minLength={2} maxLength={80} placeholder="VD: Máy chiếu" /></label><button className="ws-button secondary" type="submit"><Plus size={14} /> Thêm thiết bị</button></form></div></details></section></div>}</>;
}

function AbsenceRequests({ context: c }: { context: WorkspaceContext }) {
  const [error, setError] = useState("");
  const pending = c.data.sessions.filter(session => session.calendarStatus === "ABSENCE_PENDING");
  if (!pending.length) return null;
  const decide = (id: number, decision: "approve" | "reject") => c.confirm(
    decision === "approve" ? "Duyệt báo vắng?" : "Từ chối báo vắng?",
    decision === "approve" ? "Buổi học sẽ được đánh dấu vắng và phòng được giải phóng." : "Buổi học vẫn diễn ra theo lịch.",
    async () => {
      try {
        setError("");
        const saved = await campusApi.reviewAbsence(id, decision);
        c.update("sessions", c.data.sessions.map(item => item.id === id ? { ...item, calendarStatus: saved.calendarStatus } : item));
        if (decision === "approve") c.update("reservations", c.data.reservations.map(item => item.id === saved.bookingId ? { ...item, status: "CANCELLED" } : item));
        c.notice(decision === "approve" ? "Đã duyệt báo vắng." : "Đã từ chối báo vắng.");
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể xử lý yêu cầu."); }
    },
  );
  return <section className="ws-panel" style={{ padding: 20, marginBottom: 20 }}><h3>Yêu cầu báo vắng chờ duyệt</h3>{error && <p className="ws-form-error" role="alert">{error}</p>}{pending.map(session => <div className="ws-activity-row" key={session.id}><div><strong>{session.subject}</strong><small>{viDate(session.startTime)} · {viTime(session.startTime)} · Phòng {session.roomCode}</small></div><button className="ws-button" onClick={() => decide(session.id, "approve")}>Duyệt</button><button className="ws-button secondary" onClick={() => decide(session.id, "reject")}>Từ chối</button></div>)}</section>;
}

function BookingsView({ context: c }: { context: WorkspaceContext }) {
  const [filter, setFilter] = useState("ALL"); const [selected, setSelected] = useState<number | null>(null); const [query, setQuery] = useState(""); const [page, setPage] = useState(1);
  const visible = c.data.reservations.filter(x => (filter === "ALL" || x.status === filter) && `${x.id} ${x.roomCode} ${x.userId}`.toLowerCase().includes(query.toLowerCase()));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visible.length / 5)));
  const paged = visible.slice((currentPage - 1) * 5, currentPage * 5);
  const item = c.data.reservations.find(x => x.id === selected);
  const conflicts = item ? c.data.reservations.filter(x => x.id !== item.id && x.roomId === item.roomId && x.status === "CONFIRMED" && new Date(x.startTime) < new Date(item.endTime) && new Date(x.endTime) > new Date(item.startTime)) : [];
  const [reviewError, setReviewError] = useState("");
  const change = (status: Reservation["status"]) => { if (!item) return; c.confirm(status === "CONFIRMED" ? "Duyệt yêu cầu đặt phòng?" : "Từ chối yêu cầu?", `Yêu cầu #${item.id} · ${item.roomCode} · ${viDate(item.startTime)} ${viTime(item.startTime)}–${viTime(item.endTime)}.`, async () => { try { setReviewError(""); const kind = c.data.rooms.find(room => room.id === item.roomId)?.type === "STUDY" ? "study" : "classroom"; const saved = await campusApi.reviewReservation(kind, item.id, status === "CONFIRMED" ? "approve" : "reject"); c.update("reservations", c.data.reservations.map(reservation => reservation.id === item.id ? { ...saved, roomCode: reservation.roomCode } : reservation)); c.notice(`Đã ${status === "CONFIRMED" ? "duyệt" : "từ chối"} yêu cầu #${item.id} trên backend.`); } catch (reason) { setReviewError(reason instanceof Error ? reason.message : "Không thể xử lý yêu cầu."); } }); };
  return <><AbsenceRequests context={c} /><div className="ws-tools"><div className="ws-tools-left"><label className="ws-search"><Search size={16} /><input aria-label="Tìm yêu cầu" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Tìm mã yêu cầu, phòng..." /></label><select className="ws-select" aria-label="Lọc trạng thái yêu cầu" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="ALL">Tất cả yêu cầu</option>{Object.entries(bookingName).map(([status, name]) => <option key={status} value={status}>{name}</option>)}</select></div><span className="ws-demo-tag">{visible.length} yêu cầu</span></div><div className="ws-panel ws-table-wrap ws-admin-table"><table className="ws-table"><thead><tr><th>YÊU CẦU</th><th>PHÒNG / NGƯỜI GỬI</th><th>KHUNG GIỜ</th><th>TRẠNG THÁI</th><th>CHI TIẾT</th></tr></thead><tbody>{paged.map(x => <tr key={x.id}><td><strong>#{x.id}</strong><small>Tạo {viDate(x.createdAt)}</small></td><td><strong>{x.roomCode}</strong><small>Người dùng #{x.userId}</small></td><td>{viDate(x.startTime)}<small>{viTime(x.startTime)} – {viTime(x.endTime)}</small></td><td><Status text={bookingName[x.status]} tone={x.status} /></td><td><button className="ws-row-action" onClick={() => setSelected(x.id)}>Kiểm tra <ArrowRight size={13} /></button></td></tr>)}</tbody></table></div><PageNav page={currentPage} total={visible.length} onPage={setPage} />{!visible.length && <Blank />}{item && <section className="ws-detail"><div className="ws-detail-head"><div><span className="ws-section-kicker">YÊU CẦU / #{item.id}</span><h3>Kiểm tra lịch trước khi duyệt</h3></div><button className="ws-row-action" onClick={() => setSelected(null)}>Đóng</button></div><div className="ws-detail-grid"><div><small>PHÒNG</small><strong>{item.roomCode ?? item.roomId}</strong></div><div><small>NGÀY SỬ DỤNG</small><strong>{viDate(item.startTime)}</strong></div><div><small>KHUNG GIỜ</small><strong>{viTime(item.startTime)} – {viTime(item.endTime)}</strong></div></div><ReservationApiDetails id={item.id} kind={c.data.rooms.find(x => x.id === item.roomId)?.type === "STUDY" ? "study" : "classroom"} /><p>Người gửi: #{item.userId} · Trạng thái: {bookingName[item.status]}. Thông tin học phần/mục đích chưa có trong dữ liệu đặt phòng hiện tại.</p><p>{conflicts.length ? `Cảnh báo: Trùng lịch với yêu cầu đã duyệt #${conflicts.map(x => x.id).join(", #")}.` : "Không tìm thấy xung đột với yêu cầu đã duyệt."}</p>{reviewError && <div className="ws-form-error" role="alert">{reviewError}</div>}{item.status === "PENDING" && <div className="ws-inline-actions"><button className="ws-button" disabled={conflicts.length > 0 || c.data.rooms.find(x => x.id === item.roomId)?.status === "MAINTENANCE"} onClick={() => change("CONFIRMED")}>Duyệt yêu cầu</button><button className="ws-button secondary" onClick={() => change("REJECTED")}>Từ chối</button></div>}</section>}</>;
}

function InviteUserForm({ context: c, close }: { context: WorkspaceContext; close: () => void }) {
  const [role, setRole] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    const values = new FormData(event.currentTarget);
    const data = { code: String(values.get("code") ?? ""), name: String(values.get("name") ?? ""), email: String(values.get("email") ?? ""), faculty: String(values.get("faculty") ?? ""), role };
    try { const saved = await campusApi.inviteUser(data); c.update("users", [...c.data.users, { id: saved.id, name: data.name, email: data.email, role, faculty: data.faculty, status: "INACTIVE" }]); c.notice(`Đã gửi email kích hoạt tới ${data.email}.`); close(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể gửi lời mời."); }
    finally { setBusy(false); }
  };
  return <section className="ws-detail ws-import-dialog" aria-label="Tạo tài khoản"><div className="ws-detail-head"><div><h3>Tạo tài khoản mới</h3><p>Điền thông tin, sau đó hệ thống gửi liên kết kích hoạt qua email trường.</p></div><button type="button" className="ws-create-close" onClick={close} aria-label="Đóng biểu mẫu">×</button></div><form className="ws-form" onSubmit={submit}><label className="ws-field">Mã tài khoản<input name="code" required maxLength={20} pattern={role === "STUDENT" ? "S[A-P][0-9]{7}" : "T[A-P][0-9]{6}"} placeholder={role === "STUDENT" ? "VD: SA2600001" : "VD: TA260001"} title="Chữ vai trò, chữ khoa A–P, năm 2 số và số thứ tự" /></label><label className="ws-field">Họ và tên<input name="name" required maxLength={100} /></label><label className="ws-field">Email<input name="email" type="email" required maxLength={100} /></label><label className="ws-field">Vai trò<select value={role} onChange={event => setRole(event.target.value as "STUDENT" | "TEACHER")}><option value="STUDENT">Sinh viên</option><option value="TEACHER">Giảng viên</option></select></label><label className="ws-field">Khoa<input name="faculty" required maxLength={100} placeholder="Tên khoa" /></label>{error && <p className="ws-form-error" role="alert">{error}</p>}<button className="ws-button" disabled={busy}>{busy ? "Đang gửi email..." : "Tạo và gửi xác thực"}</button></form></section>;
}

function ImportUsersForm({ context: c, close }: { context: WorkspaceContext; close: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof campusApi.importStudentFormCsv>> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { mutate } = useSWRConfig();
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!file) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const imported = await campusApi.importStudentFormCsv(file);
      setResult(imported);
      if (imported.imported) { await mutate("student-intake-admin"); c.notice(`Đã nhập ${imported.imported} hồ sơ sinh viên chờ duyệt.`); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể nhập CSV."); }
    finally { setBusy(false); }
  };
  return <section className="ws-detail ws-import-dialog" aria-label="Nhập CSV từ Google Form"><div className="ws-detail-head"><div><h3>Nhập CSV từ Google Form</h3><p>Xuất phản hồi của sinh viên từ Google Sheets thành CSV, rồi tải file lên đây. Tối đa 500 phản hồi mỗi file.</p></div><button type="button" className="ws-create-close" onClick={close} disabled={busy} aria-label="Đóng biểu mẫu">×</button></div><form className="ws-form" onSubmit={submit}><p>Form cần các cột <strong>Họ và tên, Số điện thoại, Ngày sinh, Giới tính, Email cá nhân, Khoa</strong>. Cột thời gian gửi được bỏ qua. Giá trị khoa bắt đầu bằng mã A–P, ví dụ <strong>A - Công nghệ thông tin</strong>.</p><label className="ws-field">Chọn CSV xuất từ Google Form<input type="file" accept=".csv,text/csv" required onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>{error && <p className="ws-form-error" role="alert">{error}</p>}<button className="ws-button" disabled={busy || !file}>{busy ? "Đang nhập hồ sơ..." : "Nhập hồ sơ chờ duyệt"}</button></form>{result && <div className="ws-detail"><h4>Đã nhập {result.imported}/{result.total} hồ sơ · {result.failed} dòng lỗi</h4><p>Admin cần kiểm tra hồ sơ và nhập email trường trước khi duyệt cấp mã và gửi email kích hoạt.</p>{result.rows.some(row => row.error) && <div className="ws-import-errors" role="status">{result.rows.filter(row => row.error).map(row => <p key={row.line}>Dòng {row.line} · {row.name || row.personalEmail || "Thiếu dữ liệu"}: {row.error}</p>)}</div>}</div>}</section>;
}

function StudentIntakeQueue({ context: c }: { context: WorkspaceContext }) {
  const { data, error, mutate } = useSWR("student-intake-admin", campusApi.studentIntakes);
  const [emails, setEmails] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const pending = data?.filter(item => item.status === "PENDING") ?? [];
  const act = async (id: number, decision: "approve" | "reject") => {
    setBusy(id); setMessage("");
    try {
      if (decision === "approve") await campusApi.approveStudentIntake(id, emails[id] ?? "");
      else await campusApi.rejectStudentIntake(id);
      await mutate();
      if (decision === "approve") {
        const users = await campusApi.users();
        c.update("users", users.map(user => ({ id: user.id, name: user.name, email: user.email, role: user.role, faculty: user.faculty, status: user.verified ? "ACTIVE" : "INACTIVE" })));
      }
      c.notice(decision === "approve" ? "Đã tạo tài khoản và gửi email kích hoạt." : "Đã từ chối hồ sơ.");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Không thể xử lý hồ sơ."); }
    finally { setBusy(null); }
  };
  return <section className="ws-intake-panel"><div className="ws-intake-head"><div><span className="ws-section-kicker">GOOGLE FORM / SINH VIÊN</span><h3>Hồ sơ chờ duyệt</h3><p>Đối chiếu thông tin, nhập email trường rồi cấp mã tự động.</p></div><button type="button" className="ws-button secondary" onClick={() => mutate()}>Tải lại</button></div>{error && <p className="ws-form-error">Không tải được hồ sơ từ Form.</p>}{!data && !error && <p>Đang tải hồ sơ...</p>}{data && pending.length === 0 && <p className="ws-intake-empty">Chưa có hồ sơ chờ duyệt.</p>}{message && <p className="ws-form-error" role="alert">{message}</p>}<div className="ws-intake-list">{pending.map(item => <article className="ws-intake-card" key={item.id}><div><strong>{item.name}</strong><small>Khoa {item.facultyCode} · {item.faculty}</small><small>{item.personalEmail} · {item.phone ?? "Chưa có SĐT"} · {item.birthDate ?? "Chưa có ngày sinh"}</small></div><div className="ws-intake-actions"><label className="ws-field">Email trường<input type="email" value={emails[item.id] ?? ""} onChange={event => setEmails(previous => ({ ...previous, [item.id]: event.target.value }))} placeholder="ten@tdtu.edu.vn" /></label><button type="button" className="ws-button" disabled={busy === item.id || !emails[item.id]} onClick={() => act(item.id, "approve")}>Duyệt & cấp mã</button><button type="button" className="ws-button secondary" disabled={busy === item.id} onClick={() => act(item.id, "reject")}>Từ chối</button></div></article>)}</div></section>;
}

function UsersView({ context: c }: { context: WorkspaceContext }) {
  const [createMode, setCreateMode] = useState<"single" | "csv" | null>(null); const [query, setQuery] = useState(""); const [selected, setSelected] = useState<number | null>(null); const [filter, setFilter] = useState("ALL"); const [facultyFilter, setFacultyFilter] = useState("ALL"); const [facultyInput, setFacultyInput] = useState(""); const [page, setPage] = useState(1); const user = c.data.users.find(x => x.id === selected);
  const visible = c.data.users.filter(x => (filter === "ALL" || x.role === filter) && (facultyFilter === "ALL" || x.faculty === facultyFilter) && `${x.name} ${x.email}`.toLowerCase().includes(query.toLowerCase()));
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visible.length / 5)));
  const paged = visible.slice((currentPage - 1) * 5, currentPage * 5);
  return <><StudentIntakeQueue context={c} /><div className="ws-user-create-tools"><div><span className="ws-section-kicker">QUẢN LÝ TÀI KHOẢN</span><h3>Thêm người dùng</h3><p>Nhập phản hồi sinh viên từ Google Form hoặc tạo tài khoản riêng lẻ.</p></div><div className="ws-user-create-actions"><button className="ws-button" onClick={() => setCreateMode(current => current === "csv" ? null : "csv")}>↑ Nhập CSV từ Google Form</button><button className="ws-button secondary" onClick={() => setCreateMode(current => current === "single" ? null : "single")}>+ Tạo một tài khoản</button></div></div>{createMode === "csv" && <ImportUsersForm context={c} close={() => setCreateMode(null)} />}{createMode === "single" && <InviteUserForm context={c} close={() => setCreateMode(null)} />}<div className="ws-tools"><div className="ws-tools-left"><label className="ws-search"><Search size={16} /><input aria-label="Tìm tài khoản" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Tìm tên hoặc email..." /></label><select className="ws-select" aria-label="Lọc vai trò" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="ALL">Tất cả vai trò</option><option value="ADMIN">Quản trị</option><option value="TEACHER">Giảng viên</option><option value="STUDENT">Sinh viên</option></select><select className="ws-select" aria-label="Lọc khoa" value={facultyFilter} onChange={e => { setFacultyFilter(e.target.value); setPage(1); }}><option value="ALL">Tất cả khoa</option>{[...new Set(c.data.users.map(user => user.faculty).filter((value): value is string => !!value))].map(value => <option key={value} value={value}>{value}</option>)}</select></div></div><div className="ws-panel ws-table-wrap ws-admin-table"><table className="ws-table"><thead><tr><th>TÀI KHOẢN</th><th>EMAIL</th><th>VAI TRÒ</th><th>TRẠNG THÁI</th><th>CHI TIẾT</th></tr></thead><tbody>{paged.map(x => <tr key={x.id}><td><strong>{x.name}</strong><small>#{x.id}</small></td><td>{x.email}</td><td><Status text={roleName[x.role]} tone={x.role} /></td><td><Status text={x.status === "ACTIVE" ? "Hoạt động" : "Tạm ngưng"} tone={x.status} /></td><td><button className="ws-row-action" onClick={() => setSelected(x.id)}>Xem <ArrowRight size={13} /></button></td></tr>)}</tbody></table></div><PageNav page={currentPage} total={visible.length} onPage={setPage} />{!visible.length && <Blank />}{user && <section className="ws-detail"><div className="ws-detail-head"><div><span className="ws-section-kicker">TÀI KHOẢN / #{user.id}</span><h3>{user.name}</h3><p>{user.email}</p></div><button className="ws-row-action" onClick={() => setSelected(null)}>Đóng</button></div><div className="ws-detail-grid"><div><small>VAI TRÒ HIỆN TẠI</small><strong>{roleName[user.role]}</strong></div><div><small>TRẠNG THÁI</small><strong>{user.status === "ACTIVE" ? "Hoạt động" : "Tạm ngưng"}</strong></div><div><small>MÃ TÀI KHOẢN</small><strong>#{user.id}</strong></div></div>{user.role === "STUDENT" && <form className="ws-inline-actions" onSubmit={async event => { event.preventDefault(); try { const saved = await campusApi.setStudentFaculty(user.id, facultyInput || user.faculty || ""); c.update("users", c.data.users.map(item => item.id === user.id ? { ...item, faculty: saved.faculty } : item)); c.notice("Đã cập nhật khoa của sinh viên."); } catch (reason) { c.notice(reason instanceof Error ? reason.message : "Không thể cập nhật khoa."); } }}><label className="ws-field">Khoa<input value={facultyInput} onChange={event => setFacultyInput(event.target.value)} placeholder={user.faculty || "Nhập tên khoa"} required /></label><button className="ws-button">Lưu khoa</button></form>}</section>}</>;
}

function AdminIncidents({ context: c }: { context: WorkspaceContext }) {
  const [filter, setFilter] = useState("ALL"); const [selected, setSelected] = useState<number | null>(null); const [page, setPage] = useState(1); const [assigned, setAssigned] = useState<Record<number, string>>({}); const incident = c.data.incidents.find(x => x.id === selected); const visible = c.data.incidents.filter(x => filter === "ALL" || x.status === filter);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visible.length / 5)));
  const paged = visible.slice((currentPage - 1) * 5, currentPage * 5);
  const change = (status: Incident["status"]) => { if (!incident) return; c.confirm("Cập nhật trạng thái sự cố?", `Sự cố #${incident.id} sẽ chuyển sang ${incidentName[status]} trên backend.`, () => { c.update("incidents", c.data.incidents.map(x => x.id === incident.id ? { ...x, status } : x)); c.notice("Đã cập nhật sự cố trong bản demo. Không lưu vào backend."); }); };
  return <><div className="ws-tools"><div className="ws-tools-left"><select className="ws-select" aria-label="Lọc sự cố" value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="ALL">Tất cả sự cố</option>{Object.entries(incidentName).map(([status, name]) => <option key={status} value={status}>{name}</option>)}</select></div></div><div className="ws-panel ws-table-wrap ws-admin-table"><table className="ws-table"><thead><tr><th>SỰ CỐ</th><th>PHÒNG / NGƯỜI BÁO</th><th>MỨC ĐỘ</th><th>TRẠNG THÁI</th><th>CHI TIẾT</th></tr></thead><tbody>{paged.map(x => <tr key={x.id}><td><strong>#{x.id} · {category[x.category]}</strong><small>{viDate(x.createdAt)}</small></td><td><strong>{x.roomCode}</strong><small>{x.reporterName}</small></td><td>{x.priority === "HIGH" ? "Cao" : x.priority === "MEDIUM" ? "Trung bình" : "Thấp"}</td><td><Status text={incidentName[x.status]} tone={x.status} /></td><td><button className="ws-row-action" onClick={() => setSelected(x.id)}>Xử lý <ArrowRight size={13} /></button></td></tr>)}</tbody></table></div><PageNav page={currentPage} total={visible.length} onPage={setPage} />{!visible.length && <Blank />}{incident && <section className="ws-detail"><div className="ws-detail-head"><div><span className="ws-section-kicker">SỰ CỐ / #{incident.id}</span><h3>{category[incident.category]} · {incident.roomCode}</h3><p>{incident.description}</p></div><button className="ws-row-action" onClick={() => setSelected(null)}>Đóng</button></div><div className="ws-detail-grid"><div><small>NGƯỜI BÁO</small><strong>{incident.reporterName}</strong></div><div><small>MỨC ĐỘ</small><strong>{incident.priority}</strong></div><div><small>TRẠNG THÁI</small><Status text={incidentName[incident.status]} tone={incident.status} /></div></div><p>Phân công xử lý: chưa có trường dữ liệu hoặc API phân công. Ghi nhận minh họa bên dưới không được lưu.</p><div className="ws-inline-actions"><label className="ws-field">Người phụ trách minh họa<select aria-label="Phân công xử lý" value={assigned[incident.id] ?? ""} onChange={e => { const team = e.target.value; c.confirm("Phân công sự cố minh họa?", `Sự cố #${incident.id} sẽ được gán cho ${team === "it" ? "Bộ phận công nghệ thông tin" : team === "facilities" ? "Bộ phận cơ sở vật chất" : "chưa phân công"} trên backend.`, () => { setAssigned(previous => ({ ...previous, [incident.id]: team })); c.notice("Đã cập nhật phân công trong bản demo. Không lưu vào backend."); }); }}><option value="">Chưa phân công</option><option value="facilities">Bộ phận cơ sở vật chất</option><option value="it">Bộ phận công nghệ thông tin</option></select></label>{incident.status !== "RESOLVED" && <button className="ws-button" onClick={() => change(incident.status === "OPEN" ? "IN_PROGRESS" : "RESOLVED")}>{incident.status === "OPEN" ? "Bắt đầu xử lý" : "Đánh dấu đã xử lý"}</button>}</div></section>}</>;
}








