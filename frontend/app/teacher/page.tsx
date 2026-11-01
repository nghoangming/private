import type { Metadata } from "next";
import { RoleWorkspace } from "@/components/role-workspace";
export const metadata: Metadata = { title: "Không gian Giảng viên | TDTU Smart Campus" };
export default function TeacherPage() { return <RoleWorkspace role="TEACHER" />; }
