import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  title: string;
  from: string;
  to: string;
  selectedDate: string;
  onMove: (weeks: number) => void;
  onSelect: (date: string) => void;
  onToday: () => void;
};

const displayDate = (date: string) => {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
};

export function WeekNavigator({ title, from, to, selectedDate, onMove, onSelect, onToday }: Props) {
  return <div className="ws-week-heading ws-week-navigator">
    <div className="ws-week-title"><strong>{title}</strong><span>{displayDate(from)} – {displayDate(to)} · Chọn ngày để xem buổi học</span></div>
    <div className="ws-week-controls">
      <button type="button" onClick={() => onMove(-1)} aria-label="Tuần trước" title="Tuần trước"><ChevronLeft size={18} /></button>
      <button type="button" className="ws-week-today" onClick={onToday}>Hôm nay</button>
      <button type="button" onClick={() => onMove(1)} aria-label="Tuần sau" title="Tuần sau"><ChevronRight size={18} /></button>
      <label className="ws-week-jump">Đến ngày <input type="date" value={selectedDate} onChange={event => { if (event.target.value) onSelect(event.target.value); }} aria-label="Chọn ngày để xem lịch" /></label>
    </div>
  </div>;
}
