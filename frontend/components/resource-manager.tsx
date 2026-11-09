"use client";

import { useState, type FormEvent } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { campusApi, type ApiResource } from "@/lib/campus-api";
import type { Equipment } from "@/lib/demo-campus";
import type { WorkspaceContext } from "@/lib/workspace-types";

const statusName: Record<ApiResource["status"], Equipment["status"]> = {
  AVAILABLE: "Tốt", IN_USE: "Đang sử dụng", BROKEN: "Cần kiểm tra", MAINTENANCE: "Bảo trì",
};
const statusCode = (status: Equipment["status"]): ApiResource["status"] =>
  status === "Tốt" ? "AVAILABLE" : status === "Đang sử dụng" ? "IN_USE" : status === "Bảo trì" ? "MAINTENANCE" : "BROKEN";
const toView = (item: ApiResource): Equipment => ({ id: item.id, roomId: item.roomId, name: item.name, type: item.type, quantity: item.quantity, status: statusName[item.status] ?? "Cần kiểm tra" });

export function ResourceManager({ context: c, roomId }: { context: WorkspaceContext; roomId: number }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [statuses, setStatuses] = useState<Record<number, ApiResource["status"]>>({});
  const items = c.data.equipment.filter(item => item.roomId === roomId);
  const refresh = async () => {
    setBusy(true); setError("");
    try { c.update("equipment", (await campusApi.resources()).map(toView)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được thiết bị."); }
    finally { setBusy(false); }
  };
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const saved = await campusApi.createResource(roomId, { name: name.trim(), type: "EQUIPMENT", quantity, status: "AVAILABLE" });
      c.update("equipment", [...c.data.equipment, toView(saved)]);
      setName(""); setQuantity(1);
      c.notice("Đã thêm thiết bị vào cơ sở dữ liệu.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể thêm thiết bị."); }
    finally { setBusy(false); }
  };
  const save = async (item: Equipment) => {
    setBusy(true); setError("");
    try {
      const saved = await campusApi.updateResource(item.id, { name: item.name, type: item.type ?? "EQUIPMENT", quantity: item.quantity ?? 1, status: statuses[item.id] ?? statusCode(item.status) });
      c.update("equipment", c.data.equipment.map(current => current.id === item.id ? toView(saved) : current));
      c.notice("Đã lưu trạng thái thiết bị.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật thiết bị."); }
    finally { setBusy(false); }
  };
  return <details className="ws-resource-section"><summary><span><strong>Thiết bị & tài nguyên</strong><small>{items.length} thiết bị trong phòng</small></span><span className="ws-resource-toggle">Mở quản lý</span></summary><div className="ws-resource-content"><div className="ws-resource-heading"><strong>Thiết bị phòng học</strong><button className="ws-button secondary" type="button" disabled={busy} onClick={() => void refresh()}><RefreshCw size={15} /> Tải lại</button></div>{items.map(item => <div className="ws-resource-row" key={item.id}><div><strong>{item.name}</strong><small>{item.quantity ?? 1} thiết bị · {item.status}</small></div><select className="ws-select" aria-label={`Trạng thái ${item.name}`} value={statuses[item.id] ?? statusCode(item.status)} onChange={event => setStatuses(previous => ({ ...previous, [item.id]: event.target.value as ApiResource["status"] }))}>{Object.entries(statusName).map(([code, title]) => <option key={code} value={code}>{title}</option>)}</select><button className="ws-button secondary" type="button" disabled={busy} onClick={() => void save(item)}>Lưu</button></div>)}{!items.length && <p>Chưa có thiết bị cho phòng này.</p>}<form className="ws-resource-create" onSubmit={create}><label className="ws-field">Tên thiết bị<input required minLength={2} maxLength={20} value={name} onChange={event => setName(event.target.value)} placeholder="Ví dụ: Máy chiếu" /></label><label className="ws-field">Số lượng<input required type="number" min={0} max={10000} value={quantity} onChange={event => setQuantity(Number(event.target.value))} /></label><button className="ws-button" type="submit" disabled={busy}><Plus size={15} /> Thêm thiết bị</button></form>{error && <p className="ws-form-error" role="alert">{error}</p>}</div></details>;
}
