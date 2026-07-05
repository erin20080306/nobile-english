import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, missingSupabaseServerEnv } from "@/server/supabaseClient";

export const dynamic = "force-dynamic";

const PROMO_TRIAL_CODE = "qwe931016@";
const PROMO_TRIAL_FEATURE_LIMIT = 20;

const ALLOWED_FEATURES = new Set([
  "dialoguePractice",
  "scenePractice",
  "wordReview",
  "grammarPractice",
  "readingArticle",
  "gardenDailyBonus",
  "gardenPurchase",
  "customScene",
]);

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function messageFor(errorCode: string) {
  if (errorCode === "FEATURE_LIMIT_REACHED") return "此功能今日的 30 天優惠試用次數已用完。";
  if (errorCode === "PROMO_EXPIRED") return "30 天優惠試用已結束。";
  if (errorCode === "PROMO_NOT_REDEEMED") return "此帳號尚未兌換優惠試用。";
  return "此功能暫時無法使用優惠試用。";
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing Supabase server env", missing: missingSupabaseServerEnv() },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const userId = clean(body.userId);
    const code = clean(body.code).toLowerCase();
    const featureKey = clean(body.featureKey, 80);

    if (!userId || !code || !ALLOWED_FEATURES.has(featureKey)) {
      return NextResponse.json({ ok: false, errorCode: "INVALID_REQUEST", message: "缺少帳號或功能。" }, { status: 400 });
    }
    if (code !== PROMO_TRIAL_CODE) {
      return NextResponse.json({ ok: false, errorCode: "INVALID_CODE", message: "優惠碼不正確。" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("use_promo_trial_feature", {
      p_promo_code: PROMO_TRIAL_CODE,
      p_user_id: userId,
      p_feature_key: featureKey,
      p_max_feature_uses: PROMO_TRIAL_FEATURE_LIMIT,
    });

    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.ok) {
      const errorCode = String(row?.error_code || "PROMO_USAGE_FAILED");
      const status = errorCode === "FEATURE_LIMIT_REACHED" ? 409 : errorCode === "PROMO_EXPIRED" ? 410 : 400;
      return NextResponse.json(
        {
          ok: false,
          errorCode,
          message: messageFor(errorCode),
          usedCount: Number(row?.used_count) || 0,
          remainingCount: Number(row?.remaining_count) || 0,
          usageDate: row?.usage_date || null,
        },
        { status }
      );
    }

    return NextResponse.json({
      ok: true,
      usedCount: Number(row.used_count) || 0,
      remainingCount: Number(row.remaining_count) || 0,
      usageDate: row.usage_date || null,
    });
  } catch (error) {
    console.error("Promo trial use error:", error);
    return NextResponse.json({ ok: false, errorCode: "PROMO_USAGE_FAILED", message: "試用次數檢查失敗。" }, { status: 500 });
  }
}
