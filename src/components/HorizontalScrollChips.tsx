"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function HorizontalScrollChips({
  children,
  className = "",
  innerClassName = "",
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = React.useState(false);
  const [showRight, setShowRight] = React.useState(false);

  const updateArrows = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 8);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateArrows();
    const onResize = () => updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", onResize);
    const timer = window.setTimeout(updateArrows, 80);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
    };
  }, [children, updateArrows]);

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction === "left" ? -Math.round(el.clientWidth * 0.72) : Math.round(el.clientWidth * 0.72),
      behavior: "smooth",
    });
  }

  return (
    <div className={`relative ${className}`}>
      {showLeft && (
        <button
          type="button"
          onClick={() => scroll("left")}
          aria-label="向左滑動"
          className="absolute left-0 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-lilacDeep shadow-softer active:scale-95"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      <div
        ref={scrollRef}
        className={`flex gap-2 overflow-x-auto no-scrollbar scroll-smooth pb-1 ${showLeft ? "pl-10" : "pl-1"} ${showRight ? "pr-10" : "pr-1"} ${innerClassName}`}
      >
        {children}
      </div>
      {showRight && (
        <button
          type="button"
          onClick={() => scroll("right")}
          aria-label="向右滑動"
          className="absolute right-0 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-lilacDeep shadow-softer active:scale-95"
        >
          <ChevronRight size={18} />
        </button>
      )}
      {showLeft && <span className="pointer-events-none absolute left-0 top-0 h-full w-12 bg-gradient-to-r from-cream via-cream/70 to-transparent" />}
      {showRight && <span className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-cream via-cream/70 to-transparent" />}
    </div>
  );
}
