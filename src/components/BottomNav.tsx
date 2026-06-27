"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, LayoutGrid, MessagesSquare, BookText, User } from "lucide-react";

const items = [
  { href: "/dashboard", label: "首頁", icon: Home },
  { href: "/scenes", label: "場景", icon: LayoutGrid },
  { href: "/dialogue", label: "對話", icon: MessagesSquare },
  { href: "/records", label: "紀錄", icon: BookText },
  { href: "/settings", label: "設定", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <nav className="sticky bottom-0 z-30 mt-4">
      <div className="mx-3 mb-3 rounded-3xl bg-white/95 backdrop-blur shadow-soft flex justify-around py-2">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          const Icon = it.icon;
          return (
            <button
              key={it.href}
              onClick={() => router.push(it.href)}
              className="flex flex-col items-center gap-0.5 px-3 py-1 active:scale-90 transition"
            >
              <span
                className={`h-9 w-9 rounded-2xl flex items-center justify-center transition ${
                  active ? "bg-lilacDeep text-white shadow-softer" : "text-inkSoft"
                }`}
              >
                <Icon size={20} />
              </span>
              <span className={`text-[10px] font-bold ${active ? "text-lilacDeep" : "text-inkSoft"}`}>
                {it.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
