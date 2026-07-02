"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/authService";
import { supabaseBrowserClient } from "@/services/supabaseBrowserClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!supabaseBrowserClient) {
        setError("登入服務尚未設定");
        return;
      }

      // The Supabase SDK auto-exchanges the OAuth code/hash in the current
      // URL for a session (detectSessionInUrl: true). Poll briefly in case
      // that hasn't finished yet on the very first render.
      let session = (await supabaseBrowserClient.auth.getSession()).data.session;
      for (let attempt = 0; !session && attempt < 20 && !cancelled; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        session = (await supabaseBrowserClient.auth.getSession()).data.session;
      }

      if (cancelled) return;
      if (!session?.user) {
        setError("登入失敗，請重新嘗試");
        return;
      }

      try {
        const user = await authService.hydrateFromSupabaseSession(session.user);
        if (cancelled) return;
        
        // Check if user already has learning data to skip onboarding
        const { learningService } = await import("@/services/learningService");
        const hasLearningData = learningService.getPlan() || learningService.getLevelResult();
        const shouldSkipOnboarding = user.onboarded || hasLearningData;
        
        router.replace(shouldSkipOnboarding ? "/dashboard" : "/onboarding");
      } catch {
        if (!cancelled) setError("恢復帳號資料時發生錯誤，請重新嘗試");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 px-6 text-center">
      {error ? (
        <>
          <p className="text-peachDeep font-bold">{error}</p>
          <button
            onClick={() => router.replace("/login")}
            className="rounded-3xl bg-lilacDeep text-white font-bold px-6 py-3"
          >
            返回登入頁
          </button>
        </>
      ) : (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-lilacDeep border-t-transparent" />
          <p className="text-inkSoft">登入中，正在恢復你的學習資料…</p>
        </>
      )}
    </div>
  );
}
