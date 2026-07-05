type SubscriptionSupportNotification = {
  platform: "paypal" | "revenuecat";
  eventId?: string;
  eventType?: string;
  userId?: string | null;
  userEmail?: string | null;
  payerEmail?: string | null;
  payerName?: string | null;
  productId?: string | null;
  planPeriod?: string | null;
  amountTwd?: number | null;
  currency?: string | null;
  expiresAt?: string | null;
  matchedBy?: string | null;
  orderId?: string | null;
  captureId?: string | null;
};

function env(name: string) {
  return (process.env[name] || "").trim();
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatLine(label: string, value: unknown) {
  const text = String(value ?? "").trim();
  return text ? `${label}: ${text}` : "";
}

function buildText(payload: SubscriptionSupportNotification) {
  return [
    "有新的訂閱成功啟用。",
    formatLine("來源", payload.platform),
    formatLine("事件", payload.eventType),
    formatLine("事件 ID", payload.eventId),
    formatLine("使用者 ID", payload.userId),
    formatLine("使用者 email", payload.userEmail),
    formatLine("付款 email", payload.payerEmail),
    formatLine("付款姓名", payload.payerName),
    formatLine("方案", payload.productId),
    formatLine("期間", payload.planPeriod),
    formatLine("金額", payload.amountTwd ? `NT$ ${payload.amountTwd}` : ""),
    formatLine("幣別", payload.currency),
    formatLine("到期時間", payload.expiresAt),
    formatLine("匹配方式", payload.matchedBy),
    formatLine("PayPal order", payload.orderId),
    formatLine("PayPal capture", payload.captureId),
  ].filter(Boolean).join("\n");
}

function buildHtml(payload: SubscriptionSupportNotification) {
  const allRows: Array<[string, unknown]> = [
    ["來源", payload.platform],
    ["事件", payload.eventType],
    ["事件 ID", payload.eventId],
    ["使用者 ID", payload.userId],
    ["使用者 email", payload.userEmail],
    ["付款 email", payload.payerEmail],
    ["付款姓名", payload.payerName],
    ["方案", payload.productId],
    ["期間", payload.planPeriod],
    ["金額", payload.amountTwd ? `NT$ ${payload.amountTwd}` : ""],
    ["幣別", payload.currency],
    ["到期時間", payload.expiresAt],
    ["匹配方式", payload.matchedBy],
    ["PayPal order", payload.orderId],
    ["PayPal capture", payload.captureId],
  ];
  const rows = allRows.filter(([, value]) => String(value ?? "").trim());

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#332f42">
      <h2 style="margin:0 0 12px">有新的訂閱成功啟用</h2>
      <table style="border-collapse:collapse;width:100%;max-width:640px">
        ${rows.map(([label, value]) => `
          <tr>
            <td style="padding:8px 10px;border:1px solid #eee8ff;background:#faf7ff;font-weight:700;width:150px">${escapeHtml(label)}</td>
            <td style="padding:8px 10px;border:1px solid #eee8ff">${escapeHtml(value)}</td>
          </tr>
        `).join("")}
      </table>
    </div>
  `;
}

export async function notifySubscriptionSupport(payload: SubscriptionSupportNotification): Promise<void> {
  const apiKey = env("RESEND_API_KEY");
  if (!apiKey) {
    console.info("[SUBSCRIPTION_NOTIFY] skipped: RESEND_API_KEY not configured");
    return;
  }

  const to = env("SUBSCRIPTION_NOTIFY_TO_EMAIL") || env("SUPPORT_EMAIL") || "support.mobileenglish@gmail.com";
  const from = env("SUBSCRIPTION_NOTIFY_FROM_EMAIL") || "Nobile English <onboarding@resend.dev>";
  const subject = `新訂閱通知：${payload.platform}${payload.amountTwd ? ` NT$${payload.amountTwd}` : ""}`;
  const replyTo = payload.payerEmail || payload.userEmail || undefined;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text: buildText(payload),
      html: buildHtml(payload),
      reply_to: replyTo,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Resend subscription notification failed (${response.status}): ${message.slice(0, 300)}`);
  }
}
