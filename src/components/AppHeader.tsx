"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function AppHeader({
  title,
  subtitle,
  back = true,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 bg-cream/90 backdrop-blur-md px-4 py-3 flex items-center gap-3">
      {back && (
        <button
          onClick={() => (onBack ? onBack() : router.back())}
          aria-label="返回"
          className="h-10 w-10 rounded-2xl bg-white shadow-softer flex items-center justify-center active:scale-90 transition"
        >
          <ChevronLeft className="text-ink" size={22} />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-extrabold text-ink truncate">{title}</h1>
        {subtitle && <p className="text-xs text-inkSoft truncate">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
