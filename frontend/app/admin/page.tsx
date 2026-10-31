import type { Metadata } from "next";
import { AdminPortal } from "@/components/admin-portal";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin Portal | TDTU Smart Campus",
  description:
    "Giao diện quản trị minh họa cho phòng học, đặt chỗ, ghế ngồi và sự cố tại TDTU Smart Campus.",
};

export default function AdminPage() {
  return <AdminPortal />;
}
