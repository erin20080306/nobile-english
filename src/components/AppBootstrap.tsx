"use client";

import { useEffect } from "react";
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
        // Retry-flush any practice records still stuck in the local sync
        // queue from a previous session (e.g. the last push failed because
        // the network dropped right as a scene/exam/dialogue finished).
        void learningService.syncRecords(sessionUser.id);
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

  return null;
}
