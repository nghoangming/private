"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRight, CalendarDays, CheckCircle2, CircleAlert, Clock3, DoorOpen, QrCode, Search, UsersRound } from "lucide-react";
import type { Reservation } from "@/lib/admin-data";
import type { RoomPurpose } from "@/lib/demo-campus";
import { campusApi } from "@/lib/campus-api";
import { QrScanner } from "@/components/qr-scanner";
import { TeacherSchedule } from "@/components/teacher-schedule";
import { AbsenceView } from "@/components/absence-views";
import { IncidentView } from "@/components/incident-view";
import { StudentOverview, StudentSchedule, StudentStudyBookings as StudentStudyBookingsPage, StudentSeats } from "@/components/student-views";
import type { WorkspaceContext } from "@/lib/workspace-types";
import { bookingName, viDate, viTime } from "@/lib/workspace-types";

const courseLabel = (code: string) => code === "DEMO" ? "Chưa có mã học phần" : code;
function Empty({ text }: { text: string }) { return <div className="ws-empty"><Search size={25} /><h3>Chưa có thông tin</h3><p>{text}</p></div>; }
export function LearningViews({ tab, context: c }: { tab: string; context: WorkspaceContext }) {
  const teacher = c.role === "TEACHER";
  const { data: choices = [], mutate: refreshChoice } = useSWR(`api-seats-${c.account.id}`, async () => (await campusApi.mySeats(c.account.id)).map(reservation => ({ id: reservation.id, sessionId: reservation.classSessionId, seatId: reservation.seatId })), { revalidateOnFocus: true });
  if (tab === "absences") return <AbsenceView context={c} choices={choices} />;
  if (tab === "schedule" && !teacher) return <StudentSchedule context={c} choices={choices} />;
  if (tab === "schedule") return <TeacherSchedule context={c} />;
  if (tab === "seats" && !teacher) return <StudentSeats context={c} choices={choices} refreshChoice={refreshChoice} />;
  if (tab === "bookings" && teacher) return <TeacherBookings context={c} />;
  if (tab === "bookings" && !teacher) return <StudentStudyBookingsPage context={c} />;
  if (tab === "attendance" && teacher) return <Attendance context={c} />;
  if (tab === "incidents" && teacher) return <IncidentView context={c} />;
  if (tab === "checkin" && !teacher) return <Checkin context={c} choices={choices} />;
  if (!teacher) return <StudentOverview context={c} choices={choices} />;
  const dayKey = (value: string) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
    const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  const today = dayKey(new Date().toISOString());
  const teacherSessions = c.data.sessions.filter(x => x.teacherId === c.account.id && dayKey(x.startTime) >= today).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const upcoming = teacherSessions[0];
  const pending = c.data.reservations.filter(x => x.userId === c.account.id && x.status === "PENDING").length;
  const metrics = [
    { label: "Buổi dạy sắp tới", value: teacherSessions.length, sub: "Trong lịch giảng dạy", icon: CalendarDays, tab: "schedule" },
    { label: "Phòng được cấp", value: new Set(teacherSessions.map(x => x.roomId)).size, sub: "Theo các buổi giảng", icon: DoorOpen, tab: "schedule" },
    { label: "Yêu cầu chờ duyệt", value: pending, sub: "Yêu cầu của bạn", icon: Clock3, tab: "bookings" },
    { label: "Thông báo", value: c.unreadNotifications, sub: "Thông báo chưa đọc", icon: CircleAlert, tab: "notifications" },
  ];
  return <><div className="ws-overview">{metrics.map(x => <button key={x.label} className="ws-metric" onClick={() => c.navigate(x.tab)}><span className="ws-metric-icon"><x.icon size={18} /></span><ArrowRight size={14} className="ws-metric-arrow" /><span className="ws-metric-label">{x.label}</span><strong>{String(x.value).padStart(2, "0")}</strong><small>{x.sub}</small></button>)}</div><div className="ws-columns"><div className="ws-panel"><div className="ws-panel-header"><div><h3>Lịch giảng dạy sắp tới</h3><p>Chuẩn bị cho những buổi học tiếp theo</p></div><button className="ws-row-action" onClick={() => c.navigate("schedule")}>Xem lịch <ArrowRight size={14} /></button></div><div className="ws-activity">{teacherSessions.slice(0, 3).map(x => <div className="ws-activity-row" key={x.id}><span className="ws-activity-icon"><CalendarDays size={16} /></span><div><strong>{x.subject}</strong><small>{courseLabel(x.className)} · {viDate(x.startTime)} · {viTime(x.startTime)}</small></div><span>{x.roomCode}</span></div>)}</div></div><div className="ws-highlight"><span>LỚP HỌC TIẾP THEO</span><h3>{upcoming?.subject ?? "Chưa có lịch mới"}</h3><p>{upcoming ? `${courseLabel(upcoming.className)} · Phòng ${upcoming.roomCode} · ${viDate(upcoming.startTime)}, ${viTime(upcoming.startTime)}` : "Lịch sẽ hiển thị tại đây khi có dữ liệu."}</p><button onClick={() => c.navigate("schedule")}>Xem lịch giảng <ArrowRight size={15} /></button></div></div></>;
}

function TeacherBookings({ context: c }: { context: WorkspaceContext }) {
  const [date, setDate] = useState(""); const [start, setStart] = useState("08:00"); const [end, setEnd] = useState("10:00"); const [roomId, setRoomId] = useState<number | null>(null); const [purpose, setPurpose] = useState<RoomPurpose>("THEORY"); const [makeup, setMakeup] = useState(false); const [subject, setSubject] = useState(""); const [courseCode, setCourseCode] = useState(""); const [error, setError] = useState(""); const [page, setPage] = useState(1);
  const available = c.data.rooms.filter(x => x.status === "ACTIVE" && x.type === purpose);
  const mine = c.data.reservations.filter(x => x.userId === c.account.id).sort((a, b) => b.id - a.id); const pageCount = Math.max(1, Math.ceil(mine.length / 5)); const currentPage = Math.min(page, pageCount); const visibleMine = mine.slice((currentPage - 1) * 5, currentPage * 5);
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!date || !roomId || !subject.trim() || !courseCode.trim() || end <= start) { setError("Chọn phòng, ngày, khung giờ hợp lệ và nhập học phần/mục đích."); return; } if (!available.some(x => x.id === roomId)) { setError("Chọn một phòng phù hợp với loại phòng học."); return; } const booking: Reservation = { id: Math.max(...c.data.reservations.map(x => x.id), 0) + 1, userId: c.account.id, roomId, roomCode: c.data.rooms.find(x => x.id === roomId)?.code, startTime: new Date(`${date}T${start}:00`).toISOString(), endTime: new Date(`${date}T${end}:00`).toISOString(), status: "PENDING", createdAt: new Date().toISOString() }; c.confirm("Gửi yêu cầu đặt phòng?", `${purpose === "THEORY" ? "Phòng lý thuyết" : "Phòng thực hành"} ${booking.roomCode} · ${date} · ${start}–${end} · ${subject.trim()}. Yêu cầu được gửi tới backend.`, async () => { try { const saved = await campusApi.createReservation("classroom", { roomId, startTime: booking.startTime, endTime: booking.endTime }, c.account.id); c.update("reservations", [{ ...saved, roomCode: booking.roomCode }, ...c.data.reservations]); const createdSession = await campusApi.createSession(saved.id, courseCode.trim().toUpperCase(), subject.trim(), makeup); c.update("sessions", [...c.data.sessions, { id: createdSession.id, bookingId: createdSession.bookingId, subject: createdSession.title, className: createdSession.courseCode, roomId: createdSession.roomId, roomCode: booking.roomCode ?? "", startTime: createdSession.startTime, endTime: createdSession.endTime, status: "Sắp diễn ra", calendarStatus: createdSession.calendarStatus ?? "SCHEDULED", teacherId: c.account.id }]); c.notice("Đã tạo lịch phòng và buổi học qua API."); setError(""); setSubject(""); setCourseCode(""); setMakeup(false); } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể đặt phòng."); } }); };
  return <div className="ws-booking-layout"><div className="ws-panel"><div className="ws-panel-header"><div><h3>Tìm phòng cho lớp học</h3><p>Chọn ngày, thời gian và phòng trước khi gửi yêu cầu</p></div></div><div className="ws-detail" style={{ border: 0, margin: 0 }}><form className="ws-form" onSubmit={submit}><label className="ws-field span-two">Loại phòng học<select value={purpose} onChange={e => { setPurpose(e.target.value as RoomPurpose); setRoomId(null); setError(""); }}><option value="THEORY">Phòng lý thuyết</option><option value="LAB">Phòng thực hành</option></select></label><label className="ws-field">Ngày sử dụng<input type="date" required min={new Date().toISOString().slice(0, 10)} value={date} onChange={e => { setDate(e.target.value); setRoomId(null); }} /></label><label className="ws-field">Mã học phần<input required maxLength={30} value={courseCode} onChange={e => setCourseCode(e.target.value)} placeholder="VD: IT004" /></label><label className="ws-field">Học phần / mục đích<input required maxLength={120} value={subject} onChange={e => setSubject(e.target.value)} placeholder="VD: Lập trình ứng dụng Web" /></label><label className="ws-field">Bắt đầu<input type="time" required value={start} onChange={e => { setStart(e.target.value); setRoomId(null); }} /></label><label className="ws-field">Kết thúc<input type="time" required value={end} onChange={e => { setEnd(e.target.value); setRoomId(null); }} /></label><label className="ws-field span-two"><input type="checkbox" checked={makeup} onChange={e => setMakeup(e.target.checked)} /> Buổi học bù (để trống là học chính thức)</label><label className="ws-field span-two">Phòng phù hợp ({available.length})<select required value={roomId ?? ""} onChange={e => setRoomId(Number(e.target.value))}><option value="">Chọn phòng phù hợp</option>{available.map(x => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></label>{error && <div className="ws-form-error" role="alert">{error}</div>}<div className="ws-form-actions"><button className="ws-button" type="submit">Gửi yêu cầu <ArrowRight size={15} /></button></div></form></div></div><div className="ws-panel"><div className="ws-panel-header"><div><h3>Yêu cầu của tôi</h3><p>Chỉ các yêu cầu do tài khoản này gửi</p></div></div>{mine.length ? <div className="ws-table-wrap"><table className="ws-table"><thead><tr><th>MÃ</th><th>PHÒNG</th><th>THỜI GIAN</th><th>TRẠNG THÁI</th><th>BUỔI HỌC</th><th>THAO TÁC</th></tr></thead><tbody>{visibleMine.map(x => <tr key={x.id}><td><strong>#{x.id}</strong></td><td>{x.roomCode}</td><td>{viDate(x.startTime)} · {viTime(x.startTime)} – {viTime(x.endTime)}</td><td><span className={`ws-tag ${x.status.toLowerCase()}`}>{c.data.sessions.some(s => s.bookingId === x.id && s.calendarStatus === "ABSENT") ? "Đã báo vắng" : bookingName[x.status]}</span></td><td>{(() => { const session = c.data.sessions.find(s => s.bookingId === x.id); return session?.calendarStatus === "ABSENT" ? "Phòng đã giải phóng" : session?.calendarStatus === "MAKEUP" ? "Học bù" : "Chính thức"; })()}</td><td>{x.status === "PENDING" ? <button className="ws-row-action" onClick={() => c.confirm("Hủy yêu cầu của bạn?", `Yêu cầu #${x.id} sẽ được hủy trên backend.`, async () => { try { const saved = await campusApi.cancelReservation("classroom", x.id); c.update("reservations", c.data.reservations.map(y => y.id === x.id ? { ...saved, roomCode: y.roomCode } : y)); c.notice("Đã hủy yêu cầu qua API."); } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể hủy yêu cầu."); } })}>Hủy yêu cầu</button> : "—"}</td></tr>)}</tbody></table></div> : <Empty text="Bạn chưa có yêu cầu đặt phòng nào." />}{mine.length > 5 && <div className="ws-pagination"><span>Hiển thị {(currentPage - 1) * 5 + 1}–{Math.min(currentPage * 5, mine.length)} / {mine.length} yêu cầu</span><div>{Array.from({ length: pageCount }, (_, index) => <button type="button" key={index} className={currentPage === index + 1 ? "active" : ""} onClick={() => setPage(index + 1)} aria-current={currentPage === index + 1 ? "page" : undefined}>{index + 1}</button>)}</div></div>}</div></div>;
}

function Attendance({ context: c }: { context: WorkspaceContext }) {
  const [today, setToday] = useState(() => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  });
  const dayKey = (value: string) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
    const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  const eligibleSessions = c.data.sessions.filter(item => item.teacherId === c.account.id && item.calendarStatus !== "ABSENT" && dayKey(item.startTime) >= today).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const [sessionId, setSessionId] = useState(eligibleSessions[0]?.id ?? 0);
  useEffect(() => { const timer = window.setInterval(() => setToday(dayKey(new Date().toISOString())), 60000); return () => window.clearInterval(timer); }, []);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [qr, setQr] = useState<{ token: string; expiresAt: string } | null>(null);
  const [copiedQr, setCopiedQr] = useState(false);
  const [qrError, setQrError] = useState("");
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!qr) return;
    const timer = setTimeout(() => setQr(null), Math.max(0, new Date(qr.expiresAt).getTime() - Date.now()));
    return () => clearTimeout(timer);
  }, [qr]);
  const session = eligibleSessions.find(item => item.id === sessionId);
  const booking = c.data.reservations.find(item => item.id === session?.bookingId);
  const opensAt = session ? new Date(session.startTime).getTime() + 5 * 60000 : 0;
  const closesAt = session ? Math.min(new Date(session.startTime).getTime() + 20 * 60000, new Date(session.endTime).getTime()) : 0;
  const qrHint = !session ? "Chưa chọn buổi học." : booking?.status !== "CONFIRMED" ? "Yêu cầu đặt phòng chưa được duyệt." : now && now < opensAt ? `QR mở từ ${viTime(new Date(opensAt).toISOString())} ngày ${viDate(session.startTime)} (sau giờ bắt đầu 5 phút).` : now && now >= closesAt ? "Đã hết 15 phút điểm danh của buổi học." : "";
  useEffect(() => { if (!eligibleSessions.some(item => item.id === sessionId)) { setSessionId(eligibleSessions[0]?.id ?? 0); setSelectedSeat(null); setQr(null); } }, [eligibleSessions, sessionId]);
  const { data: seats, isLoading, error } = useSWR(session ? `attendance-seats-${sessionId}` : null, () => campusApi.seats(sessionId), { revalidateOnFocus: true });
  const { data: attendance = [], mutate: refreshAttendance } = useSWR(session ? `attendance-${sessionId}-${c.account.id}` : null, () => campusApi.attendance(sessionId, c.account.id), { revalidateOnFocus: true });
  const reserved = seats?.filter(seat => seat.status === "RESERVED").length ?? 0;
  const available = seats?.filter(seat => seat.status === "AVAILABLE").length ?? 0;
  const unavailable = (seats?.length ?? 0) - reserved - available;
  const selected = seats?.find(seat => seat.seatNumber === selectedSeat);
  const selectedAttendance = attendance.find(record => record.seatNumber === selectedSeat);
  const present = attendance.filter(record => record.status === "PRESENT").length;
  const presentSeatIds = new Set(attendance.filter(record => record.status === "PRESENT").map(record => record.seatId));
  const generateQr = async () => { if (!session) return; setQrError(""); try { const next = await campusApi.generateQr(session.id, c.account.id); setQr(next); await refreshAttendance(); } catch (reason) { setQrError(reason instanceof Error ? reason.message : "Không thể tạo mã QR."); } };
  const copyQrCode = async () => { if (!qr) return; try { await navigator.clipboard.writeText(qr.token); setCopiedQr(true); setTimeout(() => setCopiedQr(false), 2000); } catch { setQrError("Không sao chép được mã. Hãy chọn và sao chép mã thủ công."); } };
  const cancelAttendance = (id: number, userId: number) => c.confirm("Hủy điểm danh?", `Hủy lượt điểm danh của sinh viên #${userId} ở buổi học này. Hệ thống giữ lịch sử hủy và sinh viên có thể quét lại nếu còn trong giờ điểm danh.`, async () => {
    setQrError("");
    try { await campusApi.cancelAttendance(id, c.account.id); await refreshAttendance(); c.notice("Đã hủy lượt điểm danh trên backend."); }
    catch (reason) { setQrError(reason instanceof Error ? reason.message : "Không thể hủy điểm danh."); }
  });

  return <>
    <div className="ws-tools"><div className="ws-tools-left"><select className="ws-select" aria-label="Chọn buổi học" value={sessionId} onChange={event => { setSessionId(Number(event.target.value)); setSelectedSeat(null); setQr(null); }}><option value={0} disabled>Chọn buổi học</option>{eligibleSessions.map(item => <option key={item.id} value={item.id}>{courseLabel(item.className)} · {item.subject} · {viDate(item.startTime)}</option>)}</select></div><button className="ws-button secondary" disabled={!session} onClick={() => { void refreshAttendance(); }}>Tải lại điểm danh</button></div>
    <div className="ws-attendance-summary">
    <div className="ws-panel ws-qr-display"><div className="ws-qr-copy"><span className="ws-qr-eyebrow">ĐIỂM DANH BUỔI HỌC</span><h3>Mã QR cho lớp học</h3><p className="ws-qr-intro">Tạo mã để sinh viên quét hoặc nhập mã thủ công.</p><div className="ws-qr-rules"><span><strong>Thời gian mở</strong> Từ phút thứ 5 đến phút thứ 20 sau khi bắt đầu</span><span><strong>Hiệu lực mã</strong> Tối đa 2 phút cho mỗi lần tạo</span></div><button className="ws-button ws-qr-action" disabled={!session || !!qrHint} onClick={generateQr}>{qr ? "Làm mới mã QR" : "Tạo mã QR"}</button>{qrHint && <p className="ws-qr-hint" role="status">{qrHint}</p>}{qrError && <p className="ws-form-error" role="alert">{qrError}</p>}</div>{qr && <div className="ws-qr-code"><QRCodeSVG value={qr.token} size={190} marginSize={2} /><p>Hết hạn lúc {viTime(qr.expiresAt)} · Buổi #{sessionId}</p><div className="ws-qr-manual"><span>Mã Thủ Công:</span><code>{qr.token}</code><button type="button" className="ws-button secondary" onClick={copyQrCode}>{copiedQr ? "Đã sao chép" : "Sao chép mã"}</button></div></div>}</div>
    <div className="ws-attendance"><div className="ws-attendance-metric"><span className="ws-attendance-metric-icon"><UsersRound size={20} /></span><span className="ws-attendance-metric-label">GHẾ ĐÃ ĐẶT</span><strong>{String(reserved).padStart(2, "0")}</strong><span className="ws-attendance-metric-note">Trên {seats?.length ?? 0} ghế trong phòng</span><i className="ws-attendance-meter"><span style={{ width: `${seats?.length ? reserved / seats.length * 100 : 0}%` }} /></i></div><div className="ws-attendance-metric"><span className="ws-attendance-metric-icon"><CheckCircle2 size={20} /></span><span className="ws-attendance-metric-label">ĐÃ ĐIỂM DANH</span><strong>{String(present).padStart(2, "0")}</strong><span className="ws-attendance-metric-note">{reserved ? `${Math.round(present / reserved * 100)}% ghế đã đặt` : "Chưa có ghế được đặt"}</span><i className="ws-attendance-meter"><span style={{ width: `${reserved ? present / reserved * 100 : 0}%` }} /></i></div><div className="ws-attendance-metric"><span className="ws-attendance-metric-icon"><CircleAlert size={20} /></span><span className="ws-attendance-metric-label">CHƯA ĐIỂM DANH</span><strong>{String(Math.max(0, reserved - present)).padStart(2, "0")}</strong><span className="ws-attendance-metric-note">{reserved ? `${Math.round(Math.max(0, reserved - present) / reserved * 100)}% ghế đã đặt` : "Chưa có ghế được đặt"}</span><i className="ws-attendance-meter"><span style={{ width: `${reserved ? Math.max(0, reserved - present) / reserved * 100 : 0}%` }} /></i></div></div>
    </div>
    <section className="ws-panel"><div className="ws-panel-header"><div><h3>{session?.subject ?? "Chọn buổi dạy"}</h3><p>{session && courseLabel(session.className)} · {session?.roomCode} · {session && viDate(session.startTime)} {session && viTime(session.startTime)} </p></div></div>
      {isLoading ? <div className="ws-empty" role="status">Đang tải sơ đồ ghế...</div> : error ? <Empty text="Không thể tải ghế của buổi học này." /> : !seats?.length ? <Empty text={session ? "Phòng này chưa có ghế trong cơ sở dữ liệu." : "Chưa có buổi học đang hoạt động."} /> : <>
        <div className="ws-attendance-legend" aria-label="Chú giải trạng thái"><span><i className="reserved" /> Chưa điểm danh ({Math.max(0, reserved - present)})</span><span><i className="present" /> Đã điểm danh ({present})</span><span><i className="empty" /> Không đặt ({available + unavailable})</span></div>
        <div className="ws-attendance-plan"><div className="ws-attendance-board">BẢNG GIẢNG DẠY <span>·</span> {session?.roomCode}</div><p className="ws-attendance-caption">NHÌN TỪ PHÍA GIẢNG VIÊN · CHỌN MỘT GHẾ ĐỂ XEM TRẠNG THÁI</p><div className="ws-attendance-grid">{seats.map(seat => <button type="button" key={seat.id} className={`ws-attendance-seat ${presentSeatIds.has(seat.id) ? "present" : seat.status === "RESERVED" ? "reserved" : "empty"} ${selectedSeat === seat.seatNumber ? "selected" : ""}`} onClick={() => setSelectedSeat(seat.seatNumber)} aria-label={`Ghế ${seat.seatNumber}, ${presentSeatIds.has(seat.id) ? "đã điểm danh" : seat.status === "RESERVED" ? "chưa điểm danh" : "không đặt"}`} aria-pressed={selectedSeat === seat.seatNumber}><span className="ws-attendance-seat-number">{String(seat.seatNumber).padStart(2, "0")}</span><strong>Ghế {seat.seatNumber}</strong><small>{presentSeatIds.has(seat.id) ? "Đã điểm danh" : seat.status === "RESERVED" ? "Chưa điểm danh" : "Không đặt"}</small></button>)}</div></div>
        {selected && <div className="ws-seat-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedSeat(null); }}><div className="ws-attendance-detail" role="dialog" aria-modal="true" aria-label={`Chi tiết ghế ${selected.seatNumber}`}><div><span>GHẾ {String(selected.seatNumber).padStart(2, "0")}</span><strong>{selectedAttendance?.status === "PRESENT" ? "Đã điểm danh" : selected.status === "RESERVED" ? "Chưa điểm danh" : "Không đặt"}</strong><small>{selectedAttendance ? `${selectedAttendance.studentName ?? "Sinh viên"} · #${selectedAttendance.userId}` : "Chưa có lượt đặt ghế"}</small></div>{selectedAttendance?.status === "PRESENT" && selectedAttendance.id != null && <button type="button" className="ws-button secondary" onClick={() => cancelAttendance(selectedAttendance.id!, selectedAttendance.userId)}>Hủy điểm danh</button>}<button type="button" className="ws-button secondary" onClick={() => setSelectedSeat(null)}>Đóng</button></div></div>}

      </>}
    </section>
  </>;
}

function Checkin({ context: c, choices }: { context: WorkspaceContext; choices: { id: number; sessionId: number; seatId: number }[] }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState(0);
  const sessionId = choices.some(choice => choice.sessionId === selectedSessionId) ? selectedSessionId : (choices[0]?.sessionId ?? 0);
  const seatId = choices.find(choice => choice.sessionId === sessionId)?.seatId;
  const session = c.data.sessions.find(x => x.id === sessionId);
  const { data: seats = [] } = useSWR(session ? `checkin-seats-${session.id}` : null, () => campusApi.seats(session!.id));
  const seatNumber = seats.find(seat => seat.id === seatId)?.seatNumber;
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session) { setError("Hãy đặt ghế cho một buổi học trước khi check-in."); return; }
    setBusy(true); setError(""); setResult("");
    try {
      const saved = await campusApi.checkIn(code.trim(), session.id, c.account.id);
      setResult(`Đã điểm danh thành công lúc ${viTime(saved.checkedInAt ?? new Date().toISOString())}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể check-in."); }
    finally { setBusy(false); }
  };
  return <div className="ws-panel ws-qr"><div className="ws-qr-visual"><div className="ws-qr-frame"><QrCode size={69} strokeWidth={1.2} /></div><strong>QUÉT MÃ QR BUỔI HỌC</strong><p>Quét mã do giảng viên hiển thị trong giờ điểm danh</p><QrScanner onCode={value => { setCode(value); setError(""); }} /></div><div className="ws-qr-info"><span className="ws-section-kicker">CHECK-IN / XÁC NHẬN BUỔI HỌC</span><h3>Sẵn sàng vào lớp?</h3><p>Giờ điểm danh: phút thứ 5–20 sau khi bắt đầu học. Mã QR có hiệu lực tối đa 2 phút; bạn cần có ghế đã đặt.</p><label className="ws-field">Chọn buổi học<select value={sessionId} onChange={event => { setSelectedSessionId(Number(event.target.value)); setCode(""); setResult(""); setError(""); }} disabled={!choices.length}>{choices.length ? choices.map(choice => { const item = c.data.sessions.find(session => session.id === choice.sessionId); return <option key={choice.id} value={choice.sessionId}>{item ? `${item.subject} · ${viDate(item.startTime)}` : `Buổi học #${choice.sessionId}`}</option>; }) : <option value={0}>Chưa có ghế đã đặt</option>}</select></label><p><strong>Buổi học:</strong> {session?.subject ?? "Chưa chọn ghế"}<br /><strong>Phòng / ghế:</strong> {session ? `${session.roomCode} / ${seatNumber ?? "—"}` : "—"}</p><form onSubmit={submit} className="ws-form" style={{ gridTemplateColumns: "1fr" }}><label className="ws-field">Mã QR / mã nhập thủ công<input required value={code} onChange={e => { setCode(e.target.value); setResult(""); }} placeholder="Nhập mã giảng viên hiển thị dưới QR" /></label><small className="ws-qr-manual-hint">Nếu không quét được, nhập chuỗi mã giảng viên cung cấp bên dưới hình QR.</small><button className="ws-button" type="submit" disabled={busy || !session || !seatId}>{busy ? "Đang xác nhận..." : "Xác nhận check-in"} <ArrowRight size={15} /></button></form>{result && <div className="ws-qr-result" role="status">{result}</div>}{error && <div className="ws-form-error" role="alert">{error}</div>}</div></div>;
}
