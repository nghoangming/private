import { demoAuth } from "@/lib/demo-auth";

export type ApiRoom = { id: number; code: string; name: string; location: string; status: "ACTIVE" | "MAINTENANCE"; type: "THEORY" | "LAB" | "SELF_STUDY"; capacity: number };
export type ApiRoomWrite = Omit<ApiRoom, "id">;
export type ApiProfile = { id: number; code: string; name: string; email: string; faculty: string | null; roles: string[]; createdAt: string; verified: boolean; birthDate: string | null; phone: string | null; personalEmail: string | null; className: string | null; entryYear: number | null };
export type ApiAdminUser = { id: number; code: string; name: string; email: string; faculty: string | null; role: "ADMIN" | "TEACHER" | "STUDENT"; verified: boolean };
export type ApiStudentFormImport = { total: number; imported: number; failed: number; rows: { line: number; name: string; personalEmail: string; intakeId: number | null; code: string | null; schoolEmail: string | null; error: string | null }[] };
export type ApiStudentIntake = { id: number; name: string; phone: string | null; birthDate: string | null; gender: string | null; personalEmail: string; facultyCode: string; faculty: string; entryYear: number; status: "PENDING" | "APPROVED" | "REJECTED"; userId: number | null; createdAt: string };

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
export type ApiClassSession = { id: number; bookingId: number; courseCode: string; title: string; roomId: number; startTime: string; endTime: string; calendarStatus?: "SCHEDULED" | "ABSENCE_PENDING" | "ABSENT" | "MAKEUP"; teacherId: number | null };
export type ApiSeat = { id: number; roomId: number; seatNumber: number; status: "AVAILABLE" | "RESERVED" | "DISABLED" | "OCCUPIED" | "MAINTENANCE" };
export type ApiSeatReservation = { id: number; classSessionId: number; seatId: number; userId: number; roomId: number; status: string };
export type ApiQr = { classSessionId: number; token: string; expiresAt: string };
export type ApiAttendance = { id: number | null; classSessionId: number; userId: number; seatId: number; seatNumber: number; status: "PRESENT" | "NOT_CHECKED_IN"; checkedInAt: string | null; studentName: string | null };
export type ApiAbsenceRequest = { id: number; userId: number; classSessionId: number; type: "TEACHER" | "STUDENT"; reason: string; status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"; reviewedBy: number | null; createdAt: string; reviewedAt: string | null };
export type ApiNotification = { id: number; title: string; message: string; type: string | null; bookingId: number | null; read: boolean; createdAt: string };
export type ApiResource = { id: number; roomId: number; name: string; type: string; quantity: number; status: "AVAILABLE" | "IN_USE" | "BROKEN" | "MAINTENANCE" };
export type ApiIncident = { id: number; roomId: number; roomCode: string; resourceId: number | null; reportedBy: number; reporterName: string; category: "PROJECTOR" | "AC" | "LIGHTING" | "SOUND" | "OTHER"; description: string; status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "REJECTED"; assignedTo: number | null; createdAt: string; resolvedAt: string | null };
export type ApiRoomSchedule = { bookingId: number; startTime: string; endTime: string; status: ApiReservation["status"] };
export const campusApi = {
  myProfile: () => api<ApiProfile>("/users/me"),
  updateProfile: (data: Pick<ApiProfile, "name" | "birthDate" | "phone" | "personalEmail" | "className" | "entryYear">) => api<ApiProfile>("/users/me", { method: "PATCH", body: JSON.stringify(data) }),
  changePassword: async (currentPassword: string, newPassword: string) => {
    const token = demoAuth.token();
    const response = await fetch("/api/v1/users/me/password", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ currentPassword, newPassword }) });
    if (!response.ok) { const body = await response.json().catch(() => null) as { message?: string } | null; throw new Error(body?.message ?? `API ${response.status}`); }
  },
  teacherProfile: (id: number) => api<ApiProfile>(`/users/${id}/public`),
  users: () => api<ApiAdminUser[]>("/users"),
  studentIntakes: () => api<ApiStudentIntake[]>("/intake/students"),
  retryStudentIntake: (id: number) => api<{ intake: ApiStudentIntake; code: string; schoolEmail: string }>(`/intake/students/${id}/retry`, { method: "POST" }),
  setStudentFaculty: (id: number, faculty: string) => api<ApiProfile>(`/users/${id}/faculty`, { method: "PATCH", body: JSON.stringify({ faculty }) }),
  inviteUser: (data: { code: string; name: string; email: string; role: "STUDENT" | "TEACHER"; faculty: string }) => api<{ id: number; email: string; role: string; faculty: string }>("/admin/invitations", { method: "POST", body: JSON.stringify(data) }),
  importStudentFormCsv: async (file: File): Promise<ApiStudentFormImport> => {
    const token = demoAuth.token();
    if (!token) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    const body = new FormData(); body.append("file", file);
    const response = await fetch("/api/v1/intake/students/import", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string; detail?: string } | null;
      throw new Error(payload?.message ?? payload?.detail ?? `Không thể nhập CSV (HTTP ${response.status}).`);
    }
    return response.json() as Promise<ApiStudentFormImport>;
  },
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
  reportAbsence: (id: number, reason?: string) => api<ApiClassSession>(`/class-sessions/${id}/absence${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`, { method: "PATCH" }),
  reviewAbsence: (id: number, decision: "approve" | "reject") => api<ApiClassSession>(`/class-sessions/${id}/absence/${decision}`, { method: "PATCH" }),
  absenceRequests: () => api<ApiAbsenceRequest[]>("/absence-requests"),
  requestStudentAbsence: (sessionId: number, reason: string) => api<ApiAbsenceRequest>(`/absence-requests/class-sessions/${sessionId}`, { method: "POST", body: JSON.stringify({ reason }) }),
  reviewStudentAbsence: (id: number, approve: boolean, note: string) => api<ApiAbsenceRequest>(`/absence-requests/${id}`, { method: "PATCH", body: JSON.stringify({ approve, note: note.trim() || null }) }),
  notifications: () => api<ApiNotification[]>("/notifications"),
  markNotificationRead: (id: number) => api<ApiNotification>(`/notifications/${id}/read`, { method: "PATCH" }),
  resources: () => api<ApiResource[]>("/resources"),
  createResource: (roomId: number, body: { name: string; type: string; quantity: number; status: ApiResource["status"] }) => api<ApiResource>(`/resources/rooms/${roomId}`, { method: "POST", body: JSON.stringify(body) }),
  updateResource: (id: number, body: { name: string; type: string; quantity: number; status: ApiResource["status"] }) => api<ApiResource>(`/resources/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  incidents: () => api<ApiIncident[]>("/incidents"),
  reportIncident: (body: { roomId: number; resourceId: number | null; category: ApiIncident["category"]; description: string }) => api<ApiIncident>("/incidents", { method: "POST", body: JSON.stringify(body) }),
  updateIncident: (id: number, body: { status: ApiIncident["status"]; assignedTo: number | null }) => api<ApiIncident>(`/incidents/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
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
