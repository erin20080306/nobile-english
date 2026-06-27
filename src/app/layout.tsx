import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mobile English｜時尚 Q 版英文學習",
  description: "手機優先的英文學習 App：場景對話、同尾字、英英字典、TOEIC/IELTS/TOEFL 測驗。",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Mobile English" },
  icons: {
    apple: "/assets/icon.png",
    icon: "/assets/icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#B8A6F0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
