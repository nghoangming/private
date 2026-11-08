import { CalendarCheck2, CalendarPlus2, CalendarX2 } from "lucide-react";

export type CalendarStatus = "SCHEDULED" | "ABSENT" | "MAKEUP";

export function SessionStatus({ status = "SCHEDULED", teacher = false }: { status?: CalendarStatus; teacher?: boolean }) {
  const Icon = status === "ABSENT" ? CalendarX2 : status === "MAKEUP" ? CalendarPlus2 : CalendarCheck2;
  const label = status === "ABSENT" ? "Đã báo vắng" : status === "MAKEUP" ? teacher ? "Dạy bù" : "Học bù" : "Có tiết";
  return <span className={`ws-session-status ${status.toLowerCase()}`}><Icon size={15} aria-hidden="true" />{label}</span>;
}

export function SessionStatusLegend({ teacher = false }: { teacher?: boolean }) {
  return <div className="ws-calendar-legend" aria-label="Phân loại buổi học"><span className="ws-calendar-legend-label">Trạng thái</span><SessionStatus teacher={teacher} /><SessionStatus status="ABSENT" teacher={teacher} /><SessionStatus status="MAKEUP" teacher={teacher} /></div>;
}
