import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, missingSupabaseServerEnv } from "@/server/supabaseClient";

export const dynamic = "force-dynamic";

const PROMO_TRIAL_CODE = "qwe931016@";
const PROMO_TRIAL_DAYS = 30;
const PROMO_TRIAL_MAX_USERS = 2;
const PROMO_TRIAL_FEATURE_LIMIT = 20;

function clean(value: unknown, max = 240) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function messageFor(errorCode: string) {
  if (errorCode === "PROMO_LIMIT_REACHED") return "此優惠碼名額已滿，已自動失效。";
  if (errorCode === "ALREADY_REDEEMED_EXPIRED") return "此優惠碼已兌換過，30 天試用已結束。";
  if (errorCode === "INVALID_CODE") return "優惠碼不正確。";
  return "優惠碼無法使用。";
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
    const email = clean(body.email).toLowerCase();
    const code = clean(body.code).toLowerCase();

    if (!userId || !email || !code) {
      return NextResponse.json({ errorCode: "INVALID_REQUEST", message: "缺少帳號或優惠碼。" }, { status: 400 });
    }
    if (code !== PROMO_TRIAL_CODE) {
      return NextResponse.json({ errorCode: "INVALID_CODE", message: messageFor("INVALID_CODE") }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("redeem_promo_trial", {
      p_promo_code: PROMO_TRIAL_CODE,
      p_user_id: userId,
      p_user_email: email,
      p_trial_days: PROMO_TRIAL_DAYS,
      p_max_users: PROMO_TRIAL_MAX_USERS,
      p_max_feature_uses: PROMO_TRIAL_FEATURE_LIMIT,
    });

    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.ok) {
      const errorCode = String(row?.error_code || "PROMO_UNAVAILABLE");
      const status = errorCode === "PROMO_LIMIT_REACHED" ? 409 : errorCode === "ALREADY_REDEEMED_EXPIRED" ? 410 : 400;
      return NextResponse.json({ errorCode, message: messageFor(errorCode) }, { status });
    }

    return NextResponse.json({
      ok: true,
      promoTrial: {
        code: PROMO_TRIAL_CODE,
        startsAt: row.starts_at,
        expiresAt: row.expires_at,
        redeemedSlot: row.redeemed_slot,
        maxFeatureUses: Number(row.max_feature_uses) || PROMO_TRIAL_FEATURE_LIMIT,
      },
    });
  } catch (error) {
    console.error("Promo trial redeem error:", error);
    return NextResponse.json({ errorCode: "PROMO_REDEEM_FAILED", message: "優惠碼兌換失敗，請稍後再試。" }, { status: 500 });
  }
}
