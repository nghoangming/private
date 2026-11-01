import type { Metadata } from "next";
import { RoleLogin } from "@/components/role-login";
export const metadata: Metadata = { title: "Đăng nhập Quản trị | TDTU Smart Campus" };
export default function AdminLoginPage() { return <RoleLogin admin />; }
