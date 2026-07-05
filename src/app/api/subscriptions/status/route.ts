import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, missingSupabaseServerEnv } from "@/server/supabaseClient";

export const dynamic = "force-dynamic";

type SubscriptionStatusPayload = {
  isActive: boolean;
  platform: string | null;
  status: string | null;
  productId: string | null;
  expiresAt: string | null;
  entitlement: string | null;
  promoTrial?: PromoTrialPayload | null;
};

type PaypalSubscriptionRow = {
  status: string | null;
  product_id: string | null;
  expires_at: string | null;
  plan_period: string | null;
};

type PromoTrialRow = {
  promo_code: string;
  starts_at: string;
  expires_at: string;
  max_feature_uses: number | null;
};

type PromoTrialPayload = {
  code: string;
  startsAt: string;
  expiresAt: string;
  daysLeft: number;
  maxFeatureUses: number;
  isActive: boolean;
};

function inactivePayload(): SubscriptionStatusPayload {
  return {
    isActive: false,
    platform: null,
    status: null,
    productId: null,
    expiresAt: null,
    entitlement: null,
    promoTrial: null,
  };
}

function isActive(status?: string | null, expiresAt?: string | null) {
  return status === "active" && Boolean(expiresAt) && new Date(expiresAt!) > new Date();
}

function chooseLaterActive(
  current: PaypalSubscriptionRow | null,
  candidate: PaypalSubscriptionRow | null
): PaypalSubscriptionRow | null {
  if (!candidate || !isActive(candidate.status, candidate.expires_at)) return current;
  if (!current) return candidate;
  const currentTime = current.expires_at ? new Date(current.expires_at).getTime() : 0;
  const candidateTime = candidate.expires_at ? new Date(candidate.expires_at).getTime() : 0;
  return candidateTime > currentTime ? candidate : current;
}

function promoPayload(row: PromoTrialRow): PromoTrialPayload {
  const expiresAt = new Date(row.expires_at);
  const remainingMs = expiresAt.getTime() - Date.now();
  return {
    code: row.promo_code,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    daysLeft: Math.max(0, Math.ceil(remainingMs / 86400000)),
    maxFeatureUses: Number(row.max_feature_uses) || 20,
    isActive: remainingMs > 0,
  };
}

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing Supabase server env", missing: missingSupabaseServerEnv() },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const email = searchParams.get("email")?.trim().toLowerCase() || "";

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "subscription_platform, subscription_status, subscription_product_id, subscription_expires_at, subscription_entitlement"
      )
      .eq("id", userId)
      .maybeSingle();

    // Check if subscription is active
    const profileIsActive = isActive(profile?.subscription_status, profile?.subscription_expires_at);
    if (profile && profileIsActive) {
      return NextResponse.json({
        isActive: true,
        platform: profile.subscription_platform,
        status: profile.subscription_status,
        productId: profile.subscription_product_id,
        expiresAt: profile.subscription_expires_at,
        entitlement: profile.subscription_entitlement,
      });
    }

    let paypalMatch: PaypalSubscriptionRow | null = null;

    const fetchPaypalMatch = async (
      column: "user_id" | "user_email" | "payer_email",
      value: string
    ): Promise<PaypalSubscriptionRow | null> => {
      const { data } = await supabase
        .from("paypal_subscription_payments")
        .select("status, product_id, expires_at, plan_period")
        .eq(column, value)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as PaypalSubscriptionRow | null;
    };

    paypalMatch = chooseLaterActive(paypalMatch, await fetchPaypalMatch("user_id", userId));
    if (email) {
      paypalMatch = chooseLaterActive(paypalMatch, await fetchPaypalMatch("user_email", email));
      paypalMatch = chooseLaterActive(paypalMatch, await fetchPaypalMatch("payer_email", email));
    }

    if (paypalMatch) {
      return NextResponse.json({
        isActive: true,
        platform: "paypal",
        status: paypalMatch.status,
        productId: paypalMatch.product_id,
        expiresAt: paypalMatch.expires_at,
        entitlement: "premium",
      });
    }

    const { data: promo, error: promoError } = await supabase
      .from("promo_trial_redemptions")
      .select("promo_code, starts_at, expires_at, max_feature_uses")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!promoError && promo) {
      const payload = promoPayload(promo as PromoTrialRow);
      return NextResponse.json({
        isActive: false,
        platform: "web",
        status: "active",
        productId: "promo_trial_30d",
        expiresAt: payload.expiresAt,
        entitlement: "promo_trial",
        promoTrial: payload,
      });
    }

    if (profile) {
      return NextResponse.json({
        isActive: false,
        platform: profile.subscription_platform,
        status: profile.subscription_status,
        productId: profile.subscription_product_id,
        expiresAt: profile.subscription_expires_at,
        entitlement: profile.subscription_entitlement,
      });
    }

    return NextResponse.json(inactivePayload());
  } catch (error) {
    console.error("Subscription status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
