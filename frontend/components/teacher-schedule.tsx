"use client";

import { useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { SessionApiDetails } from "@/components/api-details";
import type { WorkspaceContext } from "@/lib/workspace-types";
import { bookingName, viDate, viTime } from "@/lib/workspace-types";

const dateKey = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export function TeacherSchedule({ context: c }: { context: WorkspaceContext }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const today = dateKey(new Date().toISOString());
  const todayUtc = new Date(`${today}T00:00:00Z`);
  const monday = new Date(todayUtc);
  monday.setUTCDate(todayUtc.getUTCDate() - ((todayUtc.getUTCDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return { key: date.toISOString().slice(0, 10), label: index === 6 ? "Chủ nhật" : `Thứ ${index + 2}`, date: `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}` };
  });
  const weekEnd = days[6].key;
  const sessions = [...c.data.sessions].filter(session => session.teacherId === c.account.id && dateKey(session.startTime) >= days[0].key && dateKey(session.startTime) <= weekEnd).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const activeDay = days.some(day => day.key === selectedDay) ? selectedDay! : today;
  const activeLabel = days.find(day => day.key === activeDay);
  const daySessions = sessions.filter(session => dateKey(session.startTime) === activeDay);
  const selected = sessions.find(session => session.id === selectedId);
  const bookingStatus = selected ? c.data.reservations.find(item => item.id === selected.bookingId)?.status : undefined;
  return <div className="ws-calendar ws-teacher-week"><div className="ws-week-heading"><strong>Lịch giảng dạy tuần này</strong><span>{days[0].date} – {days[6].date} · Chọn ngày để xem buổi dạy</span></div><div className="ws-calendar-days">{days.map(day => { const dayItems = sessions.filter(session => dateKey(session.startTime) === day.key); return <button type="button" key={day.key} className={`ws-calendar-day day-${days.indexOf(day)} ${day.key === activeDay ? "active" : ""} ${day.key < today ? "past" : ""}`} onClick={() => setSelectedDay(day.key)} aria-pressed={day.key === activeDay}><span>{day.label}</span><strong>{day.date}</strong><small className="ws-calendar-dots" aria-label={`${dayItems.length} buổi dạy`}>{dayItems.map(item => <i key={item.id} className={(item.calendarStatus ?? "SCHEDULED").toLowerCase()} />)}{dayItems.length === 0 && <span className="none">—</span>}</small></button>; })}</div><div className="ws-calendar-legend"><span><i className="scheduled" /> Có tiết</span><span><i className="absent" /> Báo vắng</span><span><i className="makeup" /> Dạy bù</span></div><section className="ws-calendar-detail"><div className="ws-calendar-detail-head"><div><span>LỊCH TRONG NGÀY</span><h3>{activeLabel?.label}, {activeLabel?.date}</h3></div><strong>{daySessions.length} buổi dạy</strong></div>{daySessions.length ? <div className="ws-calendar-list">{daySessions.map(session => <button type="button" key={session.id} className={`ws-calendar-class ${(session.calendarStatus ?? "SCHEDULED").toLowerCase()}`} onClick={() => setSelectedId(session.id)}><span className="ws-calendar-time">{viTime(session.startTime)}<small>{viTime(session.endTime)}</small></span><span className="ws-calendar-subject"><small>{session.className === "DEMO" ? "BUỔI DẠY" : session.className}</small><strong>{session.subject}</strong><em>Phòng {session.roomCode}</em></span><ArrowRight size={18} /></button>)}</div> : <p className="ws-calendar-empty">{activeDay < today ? "Ngày này đã qua." : "Không có buổi dạy trong ngày này."}</p>}</section>{selected && <div className="ws-seat-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedId(null); }}><section className="ws-teacher-class-dialog" role="dialog" aria-modal="true" aria-label="Chi tiết buổi dạy"><button type="button" className="ws-student-close" onClick={() => setSelectedId(null)} aria-label="Đóng"><X size={19} /></button><div className="ws-teacher-detail-head"><span>BUỔI DẠY #{selected.id}</span><span className={`ws-teacher-detail-status ${bookingStatus?.toLowerCase() ?? "pending"}`}>{bookingStatus ? bookingName[bookingStatus] : "Chưa có trạng thái"}</span></div><div className="ws-teacher-detail-main"><div className="ws-teacher-detail-date"><strong>{viDate(selected.startTime).slice(0, 5)}</strong><span>{viDate(selected.startTime).slice(6)}</span></div><div><small>{selected.className === "DEMO" ? "BUỔI HỌC" : selected.className}</small><h3>{selected.subject}</h3><p>Thông tin buổi dạy và phòng học</p></div></div><div className="ws-teacher-class-facts"><div><small>THỜI GIAN</small><strong>{viTime(selected.startTime)} – {viTime(selected.endTime)}</strong></div><div><small>PHÒNG HỌC</small><strong>{selected.roomCode}</strong></div><div><small>NGÀY DẠY</small><strong>{viDate(selected.startTime)}</strong></div></div><div className="ws-teacher-detail-footer"><button type="button" className="ws-button secondary" onClick={() => setSelectedId(null)}>Đóng chi tiết</button></div></section></div>}</div>;
}
