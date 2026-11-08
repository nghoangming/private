import { demoAuth } from "@/lib/demo-auth";

export type ApiRoom = { id: number; code: string; name: string; location: string; status: "ACTIVE" | "MAINTENANCE"; type: "THEORY" | "LAB" | "STUDY"; capacity: number };
export type ApiRoomWrite = Omit<ApiRoom, "id">;

export async function availableRooms(date: string, startTime: string, endTime: string): Promise<ApiRoom[]> {
  const params = new URLSearchParams({ date, startTime, endTime });
  const response = await fetch(`/api/v1/rooms/availability?${params}`);
  if (!response.ok) throw new Error(`Không thể tải phòng trống (HTTP ${response.status}).`);
  return response.json() as Promise<ApiRoom[]>;
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const token = demoAuth.token();
  if (!token) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  const response = await fetch(`/api/v1${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options?.headers } });
  if (response.status === 401) {
    const role = demoAuth.current()?.role;
    demoAuth.signOut();
    window.location.assign(role === "ADMIN" ? "/admin/login" : "/login");
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string; detail?: string } | null;
    throw new Error(response.status === 409
      ? `409 Conflict: ${body?.message ?? "Tài nguyên đã được đặt trong khung giờ này."}`
      : body?.message ?? body?.detail ?? `API ${response.status}: ${path}`);
  }
  return response.json() as Promise<T>;
}

export type ApiReservation = { id: number; userId: number; roomId: number; startTime: string; endTime: string; status: "PENDING" | "CONFIRMED" | "CANCELLED" | "REJECTED"; createdAt: string };
export type ApiClassSession = { id: number; bookingId: number; courseCode: string; title: string; roomId: number; startTime: string; endTime: string; calendarStatus?: "SCHEDULED" | "ABSENT" | "MAKEUP" };
export type ApiSeat = { id: number; roomId: number; seatNumber: number; status: "AVAILABLE" | "RESERVED" | "DISABLED" | "OCCUPIED" | "MAINTENANCE" };
export type ApiSeatReservation = { id: number; classSessionId: number; seatId: number; userId: number; roomId: number; status: string };
export type ApiQr = { classSessionId: number; token: string; expiresAt: string };
export type ApiAttendance = { id: number | null; classSessionId: number; userId: number; seatId: number; seatNumber: number; status: "PRESENT" | "NOT_CHECKED_IN"; checkedInAt: string | null };
export type ApiRoomSchedule = { bookingId: number; startTime: string; endTime: string; status: ApiReservation["status"] };
export const campusApi = {
  rooms: () => api<ApiRoom[]>("/rooms"),
  room: (id: number) => api<ApiRoom>(`/rooms/${id}`),
  createRoom: (data: ApiRoomWrite) => api<ApiRoom>("/rooms", { method: "POST", body: JSON.stringify(data) }),
  updateRoom: (id: number, data: ApiRoomWrite) => api<ApiRoom>(`/rooms/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  roomSchedule: (id: number, date: string) => api<ApiRoomSchedule[]>(`/rooms/${id}/schedule?date=${encodeURIComponent(date)}`),
  reservations: async () => [...await api<ApiReservation[]>("/classroom-reservations"), ...await api<ApiReservation[]>("/study-room-reservations")],
  reservation: (kind: "classroom" | "study", id: number) => api<ApiReservation>(`/${kind === "study" ? "study-room-reservations" : "classroom-reservations"}/${id}`),
  createReservation: (kind: "classroom" | "study", data: { roomId: number; startTime: string; endTime: string }, _userId: number) => api<ApiReservation>(`/${kind === "study" ? "study-room-reservations" : "classroom-reservations"}`, { method: "POST", body: JSON.stringify(data) }),
  cancelReservation: (kind: "classroom" | "study", id: number) => api<ApiReservation>(`/${kind === "study" ? "study-room-reservations" : "classroom-reservations"}/${id}/cancel`, { method: "PATCH" }),
  reviewReservation: (kind: "classroom" | "study", id: number, decision: "approve" | "reject") => api<ApiReservation>(`/${kind === "study" ? "study-room-reservations" : "classroom-reservations"}/${id}/${decision}`, { method: "PATCH" }),
  sessions: (date?: string) => api<ApiClassSession[]>(`/class-sessions${date ? `?date=${encodeURIComponent(date)}` : ""}`),
  sessionsBetween: (from: string, to: string) => api<ApiClassSession[]>(`/class-sessions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  session: (id: number) => api<ApiClassSession>(`/class-sessions/${id}`),
  createSession: (bookingId: number, courseCode: string, title: string, makeup = false) => api<ApiClassSession>("/class-sessions", { method: "POST", body: JSON.stringify({ bookingId, courseCode, title, makeup }) }),
  reportAbsence: (id: number) => api<ApiClassSession>(`/class-sessions/${id}/absence`, { method: "PATCH" }),
  seats: (sessionId: number) => api<ApiSeat[]>(`/class-sessions/${sessionId}/seats`),
  mySeats: (_userId: number) => api<ApiSeatReservation[]>("/seat-reservations/mine"),
  seatReservation: (id: number) => api<ApiSeatReservation>(`/seat-reservations/${id}`),
  chooseSeat: (_userId: number, classSessionId: number, seatId: number) => api<ApiSeatReservation>("/seat-reservations", { method: "POST", body: JSON.stringify({ classSessionId, seatId }) }),
  cancelSeat: (id: number) => api<ApiSeatReservation>(`/seat-reservations/${id}/cancel`, { method: "PATCH" }),
  generateQr: (classSessionId: number, _teacherId: number) => api<ApiQr>(`/class-sessions/${classSessionId}/qr`, { method: "POST" }),
  checkIn: (qrCode: string, classSessionId: number, _studentId: number) => api<ApiAttendance>("/attendance/check-in", { method: "POST", body: JSON.stringify({ qrCode, classSessionId }) }),
  attendance: (classSessionId: number, _teacherId: number) => api<ApiAttendance[]>(`/attendance?classSessionId=${classSessionId}`),
  myAttendance: () => api<number[]>("/attendance/mine"),
  cancelAttendance: async (id: number, _teacherId: number) => {
    const token = demoAuth.token();
    if (!token) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    const response = await fetch(`/api/v1/attendance/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string } | null;
      throw new Error(body?.message ?? `Không thể hủy điểm danh (HTTP ${response.status}).`);
    }
  },
};
