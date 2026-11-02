import { demoAuth } from "@/lib/demo-auth";

export type ApiRoom = { id: number; code: string; name: string; location: string; status: string; type: "THEORY" | "LAB" | "STUDY" };

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
export type ApiClassSession = { id: number; bookingId: number; courseCode: string; title: string; roomId: number; startTime: string; endTime: string };
export type ApiSeat = { id: number; roomId: number; seatNumber: number; status: "AVAILABLE" | "RESERVED" | "DISABLED" | "OCCUPIED" | "MAINTENANCE" };
export type ApiSeatReservation = { id: number; classSessionId: number; seatId: number; userId: number; roomId: number; status: string };
export type ApiQr = { classSessionId: number; token: string; expiresAt: string };
export type ApiAttendance = { id: number | null; classSessionId: number; userId: number; seatId: number; seatNumber: number; status: "PRESENT" | "NOT_CHECKED_IN"; checkedInAt: string | null };
export const campusApi = {
  rooms: () => api<ApiRoom[]>("/rooms"),
  reservations: async () => [...await api<ApiReservation[]>("/classroom-reservations"), ...await api<ApiReservation[]>("/study-room-reservations")],
  createReservation: (kind: "classroom" | "study", data: { roomId: number; startTime: string; endTime: string }, _userId: number) => api<ApiReservation>(`/${kind === "study" ? "study-room-reservations" : "classroom-reservations"}`, { method: "POST", body: JSON.stringify(data) }),
  cancelReservation: (kind: "classroom" | "study", id: number) => api<ApiReservation>(`/${kind === "study" ? "study-room-reservations" : "classroom-reservations"}/${id}/cancel`, { method: "PATCH" }),
  reviewReservation: (kind: "classroom" | "study", id: number, decision: "approve" | "reject") => api<ApiReservation>(`/${kind === "study" ? "study-room-reservations" : "classroom-reservations"}/${id}/${decision}`, { method: "PATCH" }),
  sessions: () => api<ApiClassSession[]>("/class-sessions"),
  createSession: (bookingId: number, title: string) => api<ApiClassSession>("/class-sessions", { method: "POST", body: JSON.stringify({ bookingId, courseCode: "DEMO", title }) }),
  seats: (sessionId: number) => api<ApiSeat[]>(`/class-sessions/${sessionId}/seats`),
  mySeat: async (_userId: number) => (await api<ApiSeatReservation[]>("/seat-reservations/mine"))[0] ?? null,
  chooseSeat: (_userId: number, classSessionId: number, seatId: number) => api<ApiSeatReservation>("/seat-reservations", { method: "POST", body: JSON.stringify({ classSessionId, seatId }) }),
  cancelSeat: (id: number) => api<ApiSeatReservation>(`/seat-reservations/${id}/cancel`, { method: "PATCH" }),
  generateQr: (classSessionId: number, _teacherId: number) => api<ApiQr>(`/class-sessions/${classSessionId}/qr`, { method: "POST" }),
  checkIn: (qrCode: string, classSessionId: number, _studentId: number) => api<ApiAttendance>("/attendance/check-in", { method: "POST", body: JSON.stringify({ qrCode, classSessionId }) }),
  attendance: (classSessionId: number, _teacherId: number) => api<ApiAttendance[]>(`/attendance?classSessionId=${classSessionId}`),
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
