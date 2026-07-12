import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, missingSupabaseServerEnv } from "@/server/supabaseClient";

export const dynamic = "force-dynamic";

const PRELAUNCH_PROMO_CODE = "qwe811122@661012";
const BANK_ACCOUNT = "901560071034";

const PLAN_CONFIG = {
  monthly: {
    productId: "mobileenglish_monthly_399",
    regularAmount: 399,
    promoAmount: 299,
  },
  yearly: {
    productId: "mobileenglish_yearly_2199",
    regularAmount: 1290,
    promoAmount: 1090,
  },
} as const;

type PlanPeriod = keyof typeof PLAN_CONFIG;

function bearerToken(req: NextRequest) {
  const value = req.headers.get("authorization") || "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "付款通知服務尚未設定", missing: missingSupabaseServerEnv() },
      { status: 500 }
    );
  }

  const token = bearerToken(req);
  if (!token) {
    return NextResponse.json({ ok: false, message: "請先使用 Google 帳號登入。" }, { status: 401 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const authUser = authData.user;
  const email = authUser?.email?.trim().toLowerCase() || "";
  if (authError || !authUser?.id || !email) {
    return NextResponse.json({ ok: false, message: "登入狀態已失效，請重新登入。" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const period = String(body?.period || "") as PlanPeriod;
  if (!(period in PLAN_CONFIG)) {
    return NextResponse.json({ ok: false, message: "請重新選擇付款方案。" }, { status: 400 });
  }

  const promoCode = String(body?.promoCode || "").trim().toLowerCase();
  const config = PLAN_CONFIG[period];
  const promoApplied = promoCode === PRELAUNCH_PROMO_CODE;
  const amountTwd = promoApplied ? config.promoAmount : config.regularAmount;

  const { data: existing } = await supabase
    .from("manual_payment_requests")
    .select("id, status, plan_period, amount_twd, created_at")
    .eq("user_id", authUser.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      alreadyPending: true,
      request: existing,
      message: "你已通知管理員，請等待核對款項與開通。",
    });
  }

  const { data: requestRow, error } = await supabase
    .from("manual_payment_requests")
    .insert({
      user_id: authUser.id,
      user_email: email,
      plan_period: period,
      product_id: config.productId,
      amount_twd: amountTwd,
      promo_code: promoApplied ? PRELAUNCH_PROMO_CODE : null,
      bank_account: BANK_ACCOUNT,
      status: "pending",
    })
    .select("id, status, plan_period, amount_twd, created_at")
    .single();

  if (error) {
    console.error("Manual payment request error", error);
    const missingTable = error.code === "42P01";
    return NextResponse.json(
      {
        ok: false,
        message: missingTable
          ? "付款通知資料表尚未建立，請管理員先執行資料庫 migration。"
          : "目前無法通知管理員，請稍後再試。",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    alreadyPending: false,
    request: requestRow,
    message: "已通知管理員，核對款項後會為你開通。",
  });
}
