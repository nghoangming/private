import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TDTU Smart Campus | Không gian học tập thông minh",
  description: "Khám phá không gian học tập, phòng lab và tiện ích tại Đại học Tôn Đức Thắng. Trải nghiệm giao diện tìm phòng và chọn ghế trực quan.",
};
export const viewport: Viewport = { themeColor: "#102a43", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
