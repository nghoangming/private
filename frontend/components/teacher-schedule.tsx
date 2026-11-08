"use client";

import { useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { SessionApiDetails } from "@/components/api-details";
import type { WorkspaceContext } from "@/lib/workspace-types";
import { SessionStatus, SessionStatusLegend } from "@/components/session-status";
import { WeekNavigator } from "@/components/week-navigator";
import { campusApi } from "@/lib/campus-api";
import type { Session } from "@/lib/demo-campus";
import { bookingName, viDate, viTime } from "@/lib/workspace-types";

const dateKey = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export function TeacherSchedule({ context: c }: { context: WorkspaceContext }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [weekDate, setWeekDate] = useState<string | null>(null);
  const [error, setError] = useState("");
  const today = dateKey(new Date().toISOString());
  const todayUtc = new Date(`${weekDate ?? today}T00:00:00Z`);
  const monday = new Date(todayUtc);
  monday.setUTCDate(todayUtc.getUTCDate() - ((todayUtc.getUTCDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return { key: date.toISOString().slice(0, 10), label: index === 6 ? "Chủ nhật" : `Thứ ${index + 2}`, date: `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}` };
  });
  const weekEnd = days[6].key;
  const sessions = [...c.data.sessions].filter(session => session.teacherId === c.account.id && dateKey(session.startTime) >= days[0].key && dateKey(session.startTime) <= weekEnd).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const activeDay = days.some(day => day.key === selectedDay) ? selectedDay! : days.some(day => day.key === today) ? today : days[0].key;
  const moveWeek = (weeks: number) => { const date = new Date(`${days[0].key}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + weeks * 7); setWeekDate(date.toISOString().slice(0, 10)); setSelectedDay(null); setSelectedId(null); };
  const jumpTo = (date: string) => { setWeekDate(date); setSelectedDay(date); setSelectedId(null); };
  const activeLabel = days.find(day => day.key === activeDay);
  const daySessions = sessions.filter(session => dateKey(session.startTime) === activeDay);
  const selected = sessions.find(session => session.id === selectedId);
  const bookingStatus = selected ? c.data.reservations.find(item => item.id === selected.bookingId)?.status : undefined;
  const reportAbsence = (session: Session) => c.confirm(
    "Báo vắng buổi học?",
    `${session.subject} · ${viDate(session.startTime)}. Phòng sẽ được giải phóng và sinh viên sẽ thấy trạng thái báo vắng.`,
    async () => {
      setError("");
      try {
        const saved = await campusApi.reportAbsence(session.id);
        c.update("sessions", c.data.sessions.map(item => item.id === saved.id ? { ...item, calendarStatus: "ABSENT" } : item));
        c.update("reservations", c.data.reservations.map(item => item.id === session.bookingId ? { ...item, status: "CANCELLED" } : item));
        c.notice("Đã báo vắng và giải phóng phòng học.");
        setSelectedId(null);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Không thể báo vắng.");
      }
    },
  );
  return <div className="ws-calendar ws-teacher-week"><WeekNavigator title="Lịch giảng dạy" from={days[0].key} to={days[6].key} selectedDate={activeDay} onMove={moveWeek} onSelect={jumpTo} onToday={() => { setWeekDate(null); setSelectedDay(null); }} /><div className="ws-calendar-days">{days.map(day => { const dayItems = sessions.filter(session => dateKey(session.startTime) === day.key); return <button type="button" key={day.key} className={`ws-calendar-day day-${days.indexOf(day)} ${day.key === activeDay ? "active" : ""} ${day.key < today ? "past" : ""}`} onClick={() => setSelectedDay(day.key)} aria-pressed={day.key === activeDay}><span>{day.label}</span><strong>{day.date}</strong><small className="ws-calendar-dots" aria-label={`${dayItems.length} buổi dạy`}>{dayItems.map(item => <i key={item.id} className={(item.calendarStatus ?? "SCHEDULED").toLowerCase()} />)}{dayItems.length === 0 && <span className="none">—</span>}</small></button>; })}</div><SessionStatusLegend teacher /><section className="ws-calendar-detail">{error && <p className="ws-form-error" role="alert">{error}</p>}<div className="ws-calendar-detail-head"><div><span>LỊCH TRONG NGÀY</span><h3>{activeLabel?.label}, {activeLabel?.date}</h3></div><strong>{daySessions.length} buổi dạy</strong></div>{daySessions.length ? <div className="ws-calendar-list">{daySessions.map(session => {
  const approved = c.data.reservations.some(booking => booking.id === session.bookingId && booking.status === "CONFIRMED");
  return <div key={session.id} className={`ws-calendar-class ws-teacher-calendar-class ${(session.calendarStatus ?? "SCHEDULED").toLowerCase()}`}>
    <button type="button" className="ws-calendar-main" onClick={() => setSelectedId(session.id)} aria-label={`Xem chi tiết ${session.subject}`}>
      <span className="ws-calendar-time">{viTime(session.startTime)}<small>{viTime(session.endTime)}</small></span>
      <span className="ws-calendar-subject"><small>{session.className === "DEMO" ? "BUỔI DẠY" : session.className}</small><strong>{session.subject}</strong><em>Phòng {session.roomCode}</em><SessionStatus status={session.calendarStatus} teacher /></span>
      <ArrowRight size={18} />
    </button>
    {approved && session.calendarStatus !== "ABSENT" && <button type="button" className="ws-calendar-absence-action" onClick={() => reportAbsence(session)}>Báo vắng</button>}
  </div>;
})}</div> : <p className="ws-calendar-empty">{activeDay < today ? "Ngày này đã qua." : "Không có buổi dạy trong ngày này."}</p>}</section>{selected && <div className="ws-seat-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedId(null); }}><section className="ws-teacher-class-dialog" role="dialog" aria-modal="true" aria-label="Chi tiết buổi dạy"><button type="button" className="ws-student-close" onClick={() => setSelectedId(null)} aria-label="Đóng"><X size={19} /></button><div className="ws-teacher-detail-head"><span>BUỔI DẠY #{selected.id}</span><span className={`ws-teacher-detail-status ${bookingStatus?.toLowerCase() ?? "pending"}`}>{selected.calendarStatus === "ABSENT" ? "Đã báo vắng" : bookingStatus ? bookingName[bookingStatus] : "Chưa có trạng thái"}</span></div><div className="ws-teacher-detail-main"><div className="ws-teacher-detail-date"><strong>{viDate(selected.startTime).slice(0, 5)}</strong><span>{viDate(selected.startTime).slice(6)}</span></div><div><small>{selected.className === "DEMO" ? "BUỔI HỌC" : selected.className}</small><h3>{selected.subject}</h3><SessionStatus status={selected.calendarStatus} teacher /><p>Thông tin buổi dạy và phòng học</p></div></div><div className="ws-teacher-class-facts"><div><small>THỜI GIAN</small><strong>{viTime(selected.startTime)} – {viTime(selected.endTime)}</strong></div><div><small>PHÒNG HỌC</small><strong>{selected.roomCode}</strong></div><div><small>NGÀY DẠY</small><strong>{viDate(selected.startTime)}</strong></div></div><div className="ws-teacher-detail-footer"><button type="button" className="ws-button secondary" onClick={() => setSelectedId(null)}>Đóng chi tiết</button></div></section></div>}</div>;
}
