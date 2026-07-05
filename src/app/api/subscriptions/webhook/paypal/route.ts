import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, missingSupabaseServerEnv } from "@/server/supabaseClient";
import { notifySubscriptionSupport } from "@/server/subscriptionNotification";

export const dynamic = "force-dynamic";

type PaypalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: Record<string, any>;
};

type PaypalPlan = {
  productId: string;
  period: "monthly" | "yearly";
  amountTwd: number;
  months: number;
};

const PAYPAL_PLANS: PaypalPlan[] = [
  { productId: "mobileenglish_monthly_399", period: "monthly", amountTwd: 399, months: 1 },
  { productId: "mobileenglish_monthly_299", period: "monthly", amountTwd: 299, months: 1 },
  { productId: "mobileenglish_yearly_1290", period: "yearly", amountTwd: 1290, months: 12 },
  { productId: "mobileenglish_yearly_1090", period: "yearly", amountTwd: 1090, months: 12 },
  { productId: "mobileenglish_yearly_2199", period: "yearly", amountTwd: 2199, months: 12 },
];

const COMPLETED_EVENTS = new Set([
  "PAYMENT.CAPTURE.COMPLETED",
  "CHECKOUT.ORDER.COMPLETED",
  "PAYMENT.SALE.COMPLETED",
]);

const REVOKE_EVENTS = new Set([
  "PAYMENT.CAPTURE.REFUNDED",
  "PAYMENT.CAPTURE.REVERSED",
  "PAYMENT.SALE.REFUNDED",
  "CUSTOMER.DISPUTE.CREATED",
]);

function paypalApiBase() {
  return process.env.PAYPAL_ENV === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

function paypalWebhookEnvMissing() {
  const missing: string[] = [];
  if (!process.env.PAYPAL_CLIENT_ID) missing.push("PAYPAL_CLIENT_ID");
  if (!process.env.PAYPAL_CLIENT_SECRET) missing.push("PAYPAL_CLIENT_SECRET");
  if (!process.env.PAYPAL_WEBHOOK_ID) missing.push("PAYPAL_WEBHOOK_ID");
  return missing;
}

function getString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function parseTwdAmount(value: unknown) {
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value || ""));
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric);
}

function extractAmount(resource: Record<string, any>, details?: Record<string, any>) {
  const amount =
    resource.amount ||
    resource.seller_receivable_breakdown?.gross_amount ||
    resource.purchase_units?.[0]?.amount ||
    resource.purchase_units?.[0]?.payments?.captures?.[0]?.amount ||
    details?.amount ||
    details?.purchase_units?.[0]?.amount ||
    details?.purchase_units?.[0]?.payments?.captures?.[0]?.amount;

  return {
    amountTwd: parseTwdAmount(amount?.value),
    currency: getString(amount?.currency_code, amount?.currency).toUpperCase(),
  };
}

function extractCaptureId(resource: Record<string, any>, details?: Record<string, any>) {
  return getString(
    resource.id,
    resource.capture_id,
    resource.purchase_units?.[0]?.payments?.captures?.[0]?.id,
    details?.purchase_units?.[0]?.payments?.captures?.[0]?.id
  );
}

function extractOrderId(resource: Record<string, any>) {
  return getString(
    resource.supplementary_data?.related_ids?.order_id,
    resource.order_id,
    resource.id
  );
}

function extractPayer(resource: Record<string, any>, details?: Record<string, any>) {
  const email = normalizeEmail(
    getString(
      resource.payer?.email_address,
      resource.payer?.email,
      resource.payer_email,
      resource.payer_info?.email,
      details?.payer?.email_address,
      details?.payer?.email
    )
  );

  const payerName = getString(
    resource.payer?.name?.full_name,
    [resource.payer?.name?.given_name, resource.payer?.name?.surname].filter(Boolean).join(" "),
    resource.payer_info?.first_name && resource.payer_info?.last_name
      ? `${resource.payer_info.first_name} ${resource.payer_info.last_name}`
      : "",
    details?.payer?.name?.full_name,
    [details?.payer?.name?.given_name, details?.payer?.name?.surname].filter(Boolean).join(" ")
  );

  return { email, payerName };
}

function extractCustomId(resource: Record<string, any>, details?: Record<string, any>) {
  return getString(
    resource.custom_id,
    resource.invoice_id,
    resource.purchase_units?.[0]?.custom_id,
    resource.purchase_units?.[0]?.invoice_id,
    details?.custom_id,
    details?.invoice_id,
    details?.purchase_units?.[0]?.custom_id,
    details?.purchase_units?.[0]?.invoice_id
  );
}

async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID || "";
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || "";
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`PayPal token request failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data.access_token) throw new Error("PayPal token response missing access_token");
  return String(data.access_token);
}

async function verifyWebhook(req: NextRequest, event: PaypalWebhookEvent) {
  const missing = paypalWebhookEnvMissing();
  if (missing.length) {
    return { ok: false, status: 503, body: { error: "Missing PayPal webhook env", missing } };
  }

  const transmissionId = req.headers.get("paypal-transmission-id");
  const transmissionTime = req.headers.get("paypal-transmission-time");
  const certUrl = req.headers.get("paypal-cert-url");
  const authAlgo = req.headers.get("paypal-auth-algo");
  const transmissionSig = req.headers.get("paypal-transmission-sig");

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return { ok: false, status: 400, body: { error: "Missing PayPal webhook headers" } };
  }

  const token = await getPayPalAccessToken();
  const response = await fetch(`${paypalApiBase()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return { ok: false, status: 401, body: { error: "PayPal webhook verification failed" } };
  }

  const data = await response.json();
  if (data.verification_status !== "SUCCESS") {
    return { ok: false, status: 401, body: { error: "Invalid PayPal webhook signature" } };
  }

  return { ok: true, status: 200, body: {} };
}

async function fetchOrderDetails(orderId: string, token: string) {
  if (!orderId) return null;
  const response = await fetch(`${paypalApiBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json();
}

function findPlan(amountTwd: number | null, currency: string) {
  if (!amountTwd || currency !== "TWD") return null;
  return PAYPAL_PLANS.find((plan) => plan.amountTwd === amountTwd) || null;
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
    const event = (await req.json()) as PaypalWebhookEvent;
    const eventType = event.event_type || "";
    const eventId = event.id || "";
    const resource = event.resource || {};

    if (!eventId || !eventType) {
      return NextResponse.json({ error: "Invalid PayPal webhook event" }, { status: 400 });
    }

    const verified = await verifyWebhook(req, event);
    if (!verified.ok) {
      return NextResponse.json(verified.body, { status: verified.status });
    }

    if (REVOKE_EVENTS.has(eventType)) {
      const captureId = extractCaptureId(resource);
      if (captureId) {
        await supabase
          .from("paypal_subscription_payments")
          .update({
            status: eventType === "CUSTOMER.DISPUTE.CREATED" ? "pending" : "refunded",
            raw_event: event,
          })
          .eq("paypal_capture_id", captureId);
      }
      return NextResponse.json({ success: true, handled: eventType });
    }

    if (!COMPLETED_EVENTS.has(eventType)) {
      return NextResponse.json({ success: true, ignored: eventType });
    }

    const token = await getPayPalAccessToken();
    const orderId = extractOrderId(resource);
    const orderDetails = orderId === resource.id ? resource : await fetchOrderDetails(orderId, token);
    const { amountTwd, currency } = extractAmount(resource, orderDetails || undefined);
    const plan = findPlan(amountTwd, currency);

    if (!plan) {
      return NextResponse.json({
        success: true,
        ignored: "UNRECOGNIZED_PAYPAL_AMOUNT",
        amountTwd,
        currency,
      });
    }

    const captureId = extractCaptureId(resource, orderDetails || undefined);
    const { email: payerEmail, payerName } = extractPayer(resource, orderDetails || undefined);
    const customId = extractCustomId(resource, orderDetails || undefined);
    const now = new Date();
    const expiresAt = addMonths(now, plan.months).toISOString();

    await supabase.from("paypal_subscription_payments").upsert(
      {
        paypal_event_id: eventId,
        paypal_resource_id: getString(resource.id),
        paypal_capture_id: captureId || null,
        paypal_order_id: orderId || null,
        user_id: customId || null,
        user_email: payerEmail || null,
        payer_email: payerEmail || null,
        payer_name: payerName || null,
        product_id: plan.productId,
        plan_period: plan.period,
        amount_twd: plan.amountTwd,
        currency,
        status: "active",
        starts_at: now.toISOString(),
        expires_at: expiresAt,
        raw_event: event,
      },
      { onConflict: "paypal_event_id" }
    );

    if (customId) {
      await supabase
        .from("profiles")
        .update({
          subscription_platform: "paypal",
          subscription_status: "active",
          subscription_product_id: plan.productId,
          subscription_expires_at: expiresAt,
          subscription_entitlement: "premium",
          subscription_updated_at: now.toISOString(),
        })
        .eq("id", customId);
    }

    if (payerEmail) {
      await supabase
        .from("profiles")
        .update({
          subscription_platform: "paypal",
          subscription_status: "active",
          subscription_product_id: plan.productId,
          subscription_expires_at: expiresAt,
          subscription_entitlement: "premium",
          subscription_updated_at: now.toISOString(),
        })
        .ilike("email", payerEmail);
    }

    await notifySubscriptionSupport({
      platform: "paypal",
      eventId,
      eventType,
      userId: customId || null,
      userEmail: payerEmail || null,
      payerEmail: payerEmail || null,
      payerName: payerName || null,
      productId: plan.productId,
      planPeriod: plan.period,
      amountTwd: plan.amountTwd,
      currency,
      expiresAt,
      matchedBy: customId ? "custom_id" : payerEmail ? "payer_email" : "payment_record_only",
      orderId: orderId || null,
      captureId: captureId || null,
    }).catch((error) => {
      console.warn("[SUBSCRIPTION_NOTIFY] PayPal email failed", error instanceof Error ? error.message : String(error));
    });

    return NextResponse.json({
      success: true,
      productId: plan.productId,
      expiresAt,
      matchedBy: customId ? "custom_id" : payerEmail ? "payer_email" : "payment_record_only",
    });
  } catch (error) {
    console.error("PayPal webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
