import type { Metadata, Viewport } from "next";
import CloudStateSync from "@/components/CloudStateSync";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Mobile Language",
  title: "Mobile Language｜時尚 Q 版語言學習",
  description: "手機優先的語言學習 App：場景對話、同尾字、字典、TOEIC/IELTS/TOEFL 測驗。",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Mobile Language" },
  icons: {
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    icon: [
      { url: "/favicon.ico" },
      { url: "/assets/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/assets/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#B8A6F0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <div className="app-shell">{children}</div>
        <CloudStateSync />
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
