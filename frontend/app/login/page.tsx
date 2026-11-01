import type { Metadata } from "next";
import { RoleLogin } from "@/components/role-login";
export const metadata: Metadata = { title: "Đăng nhập Sinh viên & Giảng viên | TDTU Smart Campus" };
export default function LoginPage() { return <RoleLogin />; }
