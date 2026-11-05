import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./workspace.css";

export const metadata: Metadata = {
  title: "TDTU Smart Campus | Không gian học tập thông minh",
  description: "Khám phá không gian học tập, lịch học, chọn ghế và quản lý phòng học dành cho Sinh viên, Giảng viên và Quản trị viên tại TDTU Smart Campus.",
};
export const viewport: Viewport = { themeColor: "#122c40", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
