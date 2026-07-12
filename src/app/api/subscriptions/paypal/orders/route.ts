import { NextRequest, NextResponse } from "next/server";
import {
  createPayPalOrder,
  getCheckoutPlan,
  getPublicAppUrl,
  missingPayPalEnv,
} from "@/server/paypalCheckout";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const missing = missingPayPalEnv();
  if (missing.length) {
    return NextResponse.json(
      { ok: false, errorCode: "PAYPAL_NOT_CONFIGURED", message: "PayPal 付款服務尚未設定。", missing },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const userId = String(body?.userId || "").trim();
    const plan = getCheckoutPlan(body?.period, body?.promoCode);

    if (!userId || !plan) {
      return NextResponse.json(
        { ok: false, errorCode: "INVALID_PAYMENT_REQUEST", message: "付款方案或登入資料無效。" },
        { status: 400 }
      );
    }

    const appUrl = getPublicAppUrl(req.nextUrl.origin);
    const returnUrl = `${appUrl}/subscription/paypal/return`;
    const cancelUrl = `${appUrl}/subscription?paypal=cancelled`;
    const order = await createPayPalOrder({ plan, userId, returnUrl, cancelUrl });

    return NextResponse.json({
      ok: true,
      orderId: order.orderId,
      approvalUrl: order.approvalUrl,
    });
  } catch (error) {
    console.error("[PAYPAL_CHECKOUT] create order failed", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        ok: false,
        errorCode: "PAYPAL_CREATE_ORDER_FAILED",
        message: "目前無法建立 PayPal 訂單，請稍後再試。",
      },
      { status: 502 }
    );
  }
}
