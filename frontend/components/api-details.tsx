"use client";

import useSWR from "swr";
import { useState } from "react";
import { campusApi } from "@/lib/campus-api";
import { bookingName, viDate, viTime } from "@/lib/workspace-types";

export function RoomApiDetails({ id }: { id: number }) {
  const [date, setDate] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  const { data: room, error: roomError } = useSWR(`room-detail-${id}`, () => campusApi.room(id));
  const { data: schedule, error: scheduleError, mutate } = useSWR(`room-schedule-${id}-${date}`, () => campusApi.roomSchedule(id, date));
  return <section className="ws-room-schedule">
    <div className="ws-room-schedule-head"><div><span>LỊCH SỬ DỤNG</span><h4>{room ? `Phòng ${room.code}` : "Đang tải phòng..."}</h4></div><label className="ws-field">Chọn ngày<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label></div>
    {(roomError || scheduleError) && <p role="alert">Không tải được lịch phòng. <button className="ws-row-action" onClick={() => void mutate()}>Thử lại</button></p>}
    {!schedule && !scheduleError && <p className="ws-room-schedule-empty">Đang tải lịch phòng...</p>}
    {schedule?.length === 0 && <p className="ws-room-schedule-empty">Không có lịch sử dụng trong ngày này.</p>}
    {schedule && schedule.length > 0 && <div className="ws-room-schedule-list">{schedule.map(x => <div key={x.bookingId}><strong>{viTime(x.startTime)} – {viTime(x.endTime)}</strong><span>Yêu cầu #{x.bookingId}</span><em>{bookingName[x.status] ?? x.status}</em></div>)}</div>}
  </section>;
}

export function ReservationApiDetails({ id, kind }: { id: number; kind: "classroom" | "study" }) {
  const { data, error } = useSWR(`reservation-detail-${kind}-${id}`, () => campusApi.reservation(kind, id));
  if (error) return <p role="alert">Không tải được chi tiết yêu cầu.</p>;
  if (!data) return <p>Đang tải chi tiết yêu cầu...</p>;
  return <p>Yêu cầu #{data.id} · Người gửi #{data.userId} · {viDate(data.startTime)} {viTime(data.startTime)}–{viTime(data.endTime)} · {bookingName[data.status]}</p>;
}

export function SessionApiDetails({ id, bookingStatus }: { id: number; bookingStatus?: string }) {
  const { data, error } = useSWR(`session-detail-${id}`, () => campusApi.session(id));
  if (error) return <p role="alert">Không tải được chi tiết buổi học.</p>;
  if (!data) return <p>Đang tải chi tiết buổi học...</p>;
  return <p>{data.courseCode === "DEMO" ? "Buổi học" : data.courseCode} · {data.title} · Yêu cầu #{data.bookingId}{bookingStatus ? ` · ${bookingName[bookingStatus as keyof typeof bookingName] ?? bookingStatus}` : ""} · {viDate(data.startTime)} {viTime(data.startTime)}–{viTime(data.endTime)}</p>;
}

export function SeatReservationApiDetails({ id }: { id: number }) {
  const { data, error } = useSWR(`seat-reservation-detail-${id}`, () => campusApi.seatReservation(id));
  if (error) return <p role="alert">Không tải được chi tiết đặt ghế.</p>;
  if (!data) return <p>Đang tải chi tiết đặt ghế...</p>;
  return <p>Lượt đặt #{data.id} · Buổi học #{data.classSessionId} · Ghế #{data.seatId} · {data.status}</p>;
}
