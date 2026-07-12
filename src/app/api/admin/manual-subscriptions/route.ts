import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, missingSupabaseServerEnv } from "@/server/supabaseClient";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "erin20080306@gmail.com";

const PLAN_CONFIG = {
  monthly: {
    productId: "mobileenglish_monthly_399",
    amountTwd: 399,
  },
  yearly: {
    productId: "mobileenglish_yearly_2199",
    amountTwd: 1290,
  },
  custom: {
    productId: "manual_custom_subscription",
    amountTwd: 0,
  },
} as const;

type PlanPeriod = keyof typeof PLAN_CONFIG;

type ManualPaymentRequestRow = {
  id: string;
  user_id: string;
  user_email: string;
  plan_period: "monthly" | "yearly";
  product_id: string;
  amount_twd: number;
  status: string;
  promo_code: string | null;
  created_at: string;
};

function bearerToken(req: NextRequest) {
  const value = req.headers.get("authorization") || "";
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

function taipeiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseTaipeiDate(value: string) {
  const parsed = new Date(`${value}T00:00:00+08:00`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function defaultExpiry(start: Date, period: PlanPeriod) {
  const next = new Date(start);
  if (period === "yearly") next.setUTCFullYear(next.getUTCFullYear() + 1);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

async function requireAdmin(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Missing Supabase server env", missing: missingSupabaseServerEnv() },
        { status: 500 }
      ),
    };
  }

  const token = bearerToken(req);
  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "請使用管理員 Google 帳號登入。" }, { status: 401 }),
    };
  }

  const { data, error } = await supabase.auth.getUser(token);
  const email = data.user?.email?.trim().toLowerCase() || "";
  if (error || email !== ADMIN_EMAIL) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "沒有管理員權限。" }, { status: 403 }),
    };
  }

  return { ok: true as const, supabase, adminEmail: email };
}

async function findUserIdByEmail(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  email: string
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (profile?.id) return String(profile.id);

  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((item) => item.email?.trim().toLowerCase() === email);
  return user?.id || null;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const [requestsResult, recordsResult] = await Promise.all([
    auth.supabase
      .from("manual_payment_requests")
      .select("id, user_id, user_email, plan_period, product_id, amount_twd, status, promo_code, created_at, reviewed_at, reviewed_by, review_note")
      .order("created_at", { ascending: false })
      .limit(100),
    auth.supabase
      .from("manual_subscription_records")
      .select("id, request_id, user_id, user_email, action, plan_period, product_id, amount_twd, starts_at, expires_at, status, source, admin_email, note, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const missingTable = requestsResult.error?.code === "42P01" || recordsResult.error?.code === "42P01";
  if (missingTable) {
    return NextResponse.json({
      available: false,
      error: "請先執行 20260712_manual_subscription_workflow.sql migration。",
      requests: [],
      records: [],
    });
  }

  if (requestsResult.error || recordsResult.error) {
    console.error("Manual subscription admin GET error", requestsResult.error || recordsResult.error);
    return NextResponse.json({ error: "無法讀取手動訂閱資料。" }, { status: 500 });
  }

  return NextResponse.json({
    available: true,
    requests: requestsResult.data || [],
    records: recordsResult.data || [],
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const action = String(body?.action || "");

  if (action === "reject") {
    const requestId = String(body?.requestId || "");
    if (!requestId) {
      return NextResponse.json({ ok: false, error: "缺少付款通知編號。" }, { status: 400 });
    }

    const { error } = await auth.supabase
      .from("manual_payment_requests")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: auth.adminEmail,
        review_note: String(body?.note || "未查到款項"),
      })
      .eq("id", requestId)
      .eq("status", "pending");

    if (error) {
      return NextResponse.json({ ok: false, error: "無法拒絕此付款通知。" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, message: "已標記為未通過。" });
  }

  if (action !== "activate" && action !== "approve") {
    return NextResponse.json({ ok: false, error: "不支援的操作。" }, { status: 400 });
  }

  let requestRow: ManualPaymentRequestRow | null = null;
  if (action === "approve") {
    const requestId = String(body?.requestId || "");
    const { data, error } = await auth.supabase
      .from("manual_payment_requests")
      .select("id, user_id, user_email, plan_period, product_id, amount_twd, status, promo_code, created_at")
      .eq("id", requestId)
      .eq("status", "pending")
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: "找不到待處理的付款通知。" }, { status: 404 });
    }
    requestRow = data as ManualPaymentRequestRow;
  }

  const email = String(requestRow?.user_email || body?.email || "").trim().toLowerCase();
  const period = String(requestRow?.plan_period || body?.period || "monthly") as PlanPeriod;
  if (!email || !(period in PLAN_CONFIG)) {
    return NextResponse.json({ ok: false, error: "請輸入正確 Email 與方案。" }, { status: 400 });
  }

  let userId = requestRow?.user_id || null;
  if (!userId) userId = await findUserIdByEmail(auth.supabase, email);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "找不到此 Google 登入帳號，請確認對方已完成註冊。" }, { status: 404 });
  }

  const startDateValue = String(body?.startDate || taipeiDateKey());
  const startsAt = parseTaipeiDate(startDateValue);
  if (!startsAt) {
    return NextResponse.json({ ok: false, error: "開始日期格式不正確。" }, { status: 400 });
  }

  const requestedExpiry = String(body?.expiresAt || "");
  const expiresAt = requestedExpiry ? parseTaipeiDate(requestedExpiry) : defaultExpiry(startsAt, period);
  if (!expiresAt || expiresAt <= startsAt) {
    return NextResponse.json({ ok: false, error: "到期日必須晚於開始日。" }, { status: 400 });
  }

  const plan = PLAN_CONFIG[period];
  const productId = requestRow?.product_id || plan.productId;
  const amountTwd = Number(requestRow?.amount_twd ?? body?.amountTwd ?? plan.amountTwd);
  const now = new Date().toISOString();

  const { error: profileError } = await auth.supabase.from("profiles").upsert(
    {
      id: String(userId),
      email,
      subscription_platform: "web",
      subscription_status: "active",
      subscription_product_id: productId,
      subscription_expires_at: expiresAt.toISOString(),
      subscription_entitlement: "premium",
      subscription_updated_at: now,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error("Manual subscription profile update error", profileError);
    return NextResponse.json({ ok: false, error: `會員開通失敗：${profileError.message}` }, { status: 500 });
  }

  const source = action === "approve" ? "bank_transfer_request" : "admin_manual";
  const { data: record, error: recordError } = await auth.supabase
    .from("manual_subscription_records")
    .insert({
      request_id: requestRow?.id || null,
      user_id: String(userId),
      user_email: email,
      action: action === "approve" ? "approve_payment" : "activate",
      plan_period: period,
      product_id: productId,
      amount_twd: Number.isFinite(amountTwd) && amountTwd >= 0 ? amountTwd : 0,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: "active",
      source,
      admin_email: auth.adminEmail,
      note: String(body?.note || "").trim() || null,
    })
    .select("id, user_email, starts_at, expires_at, plan_period, amount_twd, created_at")
    .single();

  if (recordError) {
    console.error("Manual subscription record insert error", recordError);
    return NextResponse.json(
      { ok: false, error: "會員已開通，但寫入操作紀錄失敗，請立即檢查資料庫。" },
      { status: 500 }
    );
  }

  if (requestRow) {
    await auth.supabase
      .from("manual_payment_requests")
      .update({
        status: "approved",
        reviewed_at: now,
        reviewed_by: auth.adminEmail,
        review_note: String(body?.note || "已核對入帳"),
      })
      .eq("id", requestRow.id);
  }

  return NextResponse.json({
    ok: true,
    message: "已開通 Premium，並完成資料庫紀錄。",
    record,
  });
}
