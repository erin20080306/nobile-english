import type { SupabaseClient } from "@supabase/supabase-js";
import { addPlanMonths, type PayPalPlan } from "@/server/paypalCheckout";

type CompletedPayment = {
  orderId: string;
  captureId: string;
  userId: string;
  userEmail: string;
  payerEmail: string;
  payerName: string;
  amountTwd: number;
  currency: string;
  plan: PayPalPlan;
  rawEvent: unknown;
};

type ExistingPayment = {
  id: string;
  expires_at: string;
};

export async function persistCompletedPayPalPayment(
  supabase: SupabaseClient,
  payment: CompletedPayment
) {
  if (!payment.captureId || !payment.orderId) {
    throw new Error("PayPal payment is missing order or capture id");
  }

  const { data: existing, error: existingError } = await supabase
    .from("paypal_subscription_payments")
    .select("id, expires_at")
    .eq("paypal_capture_id", payment.captureId)
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(`PayPal payment lookup failed: ${existingError.message}`);

  if (existing) {
    return {
      isNew: false,
      expiresAt: (existing as ExistingPayment).expires_at,
      matchedBy: payment.userId ? "custom_id" : payment.payerEmail ? "payer_email" : "payment_record_only",
    };
  }

  const now = new Date();
  const expiresAt = addPlanMonths(now, payment.plan.months).toISOString();
  const eventId = `capture:${payment.captureId}`;
  const { error: insertError } = await supabase.from("paypal_subscription_payments").insert({
    paypal_event_id: eventId,
    paypal_resource_id: payment.captureId,
    paypal_capture_id: payment.captureId,
    paypal_order_id: payment.orderId,
    user_id: payment.userId || null,
    user_email: payment.userEmail || payment.payerEmail || null,
    payer_email: payment.payerEmail || null,
    payer_name: payment.payerName || null,
    product_id: payment.plan.productId,
    plan_period: payment.plan.period,
    amount_twd: payment.amountTwd,
    currency: payment.currency,
    status: "active",
    starts_at: now.toISOString(),
    expires_at: expiresAt,
    raw_event: payment.rawEvent,
  });

  if (insertError) {
    const { data: raced } = await supabase
      .from("paypal_subscription_payments")
      .select("expires_at")
      .eq("paypal_event_id", eventId)
      .maybeSingle();
    if (!raced?.expires_at) throw new Error(`PayPal payment save failed: ${insertError.message}`);
    return {
      isNew: false,
      expiresAt: String(raced.expires_at),
      matchedBy: payment.userId ? "custom_id" : payment.payerEmail ? "payer_email" : "payment_record_only",
    };
  }

  if (payment.userId) {
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: payment.userId,
        email: payment.userEmail || payment.payerEmail || null,
        subscription_platform: "paypal",
        subscription_status: "active",
        subscription_product_id: payment.plan.productId,
        subscription_expires_at: expiresAt,
        subscription_entitlement: "premium",
        subscription_updated_at: now.toISOString(),
      },
      { onConflict: "id" }
    );
    if (profileError) throw new Error(`PayPal profile update failed: ${profileError.message}`);
  } else if (payment.payerEmail) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        subscription_platform: "paypal",
        subscription_status: "active",
        subscription_product_id: payment.plan.productId,
        subscription_expires_at: expiresAt,
        subscription_entitlement: "premium",
        subscription_updated_at: now.toISOString(),
      })
      .ilike("email", payment.payerEmail);
    if (profileError) throw new Error(`PayPal profile email update failed: ${profileError.message}`);
  }

  return {
    isNew: true,
    expiresAt,
    matchedBy: payment.userId ? "custom_id" : payment.payerEmail ? "payer_email" : "payment_record_only",
  };
}
