import type { Metadata } from "next";
import { RoleWorkspace } from "@/components/role-workspace";
export const metadata: Metadata = { title: "Không gian Sinh viên | TDTU Smart Campus" };
export default function StudentPage() { return <RoleWorkspace role="STUDENT" />; }
