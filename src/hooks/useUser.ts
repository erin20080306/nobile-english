"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/types";
import { authService } from "@/services/authService";

// Client-side auth guard. Redirects to /login when no session.
export function useUser(options?: { requireOnboarded?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, ready };
}
