"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/types";
import { authService } from "@/services/authService";
import { cloudAppStateService } from "@/services/cloudAppStateService";

// Client-side auth guard. Redirects to /login when no session.
export function useUser(options?: { requireOnboarded?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const u = authService.getCurrentUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    if (options?.requireOnboarded && !u.onboarded) {
      router.replace("/onboarding");
      return;
    }
    setUser(u);
    setReady(true);
    void cloudAppStateService.restoreForUser(u).then(() => {
      if (!active) return;
      const restored = authService.getCurrentUser();
      if (restored) {
        setUser(restored);
        void cloudAppStateService.backup({ id: restored.id, email: restored.email }, { force: true });
      } else {
        void cloudAppStateService.backup({ id: u.id, email: u.email }, { force: true });
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, ready };
}
