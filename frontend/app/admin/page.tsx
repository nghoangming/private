import type { Metadata } from "next";
import { RoleWorkspace } from "@/components/role-workspace";

export const metadata: Metadata = {
  title: "Không gian Quản trị | TDTU Smart Campus",
  description: "Không gian quản trị minh họa cho phòng học, đặt chỗ, người dùng và sự cố tại TDTU Smart Campus.",
};

export default function AdminPage() {
  return <RoleWorkspace role="ADMIN" />;
}
