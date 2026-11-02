"use client";

import useSWR from "swr";
import { campusApi } from "@/lib/campus-api";
import { bookingName, viDate, viTime } from "@/lib/workspace-types";

export function RoomApiDetails({ id }: { id: number }) {
  const { data: room, error: roomError } = useSWR(`room-detail-${id}`, () => campusApi.room(id));
  const { data: schedule, error: scheduleError, mutate } = useSWR(`room-schedule-${id}`, () => campusApi.roomSchedule(id));
  return <section className="ws-panel" style={{ padding: 18, marginTop: 16 }}>
    <h3>Thông tin và lịch phòng từ API</h3>
    {(roomError || scheduleError) && <p role="alert">Không tải được dữ liệu phòng. <button className="ws-row-action" onClick={() => void mutate()}>Thử lại</button></p>}
    {room && <p>{room.code} · {room.name} · {room.location} · {room.type} · {room.status}</p>}
    {!schedule && !scheduleError && <p>Đang tải lịch phòng...</p>}
    {schedule?.length === 0 && <p>Phòng chưa có lịch đặt.</p>}
    {schedule && schedule.length > 0 && <div className="ws-table-wrap"><table className="ws-table"><thead><tr><th>YÊU CẦU</th><th>NGÀY</th><th>GIỜ</th><th>TRẠNG THÁI</th></tr></thead><tbody>{schedule.map(x => <tr key={x.bookingId}><td>#{x.bookingId}</td><td>{viDate(x.startTime)}</td><td>{viTime(x.startTime)} – {viTime(x.endTime)}</td><td>{bookingName[x.status] ?? x.status}</td></tr>)}</tbody></table></div>}
  </section>;
}

export function ReservationApiDetails({ id, kind }: { id: number; kind: "classroom" | "study" }) {
  const { data, error } = useSWR(`reservation-detail-${kind}-${id}`, () => campusApi.reservation(kind, id));
  if (error) return <p role="alert">Không tải được chi tiết yêu cầu từ API.</p>;
  if (!data) return <p>Đang tải chi tiết yêu cầu...</p>;
  return <p>Chi tiết API: Yêu cầu #{data.id} · Người gửi #{data.userId} · Phòng #{data.roomId} · {viDate(data.startTime)} {viTime(data.startTime)}–{viTime(data.endTime)} · {bookingName[data.status]}</p>;
}

export function SessionApiDetails({ id, bookingStatus }: { id: number; bookingStatus?: string }) {
  const { data, error } = useSWR(`session-detail-${id}`, () => campusApi.session(id));
  if (error) return <p role="alert">Không tải được chi tiết buổi học từ API.</p>;
  if (!data) return <p>Đang tải chi tiết buổi học...</p>;
  return <p>Chi tiết API: {data.courseCode === "DEMO" ? "Chưa có mã học phần" : data.courseCode} · {data.title} · Yêu cầu #{data.bookingId}{bookingStatus ? ` · ${bookingName[bookingStatus as keyof typeof bookingName] ?? bookingStatus}` : ""} · {viDate(data.startTime)} {viTime(data.startTime)}–{viTime(data.endTime)}</p>;
}

export function SeatReservationApiDetails({ id }: { id: number }) {
  const { data, error } = useSWR(`seat-reservation-detail-${id}`, () => campusApi.seatReservation(id));
  if (error) return <p role="alert">Không tải được chi tiết đặt ghế từ API.</p>;
  if (!data) return <p>Đang tải chi tiết đặt ghế...</p>;
  return <p>Chi tiết API: Lượt đặt #{data.id} · Buổi học #{data.classSessionId} · Ghế #{data.seatId} · {data.status}</p>;
}
