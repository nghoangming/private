"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { ArrowRight, CalendarDays, Clock3, RefreshCw, UserRoundX } from "lucide-react";
import { campusApi, type ApiAbsenceRequest } from "@/lib/campus-api";
import type { WorkspaceContext } from "@/lib/workspace-types";
import { viDate, viTime } from "@/lib/workspace-types";

type Choice = { sessionId: number };
const labels: Record<ApiAbsenceRequest["status"], string> = {
  PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", REJECTED: "Đã từ chối", CANCELLED: "Đã hủy",
};

export function AbsenceView({ context: c, choices = [] }: { context: WorkspaceContext; choices?: Choice[] }) {
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [sessionId, setSessionId] = useState(0);
  const [teacherReason, setTeacherReason] = useState("");
  const [teacherSessionId, setTeacherSessionId] = useState(0);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const { data: requests = [], error: loadError, isLoading, mutate } = useSWR(
    ["absence-requests", c.role, c.account.id], campusApi.absenceRequests,
    { revalidateOnFocus: true, refreshInterval: 30000 },
  );
  const isStudent = c.role === "STUDENT";
  const isTeacher = c.role === "TEACHER";
  const relevant = requests.filter(request => isStudent
    ? request.type === "STUDENT" && request.userId === c.account.id
    : c.role === "TEACHER" ? request.type === "STUDENT" : request.type === "TEACHER");
  const ownTeacherRequests = isTeacher ? requests.filter(request => request.type === "TEACHER" && request.userId === c.account.id) : [];
  const visible = relevant.filter(request => isStudent || filter === "ALL" || request.status === "PENDING");
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visible.length / 5)));
  const pageItems = visible.slice((currentPage - 1) * 5, currentPage * 5);
  const now = Date.now();
  const eligible = isStudent ? c.data.sessions.filter(session =>
    choices.some(choice => choice.sessionId === session.id)
    && c.data.reservations.some(booking => booking.id === session.bookingId && booking.status === "CONFIRMED")
    && session.calendarStatus !== "ABSENT"
    && new Date(session.startTime).getTime() - now >= 15 * 60_000
    && !relevant.some(request => request.classSessionId === session.id && ["PENDING", "APPROVED"].includes(request.status)),
  ).sort((a, b) => a.startTime.localeCompare(b.startTime)) : [];
  const chosenSessionId = eligible.some(session => session.id === sessionId) ? sessionId : eligible[0]?.id ?? 0;
  const teacherEligible = isTeacher ? c.data.sessions.filter(session =>
    session.teacherId === c.account.id
    && c.data.reservations.some(booking => booking.id === session.bookingId && booking.status === "CONFIRMED")
    && session.calendarStatus !== "ABSENT" && session.calendarStatus !== "ABSENCE_PENDING"
    && new Date(session.startTime).getTime() - now >= 60 * 60_000
    && !ownTeacherRequests.some(request => request.classSessionId === session.id && ["PENDING", "APPROVED"].includes(request.status)),
  ).sort((a, b) => a.startTime.localeCompare(b.startTime)) : [];
  const chosenTeacherSessionId = teacherEligible.some(session => session.id === teacherSessionId) ? teacherSessionId : teacherEligible[0]?.id ?? 0;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = reason.trim();
    if (!chosenSessionId || trimmed.length < 5) { setError("Chọn buổi học và nhập lý do ít nhất 5 ký tự."); return; }
    const session = eligible.find(item => item.id === chosenSessionId)!;
    c.confirm("Gửi đơn báo vắng?", `${session.subject} · ${viDate(session.startTime)} ${viTime(session.startTime)}. Giảng viên sẽ quyết định duyệt hoặc từ chối.`, async () => {
      setBusy(true); setError("");
      try {
        await campusApi.requestStudentAbsence(chosenSessionId, trimmed);
        await mutate();
        setReason(""); setSessionId(0);
        c.notice("Đã gửi đơn báo vắng cho giảng viên duyệt.");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể gửi đơn báo vắng."); }
      finally { setBusy(false); }
    });
  };

  const submitTeacher = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = teacherReason.trim();
    if (!chosenTeacherSessionId || trimmed.length < 5) { setError("Chọn buổi dạy và nhập lý do ít nhất 5 ký tự."); return; }
    const session = teacherEligible.find(item => item.id === chosenTeacherSessionId)!;
    c.confirm("Gửi yêu cầu báo vắng?", `${session.subject} · ${viDate(session.startTime)} ${viTime(session.startTime)}. Admin sẽ quyết định duyệt hoặc từ chối.`, async () => {
      setBusy(true); setError("");
      try {
        await campusApi.reportAbsence(chosenTeacherSessionId, trimmed);
        c.update("sessions", c.data.sessions.map(item => item.id === chosenTeacherSessionId ? { ...item, calendarStatus: "ABSENCE_PENDING" } : item));
        await mutate();
        setTeacherReason(""); setTeacherSessionId(0);
        c.notice("Đã gửi yêu cầu báo vắng đến quản trị viên.");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể báo vắng buổi dạy."); }
      finally { setBusy(false); }
    });
  };

  const review = (request: ApiAbsenceRequest, approve: boolean) => {
    const session = c.data.sessions.find(item => item.id === request.classSessionId);
    c.confirm(approve ? "Duyệt báo vắng?" : "Từ chối báo vắng?",
      `${session?.subject ?? `Buổi học #${request.classSessionId}`} · ${c.role === "ADMIN" ? "giảng viên" : "sinh viên"} #${request.userId}.${c.role === "ADMIN" && approve ? " Phòng sẽ được giải phóng và người liên quan nhận thông báo." : ""}`,
      async () => {
        setBusy(true); setError("");
        try {
          if (c.role === "ADMIN") {
            const saved = await campusApi.reviewAbsence(request.classSessionId, approve ? "approve" : "reject");
            c.update("sessions", c.data.sessions.map(item => item.id === saved.id ? { ...item, calendarStatus: saved.calendarStatus } : item));
            if (approve) c.update("reservations", c.data.reservations.map(item => item.id === saved.bookingId ? { ...item, status: "CANCELLED" } : item));
          } else {
            await campusApi.reviewStudentAbsence(request.id, approve, notes[request.id] ?? "");
          }
          await mutate();
          c.notice(approve ? "Đã duyệt yêu cầu báo vắng." : "Đã từ chối yêu cầu báo vắng.");
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể xử lý yêu cầu."); }
        finally { setBusy(false); }
      });
  };

  return <div className="ws-absence-page">
    <div className="ws-absence-intro"><span className="ws-absence-icon"><UserRoundX size={24} /></span><div><h3>{isStudent ? "Báo vắng buổi học" : c.role === "TEACHER" ? "Duyệt báo vắng sinh viên" : "Duyệt báo vắng giảng viên"}</h3><p>{isStudent ? "Gửi trước giờ học ít nhất 15 phút, khi bạn đã đặt ghế. Đơn chỉ có hiệu lực sau khi giảng viên duyệt." : c.role === "TEACHER" ? "Kiểm tra lý do và quyết định từng đơn của sinh viên trong lớp mình." : "Yêu cầu giảng viên đã gửi trước giờ học ít nhất một tiếng sẽ xuất hiện ở đây."}</p></div><button type="button" className="ws-button secondary" onClick={() => void mutate()} aria-label="Tải lại yêu cầu"><RefreshCw size={16} /> Tải lại</button></div>
    {isStudent && <section className="ws-panel ws-absence-form"><div className="ws-panel-header"><div><h3>Gửi đơn mới</h3><p>Chỉ hiển thị buổi học đủ điều kiện báo vắng</p></div></div><form onSubmit={submit}><label className="ws-field">Buổi học<select value={chosenSessionId} onChange={event => setSessionId(Number(event.target.value))} disabled={!eligible.length}><option value={0}>Chọn buổi học</option>{eligible.map(session => <option key={session.id} value={session.id}>{session.subject} · {viDate(session.startTime)} {viTime(session.startTime)} · {session.roomCode}</option>)}</select></label><label className="ws-field">Lý do báo vắng<textarea required minLength={5} maxLength={1000} rows={3} value={reason} onChange={event => setReason(event.target.value)} placeholder="Nhập lý do để giảng viên xem xét..." /></label><div className="ws-absence-form-footer"><span>{eligible.length ? "Gửi đơn không đồng nghĩa với được duyệt." : "Cần có ghế đã đặt và còn ít nhất 15 phút trước giờ học."}</span><button className="ws-button" type="submit" disabled={!eligible.length || busy}>Gửi đơn <ArrowRight size={16} /></button></div></form></section>}
    {isTeacher && <section className="ws-panel ws-absence-form"><div className="ws-panel-header"><div><h3>Báo vắng buổi dạy</h3><p>Gửi trước giờ học ít nhất một tiếng để admin duyệt</p></div></div><form onSubmit={submitTeacher}><label className="ws-field">Buổi dạy<select value={chosenTeacherSessionId} onChange={event => setTeacherSessionId(Number(event.target.value))} disabled={!teacherEligible.length}><option value={0}>Chọn buổi dạy</option>{teacherEligible.map(session => <option key={session.id} value={session.id}>{session.subject} · {viDate(session.startTime)} {viTime(session.startTime)} · {session.roomCode}</option>)}</select></label><label className="ws-field">Lý do báo vắng<textarea required minLength={5} maxLength={1000} rows={3} value={teacherReason} onChange={event => setTeacherReason(event.target.value)} placeholder="Nhập lý do để quản trị viên xem xét..." /></label><div className="ws-absence-form-footer"><span>{teacherEligible.length ? "Lịch học và phòng chỉ thay đổi sau khi admin duyệt." : "Hiện không có buổi dạy đủ điều kiện báo vắng."}</span><button className="ws-button" type="submit" disabled={!teacherEligible.length || busy}>Gửi yêu cầu <ArrowRight size={16} /></button></div></form>{ownTeacherRequests.length > 0 && <div className="ws-absence-own"><strong>Yêu cầu đã gửi</strong>{ownTeacherRequests.slice(0, 5).map(request => <div key={request.id}><span>{c.data.sessions.find(session => session.id === request.classSessionId)?.subject ?? `Buổi học #${request.classSessionId}`}</span><span className={`ws-tag ${request.status.toLowerCase()}`}>{labels[request.status]}</span></div>)}</div>}</section>}
    <section className="ws-panel ws-absence-list"><div className="ws-panel-header"><div><h3>{isStudent ? "Đơn của tôi" : "Danh sách yêu cầu"}</h3><p>{relevant.length} yêu cầu</p></div>{!isStudent && <select className="ws-select" aria-label="Lọc yêu cầu báo vắng" value={filter} onChange={event => { setFilter(event.target.value as "PENDING" | "ALL"); setPage(1); }}><option value="PENDING">Chờ duyệt</option><option value="ALL">Tất cả</option></select>}</div>
      {error && <p className="ws-form-error" role="alert">{error}</p>}
      {loadError && <p className="ws-form-error" role="alert">Không tải được yêu cầu báo vắng. Hãy bấm Tải lại.</p>}
      {isLoading && <p className="ws-absence-empty">Đang tải yêu cầu...</p>}
      {!isLoading && !loadError && !visible.length && <p className="ws-absence-empty">{isStudent ? "Bạn chưa gửi đơn báo vắng nào." : "Không có yêu cầu phù hợp."}</p>}
      <div className="ws-absence-items">{pageItems.map(request => { const session = c.data.sessions.find(item => item.id === request.classSessionId); const requester = c.data.users.find(user => user.id === request.userId); return <article className="ws-absence-item" key={request.id}><div className="ws-absence-item-main"><div className="ws-absence-item-top"><strong>{session?.subject ?? `Buổi học #${request.classSessionId}`}</strong><span className={`ws-tag ${request.status.toLowerCase()}`}>{labels[request.status]}</span></div><p><CalendarDays size={15} /> {session ? `${viDate(session.startTime)} · ${viTime(session.startTime)} · ${session.roomCode}` : `Buổi học #${request.classSessionId}`}</p>{!isStudent && <small>Người gửi: {requester?.name ?? `${request.type === "TEACHER" ? "Giảng viên" : "Sinh viên"} #${request.userId}`}</small>}<div className="ws-absence-reason"><span>LÝ DO</span><p>{request.reason}</p></div><small><Clock3 size={14} /> Gửi {viDate(request.createdAt)} · {viTime(request.createdAt)}{request.reviewedAt ? ` · Xử lý ${viDate(request.reviewedAt)}` : ""}</small></div>{request.status === "PENDING" && !isStudent && <div className="ws-absence-actions">{c.role === "TEACHER" && <label className="ws-field">Ghi chú phản hồi (không bắt buộc)<textarea rows={2} maxLength={500} value={notes[request.id] ?? ""} onChange={event => setNotes(previous => ({ ...previous, [request.id]: event.target.value }))} placeholder="Ghi chú cho sinh viên..." /></label>}<button type="button" className="ws-button" disabled={busy} onClick={() => review(request, true)}>Duyệt</button><button type="button" className="ws-button secondary" disabled={busy} onClick={() => review(request, false)}>Từ chối</button></div>}</article>; })}</div>
      {visible.length > 5 && <div className="ws-pagination"><span>Hiển thị {(currentPage - 1) * 5 + 1}–{Math.min(currentPage * 5, visible.length)} / {visible.length}</span><div>{Array.from({ length: Math.ceil(visible.length / 5) }, (_, index) => <button type="button" key={index} className={currentPage === index + 1 ? "active" : ""} onClick={() => setPage(index + 1)} aria-current={currentPage === index + 1 ? "page" : undefined}>{index + 1}</button>)}</div></div>}
    </section>
  </div>;
}
