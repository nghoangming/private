"use client";

import { useState } from "react";
import { ArrowRight, CalendarDays, ChevronDown, Clock3, MapPin, Search, UsersRound } from "lucide-react";

const rooms = [
  { name: "Khu tự học sáng tạo 24/7", type: "self", seats: 60, location: "Thư viện", time: "07:00 – 22:00" },
  { name: "Phòng tự học B.204", type: "self", seats: 24, location: "Tòa nhà B", time: "07:00 – 17:00" },
  { name: "Giảng đường A.501", type: "lecture", seats: 100, location: "Tòa nhà A", time: "07:00 – 17:00" },
  { name: "Phòng Lab Nghiên cứu AI & IoT", type: "lab", seats: 40, location: "Tòa nhà B", time: "08:00 – 17:00" },
];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };

export function HeroFinder() {
  const [type, setType] = useState("all");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("07:00");
  const [capacity, setCapacity] = useState("1");
  const [searched, setSearched] = useState(false);
  const matches = rooms.filter(room => (type === "all" || room.type === type) && room.seats >= Number(capacity) && Number(time.slice(0,2)) < Number(room.time.slice(8,10)));
  return <section id="top" className="hero">
    <div className="hero-image" />
    <div className="hero-content container">
      <div className="hero-copy"><div className="eyebrow hero-eyebrow"><span className="eyebrow-line" /> NỀN TẢNG KHÔNG GIAN HỌC TẬP THẾ HỆ MỚI</div>
        <h1>Không gian học tập <em>thông minh.</em><br />Đặt chỗ trong <em>tích tắc.</em></h1>
        <p>Số hóa trải nghiệm học tập tại TDTU. Khám phá giảng đường, phòng Lab và không gian tự học — tất cả trong một nền tảng.</p>
        <div className="hero-highlights"><span><span className="check-mark">✓</span> Tìm phòng dễ dàng</span><span><span className="check-mark">✓</span> Chọn ghế trực quan</span><span><span className="check-mark">✓</span> Check-in bằng QR</span></div>
      </div>
      <div id="tra-cuu" className="finder-shell"><div className="finder-top"><div><span className="finder-kicker">BẮT ĐẦU TẠI ĐÂY</span><h2>Tìm không gian phù hợp với bạn</h2></div><span className="finder-top-note"><span className="status-dot" /> Khám phá không gian</span></div>
        <form className="finder-form" onSubmit={e => { e.preventDefault(); setSearched(true); }}>
          <label className="finder-field"><span className="field-label"><MapPin size={15} /> LOẠI KHÔNG GIAN</span><span className="field-control"><select value={type} onChange={e => setType(e.target.value)}><option value="all">Tất cả không gian</option><option value="self">Phòng tự học cá nhân</option><option value="lecture">Giảng đường lý thuyết</option><option value="lab">Phòng máy Lab AI</option></select><ChevronDown size={16} /></span></label>
          <label className="finder-field"><span className="field-label"><CalendarDays size={15} /> NGÀY SỬ DỤNG</span><input aria-label="Ngày sử dụng" type="date" value={date} min={today()} onChange={e => setDate(e.target.value)} required /></label>
          <label className="finder-field"><span className="field-label"><Clock3 size={15} /> KHUNG GIỜ</span><span className="field-control"><select value={time} onChange={e => setTime(e.target.value)}>{["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"].map(t => <option key={t} value={t}>{t} – {String(Number(t.slice(0,2))+1).padStart(2,"0")}:00</option>)}</select><ChevronDown size={16} /></span></label>
          <label className="finder-field"><span className="field-label"><UsersRound size={15} /> SỨC CHỨA</span><span className="field-control"><select value={capacity} onChange={e => setCapacity(e.target.value)}>{[1,2,4,8,10,20,40,60,100].map(n => <option key={n} value={n}>{n} chỗ ngồi</option>)}</select><ChevronDown size={16} /></span></label>
          <button className="finder-submit" type="submit"><Search size={18} /> Tìm phòng trống <ArrowRight size={18} /></button>
        </form>
        {searched && <div className="search-results" aria-live="polite"><div className="results-heading"><strong>{matches.length} không gian phù hợp</strong><span>Danh sách minh họa · Chưa kết nối dữ liệu đặt phòng trực tiếp</span></div>{matches.length ? <div className="result-list">{matches.map(room => <div className="result-item" key={room.name}><div><strong>{room.name}</strong><span>{room.location} · {room.seats} chỗ · {room.time}</span></div><a href="#khong-gian">Xem thêm <ArrowRight size={14} /></a></div>)}</div> : <p className="empty-results">Chưa có không gian phù hợp với bộ lọc này. Hãy thử sức chứa hoặc khung giờ khác.</p>}</div>}
      </div>
    </div>
  </section>;
}
