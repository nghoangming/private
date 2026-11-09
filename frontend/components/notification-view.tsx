"use client";

import { useState } from "react";
import useSWR from "swr";
import { Bell, Check, RefreshCw } from "lucide-react";
import { campusApi } from "@/lib/campus-api";
import type { WorkspaceContext } from "@/lib/workspace-types";
import { viDate, viTime } from "@/lib/workspace-types";

export function NotificationView({ context: c }: { context: WorkspaceContext }) {
  const { data = [], error, isLoading, mutate } = useSWR(`notifications-${c.account.id}`, campusApi.notifications, { refreshInterval: 30000, revalidateOnFocus: true });
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const currentPage = Math.min(page, Math.max(1, Math.ceil(data.length / 8)));
  const markRead = async (id: number) => {
    setBusyId(id); setActionError("");
    try {
      await campusApi.markNotificationRead(id);
      await mutate();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Không thể đánh dấu đã đọc.");
    } finally { setBusyId(null); }
  };
  return <div className="ws-panel ws-notification-panel">
    <div className="ws-panel-header"><div><h3>Thông báo của tôi</h3><p>{data.filter(item => !item.read).length} chưa đọc · {data.length} thông báo</p></div><button className="ws-button secondary" type="button" onClick={() => void mutate()}><RefreshCw size={16} /> Tải lại</button></div>
    {(error || actionError) && <p className="ws-form-error" role="alert">{actionError || "Không tải được thông báo. Hãy thử tải lại."}</p>}
    {isLoading && <p className="ws-notification-empty">Đang tải thông báo...</p>}
    {!isLoading && !error && !data.length && <p className="ws-notification-empty">Bạn chưa có thông báo.</p>}
    <div className="ws-notification-list">{data.slice((currentPage - 1) * 8, currentPage * 8).map(item => <article key={item.id} className={`ws-notification-item ${item.read ? "read" : "unread"}`}><span className="ws-notification-icon"><Bell size={18} /></span><div><div className="ws-notification-title"><strong>{item.title}</strong>{!item.read && <span>Mới</span>}</div><p>{item.message}</p><small>{viDate(item.createdAt)} · {viTime(item.createdAt)}</small></div>{!item.read && <button className="ws-button secondary" type="button" disabled={busyId !== null} onClick={() => void markRead(item.id)}><Check size={15} /> Đã đọc</button>}</article>)}</div>
    {data.length > 8 && <div className="ws-student-history-pages"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Trước</button><span>{currentPage} / {Math.ceil(data.length / 8)}</span><button type="button" disabled={currentPage === Math.ceil(data.length / 8)} onClick={() => setPage(currentPage + 1)}>Sau</button></div>}
  </div>;
}
