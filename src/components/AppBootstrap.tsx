"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { authService } from "@/services/authService";
import { cloudSyncService } from "@/services/cloudSyncService";
import { learningService } from "@/services/learningService";
import { storageService, KEYS } from "@/services/storageService";
import { supabaseBrowserClient } from "@/services/supabaseBrowserClient";

// Mounted once in the root layout. Keeps the cloud sync auto-push hook wired
// to whatever Supabase Auth session is currently active, and defensively
// re-hydrates local data if this device doesn't yet know about that account
// (e.g. a Supabase session survived but localStorage was otherwise reset).
export default function AppBootstrap() {
  const pathname = usePathname();

  useEffect(() => {
    cloudSyncService.init();
    if (!supabaseBrowserClient) return;

    let cancelled = false;

    supabaseBrowserClient.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const sessionUser = data.session?.user;
      if (!sessionUser) return;
      if (storageService.get<string | null>(KEYS.session, null) === sessionUser.id) {
        cloudSyncService.setActiveUser(sessionUser.id);
        const currentUser = authService.getCurrentUser();
        if (currentUser) void cloudSyncService.pushProfile(sessionUser.id, currentUser);
        // Retry-flush any practice records still stuck in the local sync
        // queue from a previous session (e.g. the last push failed because
        // the network dropped right as a scene/exam/dialogue finished).
        void learningService.syncRecords(sessionUser.id);
        // Also mirror all restorable app state so an already-signed-in Google
        // account is not counted as active without having cloud app data.
        void cloudSyncService.pushAll(sessionUser.id);
        return;
      }
      void authService.hydrateFromSupabaseSession(sessionUser);
    });

    const { data: subscription } = supabaseBrowserClient.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") cloudSyncService.setActiveUser(null);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!pathname || typeof window === "undefined") return;

    function trackPageActivity() {
      const currentUser = authService.getCurrentUser();
      if (!currentUser || currentUser.provider !== "google") return;
      const key = `app-activity:${currentUser.id}:${pathname}`;
      const lastTrackedAt = Number(window.sessionStorage.getItem(key) || 0);
      if (Date.now() - lastTrackedAt < 10000) return;
      window.sessionStorage.setItem(key, String(Date.now()));
      fetch("/api/account/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          userId: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          provider: currentUser.provider,
          path: pathname,
          title: document.title,
        }),
      }).catch((error) => {
        console.warn("App activity tracking failed:", error);
      });
    }

    const timers = [window.setTimeout(trackPageActivity, 700), window.setTimeout(trackPageActivity, 2500)];
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pathname]);

  return null;
}
