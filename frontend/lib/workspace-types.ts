import type { Incident, Reservation, Room, Seat } from "@/lib/admin-data";
import type { CampusUser, Equipment, Session } from "@/lib/demo-campus";
import type { DemoAccount, Role } from "@/lib/demo-auth";

export type WorkspaceData = {
  rooms: Room[];
  reservations: Reservation[];
  seats: Seat[];
  incidents: Incident[];
  sessions: Session[];
  users: CampusUser[];
  equipment: Equipment[];
};
export type WorkspaceContext = {
  role: Role;
  account: DemoAccount;
  data: WorkspaceData;
  unreadNotifications: number;
  update: <K extends keyof WorkspaceData>(key: K, next: WorkspaceData[K]) => void;
  notice: (text: string) => void;
  confirm: (title: string, detail: string, action: () => void) => void;
  navigate: (tab: string) => void;
};
export const viDate = (value: string) => new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
export const viTime = (value: string) => new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
export const roleName: Record<Role, string> = { ADMIN: "Quản trị", TEACHER: "Giảng viên", STUDENT: "Sinh viên" };
export const bookingName: Record<Reservation["status"], string> = { PENDING: "Chờ duyệt", CONFIRMED: "Đã duyệt", REJECTED: "Từ chối", CANCELLED: "Đã hủy" };
export const incidentName: Record<Incident["status"], string> = { OPEN: "Mới", IN_PROGRESS: "Đang xử lý", RESOLVED: "Đã xử lý", REJECTED: "Từ chối" };
