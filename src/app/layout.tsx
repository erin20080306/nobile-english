import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppBootstrap from "@/components/AppBootstrap";

export const metadata: Metadata = {
  title: "Mobile Language｜時尚 Q 版語言學習",
  description: "手機優先的語言學習 App：場景對話、同尾字、字典、TOEIC/IELTS/TOEFL 測驗。",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Mobile Language" },
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
        <AppBootstrap />
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
