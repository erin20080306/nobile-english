import { randomUUID } from "node:crypto";

export type PayPalPlanPeriod = "monthly" | "yearly";

export type PayPalPlan = {
  productId: string;
  period: PayPalPlanPeriod;
  amountTwd: number;
  months: number;
  description: string;
};

type PayPalLink = {
  href?: string;
  rel?: string;
};

type PayPalOrder = Record<string, any> & {
  id?: string;
  status?: string;
  links?: PayPalLink[];
};

const PRELAUNCH_PROMO_CODE = "qwe811122@661012";

export const PAYPAL_PLANS: PayPalPlan[] = [
  {
    productId: "mobileenglish_monthly_399",
    period: "monthly",
    amountTwd: 399,
    months: 1,
    description: "Mobile English 月費方案",
  },
  {
    productId: "mobileenglish_monthly_299",
    period: "monthly",
    amountTwd: 299,
    months: 1,
    description: "Mobile English 月費優惠方案",
  },
  {
    productId: "mobileenglish_yearly_1290",
    period: "yearly",
    amountTwd: 1290,
    months: 12,
    description: "Mobile English 年費首年方案",
  },
  {
    productId: "mobileenglish_yearly_1090",
    period: "yearly",
    amountTwd: 1090,
    months: 12,
    description: "Mobile English 年費優惠方案",
  },
  {
    productId: "mobileenglish_yearly_2199",
    period: "yearly",
    amountTwd: 2199,
    months: 12,
    description: "Mobile English 年費續訂方案",
  },
];

export function missingPayPalEnv() {
  const missing: string[] = [];
  if (!process.env.PAYPAL_CLIENT_ID) missing.push("PAYPAL_CLIENT_ID");
  if (!process.env.PAYPAL_CLIENT_SECRET) missing.push("PAYPAL_CLIENT_SECRET");
  return missing;
}

function paypalApiBase() {
  return process.env.PAYPAL_ENV === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
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

function parseAmount(value: unknown) {
  const parsed = Number.parseFloat(String(value || ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export function getCheckoutPlan(period: unknown, promoCode: unknown) {
  if (period !== "monthly" && period !== "yearly") return null;
  const promoApplied = String(promoCode || "").trim().toLowerCase() === PRELAUNCH_PROMO_CODE;
  const amount = period === "monthly"
    ? promoApplied ? 299 : 399
    : promoApplied ? 1090 : 1290;
  return PAYPAL_PLANS.find((plan) => plan.period === period && plan.amountTwd === amount) || null;
}

export function getPublicAppUrl(requestOrigin: string) {
  const configured = (process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") return "https://nobile-english.vercel.app";
  return requestOrigin.replace(/\/$/, "");
}

export async function getPayPalAccessToken() {
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

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const issue = getString(data?.error, data?.name);
    throw new Error(`PayPal token request failed: ${response.status}${issue ? ` ${issue}` : ""}`);
  }

  if (!data.access_token) throw new Error("PayPal token response missing access_token");
  return String(data.access_token);
}

export async function createPayPalOrder(input: {
  plan: PayPalPlan;
  userId: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  const token = await getPayPalAccessToken();
  const response = await fetch(`${paypalApiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      "PayPal-Request-Id": randomUUID(),
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.plan.productId,
          custom_id: input.userId,
          description: input.plan.description,
          amount: {
            currency_code: "TWD",
            value: String(input.plan.amountTwd),
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Mobile English",
            landing_page: "NO_PREFERENCE",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl,
          },
        },
      },
    }),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as PayPalOrder | null;
  if (!response.ok || !data?.id) {
    const detail = getString(data?.details?.[0]?.issue, data?.name);
    throw new Error(`PayPal create order failed: ${response.status}${detail ? ` ${detail}` : ""}`);
  }

  const approvalUrl = data.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href;
  if (!approvalUrl) throw new Error("PayPal order response missing approval URL");

  return { orderId: data.id, approvalUrl };
}

async function fetchPayPalOrder(orderId: string, token: string) {
  const response = await fetch(`${paypalApiBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`PayPal order lookup failed: ${response.status}`);
  return (await response.json()) as PayPalOrder;
}

export async function capturePayPalOrder(orderId: string) {
  const token = await getPayPalAccessToken();
  const response = await fetch(
    `${paypalApiBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        "PayPal-Request-Id": `capture-${orderId}`,
      },
      body: "{}",
      cache: "no-store",
    }
  );

  const data = (await response.json().catch(() => null)) as PayPalOrder | null;
  if (response.ok && data) return data;

  const issue = getString(data?.details?.[0]?.issue, data?.name);
  if (response.status === 422 && issue === "ORDER_ALREADY_CAPTURED") {
    return fetchPayPalOrder(orderId, token);
  }
  throw new Error(`PayPal capture failed: ${response.status}${issue ? ` ${issue}` : ""}`);
}

export function parseCompletedPayPalOrder(order: PayPalOrder) {
  const purchaseUnit = order.purchase_units?.[0] || {};
  const capture = purchaseUnit.payments?.captures?.[0] || {};
  const amount = capture.amount || purchaseUnit.amount || {};
  const amountTwd = parseAmount(amount.value);
  const currency = getString(amount.currency_code, amount.currency).toUpperCase();
  const productId = getString(purchaseUnit.reference_id);
  const plan = PAYPAL_PLANS.find((candidate) => candidate.productId === productId)
    || PAYPAL_PLANS.find((candidate) => candidate.amountTwd === amountTwd && currency === "TWD")
    || null;

  const payerEmail = normalizeEmail(getString(order.payer?.email_address, order.payer?.email));
  const payerName = getString(
    order.payer?.name?.full_name,
    [order.payer?.name?.given_name, order.payer?.name?.surname].filter(Boolean).join(" ")
  );

  return {
    completed: order.status === "COMPLETED" && capture.status === "COMPLETED",
    orderId: getString(order.id),
    captureId: getString(capture.id),
    userId: getString(purchaseUnit.custom_id),
    payerEmail,
    payerName,
    amountTwd,
    currency,
    plan,
  };
}

export function addPlanMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}
