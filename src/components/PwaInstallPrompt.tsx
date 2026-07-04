"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "me_pwaInstallDismissedAt";
const DISMISS_DAYS = 7;

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || Boolean(navigatorWithStandalone.standalone);
}

function canRegisterServiceWorker() {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV !== "production") return false;
  if (!("serviceWorker" in navigator)) return false;
  return window.location.protocol === "https:" || window.location.hostname === "localhost";
}

function wasRecentlyDismissed() {
  if (typeof window === "undefined") return true;
  const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
  if (!dismissedAt) return false;
  return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (canRegisterServiceWorker()) {
      const register = () => {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
          console.warn("[PWA] Service worker registration failed:", error);
        });
      };
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }

    if (isStandaloneMode() || wasRecentlyDismissed()) return undefined;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onInstalled = () => {
      setVisible(false);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    setVisible(false);
    await installEvent.prompt();
    try {
      await installEvent.userChoice;
    } catch {
      /* Older Android Chrome may not expose userChoice. */
    }
    setInstallEvent(null);
  }

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  if (!visible || !installEvent) return null;

  return (
    <div className="fixed bottom-[88px] left-1/2 z-[80] w-[min(420px,calc(100%-32px))] -translate-x-1/2 rounded-[26px] border border-lilac/60 bg-white/95 p-3 shadow-soft backdrop-blur">
      <div className="flex items-center gap-3">
        <img src="/assets/pwa/icon-72.png" alt="" className="h-11 w-11 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-ink">安裝 Mobile Language</p>
          <p className="truncate text-xs font-bold text-inkSoft">從桌面直接開啟</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-2xl bg-cream px-3 py-2 text-xs font-extrabold text-inkSoft active:scale-95"
        >
          稍後
        </button>
        <button
          type="button"
          onClick={install}
          className="rounded-2xl bg-lilacDeep px-4 py-2 text-sm font-extrabold text-white shadow-softer active:scale-95"
        >
          安裝
        </button>
      </div>
    </div>
  );
}
