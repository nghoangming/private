"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, RefreshCw, Wrench } from "lucide-react";
import { campusApi, type ApiIncident } from "@/lib/campus-api";
import type { Incident } from "@/lib/admin-data";
import type { WorkspaceContext } from "@/lib/workspace-types";
import { incidentName, viDate, viTime } from "@/lib/workspace-types";

const categoryName: Record<Incident["category"], string> = { PROJECTOR: "Máy chiếu", AC: "Điều hòa", LIGHTING: "Chiếu sáng", SOUND: "Âm thanh", OTHER: "Khác" };
const toView = (item: ApiIncident): Incident => ({ id: item.id, roomId: item.roomId, roomCode: item.roomCode, resourceId: item.resourceId, reportedBy: item.reportedBy, reporterName: item.reporterName, category: item.category, description: item.description, status: item.status, assignedTo: item.assignedTo, createdAt: item.createdAt });

export function IncidentView({ context: c }: { context: WorkspaceContext }) {
  const admin = c.role === "ADMIN";
  const [roomId, setRoomId] = useState(c.data.rooms[0]?.id ?? 0);
  const [resourceId, setResourceId] = useState(0);
  const [category, setCategory] = useState<Incident["category"]>("OTHER");
  const [description, setDescription] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<Record<number, Incident["status"]>>({});
  const [assignee, setAssignee] = useState<Record<number, number>>({});
  const list = c.data.incidents.filter(item => filter === "ALL" || item.status === filter);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(list.length / 5)));
  const resources = c.data.equipment.filter(item => item.roomId === roomId);
  const refresh = async () => {
    setBusy(true); setError("");
    try { c.update("incidents", (await campusApi.incidents()).map(toView)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được sự cố."); }
    finally { setBusy(false); }
  };
  const report = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!roomId || description.trim().length < 10) { setError("Chọn phòng và nhập mô tả ít nhất 10 ký tự."); return; }
    c.confirm("Gửi báo cáo sự cố?", "Báo cáo sẽ được lưu vào hệ thống để quản trị viên xử lý.", async () => {
      setBusy(true); setError("");
      try {
        const saved = await campusApi.reportIncident({ roomId, resourceId: resourceId || null, category, description: description.trim() });
        c.update("incidents", [toView(saved), ...c.data.incidents]);
        setDescription(""); setResourceId(0);
        c.notice("Đã gửi báo cáo sự cố.");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể gửi báo cáo."); }
      finally { setBusy(false); }
    });
  };
  const save = (item: Incident) => {
    const nextStatus = status[item.id] ?? item.status;
    const nextAssignee = assignee[item.id] ?? item.assignedTo ?? 0;
    c.confirm("Cập nhật sự cố?", `Sự cố #${item.id} sẽ chuyển sang trạng thái ${incidentName[nextStatus]}.`, async () => {
      setBusy(true); setError("");
      try {
        const saved = await campusApi.updateIncident(item.id, { status: nextStatus, assignedTo: nextAssignee || null });
        c.update("incidents", c.data.incidents.map(current => current.id === item.id ? toView(saved) : current));
        c.notice("Đã cập nhật sự cố trên hệ thống.");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật sự cố."); }
      finally { setBusy(false); }
    });
  };
  return <div className="ws-incident-page">
    {!admin && <section className="ws-panel"><div className="ws-panel-header"><div><h3>Báo cáo sự cố mới</h3><p>Thông tin được gửi trực tiếp đến quản trị viên</p></div></div><form className="ws-form" onSubmit={report}><label className="ws-field">Phòng<select value={roomId} onChange={event => { setRoomId(Number(event.target.value)); setResourceId(0); }}>{c.data.rooms.map(room => <option key={room.id} value={room.id}>{room.code} · {room.name}</option>)}</select></label><label className="ws-field">Loại sự cố<select value={category} onChange={event => setCategory(event.target.value as Incident["category"])}>{Object.entries(categoryName).map(([code, title]) => <option key={code} value={code}>{title}</option>)}</select></label><label className="ws-field">Thiết bị (nếu có)<select value={resourceId} onChange={event => setResourceId(Number(event.target.value))}><option value={0}>Sự cố chung của phòng</option>{resources.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="ws-field span-two">Mô tả<textarea required minLength={10} maxLength={500} rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder="Mô tả hiện tượng và vị trí xảy ra sự cố..." /></label><div className="ws-form-actions"><button className="ws-button" type="submit" disabled={busy || !roomId}>Gửi báo cáo <ArrowRight size={16} /></button></div></form></section>}
    <section className="ws-panel"><div className="ws-panel-header"><div><h3>{admin ? "Sự cố trong campus" : "Báo cáo của tôi"}</h3><p>{list.length} báo cáo</p></div><div className="ws-incident-tools"><select className="ws-select" aria-label="Lọc trạng thái sự cố" value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }}><option value="ALL">Tất cả</option>{Object.entries(incidentName).map(([code, title]) => <option key={code} value={code}>{title}</option>)}</select><button type="button" className="ws-button secondary" disabled={busy} onClick={() => void refresh()}><RefreshCw size={15} /> Tải lại</button></div></div>
      {error && <p className="ws-form-error" role="alert">{error}</p>}
      <div className="ws-incident-list">{list.slice((currentPage - 1) * 5, currentPage * 5).map(item => <article key={item.id} className="ws-incident-card"><div className="ws-incident-card-main"><span className="ws-section-kicker">SỰ CỐ #{item.id} · {item.roomCode}</span><h4>{categoryName[item.category]}</h4><p>{item.description}</p><small>{admin ? `${item.reporterName} · ` : ""}{viDate(item.createdAt)} {viTime(item.createdAt)}</small></div><div className="ws-incident-card-side"><span className={`ws-tag ${item.status.toLowerCase()}`}>{incidentName[item.status]}</span>{admin && <><label className="ws-field">Trạng thái<select value={status[item.id] ?? item.status} onChange={event => setStatus(previous => ({ ...previous, [item.id]: event.target.value as Incident["status"] }))}>{Object.entries(incidentName).map(([code, title]) => <option key={code} value={code}>{title}</option>)}</select></label><label className="ws-field">Người phụ trách<select value={assignee[item.id] ?? item.assignedTo ?? 0} onChange={event => setAssignee(previous => ({ ...previous, [item.id]: Number(event.target.value) }))}><option value={0}>Chưa phân công</option>{c.data.users.filter(user => user.role !== "STUDENT").map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><button className="ws-button" type="button" disabled={busy} onClick={() => save(item)}>Lưu xử lý</button></>}</div></article>)}{!list.length && <p className="ws-notification-empty">Chưa có sự cố phù hợp.</p>}</div>
      {list.length > 5 && <div className="ws-student-history-pages"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Trước</button><span>{currentPage} / {Math.ceil(list.length / 5)}</span><button type="button" disabled={currentPage === Math.ceil(list.length / 5)} onClick={() => setPage(currentPage + 1)}>Sau</button></div>}
    </section>
  </div>;
}
