import { NextRequest, NextResponse } from "next/server";
import {
  createPayPalOrder,
  getCheckoutPlan,
  getPublicAppUrl,
  missingPayPalEnv,
} from "@/server/paypalCheckout";

export const dynamic = "force-dynamic";

function safePayPalError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const match = raw.match(/PayPal (token request|create order) failed: (\d{3})(?: ([A-Z0-9_]+|[a-z0-9_]+))?/);
  const providerStatus = match?.[2] || null;
  const providerIssue = match?.[3] || null;

  if (raw.includes("token request failed")) {
    return {
      errorCode: "PAYPAL_CREDENTIALS_REJECTED",
      message: "PayPal Live API 憑證驗證失敗，請更新 Production 的 Client ID 與 Secret。",
      providerStatus,
      providerIssue,
    };
  }
  return {
    errorCode: "PAYPAL_CREATE_ORDER_FAILED",
    message: providerIssue === "CURRENCY_NOT_SUPPORTED"
      ? "目前的 PayPal 商家帳戶尚未開放 TWD 收款。"
      : "PayPal 拒絕建立訂單，請確認商家帳戶與付款權限。",
    providerStatus,
    providerIssue,
  };
}

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
    const safeError = safePayPalError(error);
    return NextResponse.json(
      {
        ok: false,
        ...safeError,
      },
      { status: 502 }
    );
  }
}
