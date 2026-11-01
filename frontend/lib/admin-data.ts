export interface Room {
  id: number;
  code: string;
  name: string;
  location: string;
  status: "ACTIVE" | "MAINTENANCE";
  capacity?: number;
  type?: "THEORY" | "LAB" | "STUDY";
}

export interface Reservation {
  id: number;
  userId: number;
  roomId: number;
  roomCode?: string;
  startTime: string;
  endTime: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "REJECTED";
  createdAt: string;
}

export interface Seat {
  id: number;
  roomId: number;
  seatNumber: number;
  status: "AVAILABLE" | "RESERVED" | "OCCUPIED" | "MAINTENANCE";
}

export interface Incident {
  id: number;
  roomId: number;
  roomCode: string;
  category: "PROJECTOR" | "AC" | "LIGHTING" | "SOUND" | "OTHER";
  description: string;
  reporterName: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  createdAt: string;
}

const rooms: Room[] = [
  { id: 1, code: "A101", name: "Phòng học A101", location: "Tòa A · Tầng 1", status: "ACTIVE", capacity: 40 },
  { id: 2, code: "A205", name: "Phòng học A205", location: "Tòa A · Tầng 2", status: "ACTIVE", capacity: 60 },
  { id: 3, code: "B204", name: "Phòng máy B204", location: "Tòa B · Tầng 2", status: "ACTIVE", capacity: 40 },
  { id: 4, code: "B310", name: "Phòng chuyên đề B310", location: "Tòa B · Tầng 3", status: "MAINTENANCE", capacity: 30 },
  { id: 5, code: "C301", name: "Không gian học tập C301", location: "Tòa C · Tầng 3", status: "ACTIVE", capacity: 24 },
  { id: 6, code: "C402", name: "Giảng đường C402", location: "Tòa C · Tầng 4", status: "ACTIVE", capacity: 100 },
];
const reservations: Reservation[] = [
  { id: 1042, userId: 201, roomId: 3, roomCode: "B204", startTime: "2026-10-31T08:00:00+07:00", endTime: "2026-10-31T10:00:00+07:00", status: "PENDING", createdAt: "2026-10-30T14:30:00+07:00" },
  { id: 1041, userId: 184, roomId: 1, roomCode: "A101", startTime: "2026-10-31T09:00:00+07:00", endTime: "2026-10-31T11:00:00+07:00", status: "CONFIRMED", createdAt: "2026-10-30T11:12:00+07:00" },
  { id: 1040, userId: 328, roomId: 5, roomCode: "C301", startTime: "2026-10-31T13:00:00+07:00", endTime: "2026-10-31T15:00:00+07:00", status: "PENDING", createdAt: "2026-10-29T16:40:00+07:00" },
  { id: 1039, userId: 156, roomId: 2, roomCode: "A205", startTime: "2026-10-31T14:00:00+07:00", endTime: "2026-10-31T16:00:00+07:00", status: "CONFIRMED", createdAt: "2026-10-29T09:10:00+07:00" },
  { id: 1038, userId: 411, roomId: 6, roomCode: "C402", startTime: "2026-11-01T08:00:00+07:00", endTime: "2026-11-01T10:00:00+07:00", status: "CANCELLED", createdAt: "2026-10-28T10:25:00+07:00" },
  { id: 1037, userId: 223, roomId: 4, roomCode: "B310", startTime: "2026-10-30T10:00:00+07:00", endTime: "2026-10-30T12:00:00+07:00", status: "REJECTED", createdAt: "2026-10-27T17:08:00+07:00" },
];
const seats: Seat[] = [1, 2, 3, 4, 5, 6].flatMap(roomId => Array.from({ length: 30 }, (_, index) => ({ id: roomId * 100 + index + 1, roomId, seatNumber: index + 1, status: (roomId === 3 && [3, 12, 21].includes(index) ? "OCCUPIED" : roomId === 3 && [7, 17, 26].includes(index) ? "RESERVED" : roomId === 3 && index === 15 ? "MAINTENANCE" : "AVAILABLE") as Seat["status"] })));
const incidents: Incident[] = [
  { id: 401, roomId: 3, roomCode: "B204", category: "PROJECTOR", description: "Màn hình máy chiếu chập chờn trong giờ học.", reporterName: "Nguyễn Minh Anh", priority: "HIGH", status: "OPEN", createdAt: "2026-10-31T08:24:00+07:00" },
  { id: 402, roomId: 1, roomCode: "A101", category: "AC", description: "Điều hòa không đủ mát trong phòng.", reporterName: "Trần Hoàng Nam", priority: "MEDIUM", status: "IN_PROGRESS", createdAt: "2026-10-30T15:46:00+07:00" },
  { id: 403, roomId: 5, roomCode: "C301", category: "LIGHTING", description: "Đèn trần gần cửa ra vào không sáng.", reporterName: "Lê Thu Hà", priority: "LOW", status: "RESOLVED", createdAt: "2026-10-29T10:15:00+07:00" },
  { id: 404, roomId: 2, roomCode: "A205", category: "SOUND", description: "Âm thanh micro thỉnh thoảng bị ngắt.", reporterName: "Phạm Bảo Châu", priority: "MEDIUM", status: "OPEN", createdAt: "2026-10-30T09:32:00+07:00" },
];

const clone = <T,>(value: T): T => structuredClone(value);

// These in-memory mock endpoints deliberately mirror the supplied response shapes.
// They reset on reload and do not imply a connection to the Spring Boot API.
export const mockAdminApi = {
  listRooms: async (): Promise<Room[]> => clone(rooms),
  listReservations: async (): Promise<Reservation[]> => clone(reservations),
  listSeats: async (): Promise<Seat[]> => clone(seats),
  listIncidents: async (): Promise<Incident[]> => clone(incidents),
};
