import { NextRequest, NextResponse } from "next/server";
import { capturePayPalOrder, missingPayPalEnv, parseCompletedPayPalOrder } from "@/server/paypalCheckout";
import { persistCompletedPayPalPayment } from "@/server/paypalSubscription";
import { getSupabaseServerClient, missingSupabaseServerEnv } from "@/server/supabaseClient";
import { notifySubscriptionSupport } from "@/server/subscriptionNotification";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const missingPayPal = missingPayPalEnv();
  if (missingPayPal.length) {
    return NextResponse.json(
      { ok: false, errorCode: "PAYPAL_NOT_CONFIGURED", message: "PayPal 付款服務尚未設定。", missing: missingPayPal },
      { status: 503 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, errorCode: "SUBSCRIPTION_STORAGE_UNAVAILABLE", message: "訂閱資料庫目前無法使用。", missing: missingSupabaseServerEnv() },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const orderId = String(body?.orderId || "").trim();
    const requestedUserId = String(body?.userId || "").trim();
    const requestedEmail = String(body?.email || "").trim().toLowerCase();

    if (!orderId) {
      return NextResponse.json(
        { ok: false, errorCode: "INVALID_CAPTURE_REQUEST", message: "缺少 PayPal 付款訂單。" },
        { status: 400 }
      );
    }

    const order = await capturePayPalOrder(orderId);
    const payment = parseCompletedPayPalOrder(order);

    if (!payment.completed || !payment.plan || !payment.amountTwd || payment.currency !== "TWD") {
      return NextResponse.json(
        { ok: false, errorCode: "PAYPAL_PAYMENT_NOT_COMPLETED", message: "PayPal 尚未確認付款完成。" },
        { status: 409 }
      );
    }

    if (payment.userId && requestedUserId && payment.userId !== requestedUserId) {
      return NextResponse.json(
        { ok: false, errorCode: "PAYPAL_ORDER_USER_MISMATCH", message: "付款訂單與目前登入帳號不一致。" },
        { status: 403 }
      );
    }

    const ownerUserId = payment.userId || requestedUserId;

    const saved = await persistCompletedPayPalPayment(supabase, {
      orderId: payment.orderId,
      captureId: payment.captureId,
      userId: ownerUserId,
      userEmail: requestedEmail,
      payerEmail: payment.payerEmail,
      payerName: payment.payerName,
      amountTwd: payment.amountTwd,
      currency: payment.currency,
      plan: payment.plan,
      rawEvent: order,
    });

    if (saved.isNew) {
      await notifySubscriptionSupport({
        platform: "paypal",
        eventId: `capture:${payment.captureId}`,
        eventType: "PAYMENT.CAPTURE.COMPLETED",
        userId: ownerUserId || null,
        userEmail: requestedEmail || null,
        payerEmail: payment.payerEmail || null,
        payerName: payment.payerName || null,
        productId: payment.plan.productId,
        planPeriod: payment.plan.period,
        amountTwd: payment.plan.amountTwd,
        currency: payment.currency,
        expiresAt: saved.expiresAt,
        matchedBy: saved.matchedBy,
        orderId: payment.orderId,
        captureId: payment.captureId,
      }).catch((error) => {
        console.warn("[SUBSCRIPTION_NOTIFY] PayPal email failed", error instanceof Error ? error.message : String(error));
      });
    }

    return NextResponse.json({
      ok: true,
      productId: payment.plan.productId,
      expiresAt: saved.expiresAt,
      matchedBy: saved.matchedBy,
    });
  } catch (error) {
    console.error("[PAYPAL_CHECKOUT] capture failed", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        ok: false,
        errorCode: "PAYPAL_CAPTURE_FAILED",
        message: "PayPal 無法確認這筆付款，請確認付款方式或稍後再試。",
      },
      { status: 502 }
    );
  }
}
