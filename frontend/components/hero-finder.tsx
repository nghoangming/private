"use client";

import { useState } from "react";
import { ArrowRight, CalendarDays, ChevronDown, Clock3, MapPin, Search } from "lucide-react";
import { availableRooms, type ApiRoom } from "@/lib/campus-api";

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };

export function HeroFinder() {
  const [type, setType] = useState("all");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("07:00");
  const [searched, setSearched] = useState(false);
  const [matches, setMatches] = useState<ApiRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const search = async () => {
    setLoading(true); setError(""); setSearched(false);
    try {
      const result = await availableRooms(date, time, `${String(Number(time.slice(0,2)) + 1).padStart(2,"0")}:00`);
      setMatches(result.filter(room => type === "all" || room.type === type));
      setSearched(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải phòng trống."); }
    finally { setLoading(false); }
  };
  return <section id="top" className="hero">
    <div className="hero-image" />
    <div className="hero-content container">
      <div className="hero-copy"><div className="eyebrow hero-eyebrow"><span className="eyebrow-line" /> NỀN TẢNG KHÔNG GIAN HỌC TẬP THẾ HỆ MỚI</div>
        <h1>Không gian học tập <em>thông minh.</em><br />Chọn chỗ trong <em>tích tắc.</em></h1>
        <p>Số hóa trải nghiệm học tập tại TDTU. Khám phá giảng đường, phòng thực hành và không gian tự học — tất cả trong một nền tảng.</p>
        <div className="hero-highlights"><span><span className="check-mark">✓</span> Tìm phòng dễ dàng</span><span><span className="check-mark">✓</span> Chọn ghế trực quan</span><span><span className="check-mark">✓</span> Check-in bằng QR</span></div>
        <div className="hero-role-actions"><a href="/login">Đăng nhập Sinh viên / Giảng viên <ArrowRight size={15} /></a><a href="/admin/login">Đăng nhập Quản trị <ArrowRight size={15} /></a></div>
      </div>
      <div id="tra-cuu" className="finder-shell"><div className="finder-top"><div><span className="finder-kicker">BẮT ĐẦU TẠI ĐÂY</span><h2>Tìm không gian phù hợp với bạn</h2></div><span className="finder-top-note"><span className="status-dot" /> Khám phá không gian</span></div>
        <form className="finder-form" onSubmit={e => { e.preventDefault(); void search(); }}>
          <label className="finder-field"><span className="field-label"><MapPin size={15} /> LOẠI PHÒNG</span><span className="field-control"><select value={type} onChange={e => setType(e.target.value)}><option value="all">Tất cả</option><option value="THEORY">Phòng lý thuyết</option><option value="LAB">Phòng thực hành</option><option value="SELF_STUDY">Phòng tự học</option></select><ChevronDown size={16} /></span></label>
          <label className="finder-field"><span className="field-label"><CalendarDays size={15} /> NGÀY SỬ DỤNG</span><input aria-label="Ngày sử dụng" type="date" value={date} min={today()} onChange={e => setDate(e.target.value)} required /></label>
          <label className="finder-field"><span className="field-label"><Clock3 size={15} /> KHUNG GIỜ</span><span className="field-control"><select value={time} onChange={e => setTime(e.target.value)}>{["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"].map(t => <option key={t} value={t}>{t} – {String(Number(t.slice(0,2))+1).padStart(2,"0")}:00</option>)}</select><ChevronDown size={16} /></span></label>
          <button className="finder-submit" type="submit" disabled={loading}><Search size={18} /> {loading ? "Đang tìm..." : "Tìm phòng trống"} <ArrowRight size={18} /></button>
        </form>
        {error && <p className="empty-results" role="alert">{error}</p>}
        {searched && <div className="search-results" aria-live="polite"><div className="results-heading"><strong>{matches.length} phòng trống</strong><span>Dữ liệu từ hệ thống đặt phòng</span></div>{matches.length ? <div className="result-list">{matches.map(room => <div className="result-item" key={room.id}><div><strong>{room.name}</strong><span>{room.code} · {room.location}</span></div><a href="#khong-gian">Xem thêm <ArrowRight size={14} /></a></div>)}</div> : <p className="empty-results">Chưa có phòng trống trong khung giờ này.</p>}</div>}
      </div>
    </div>
  </section>;
}
