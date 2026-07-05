import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifySubscriptionSupport } from "@/server/subscriptionNotification";

export const dynamic = "force-dynamic";

const REVENUECAT_WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET || "";

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
  try {
    const body = await req.json();
    const signature = req.headers.get("x-revenuecat-signature");

    // Verify webhook signature (simplified - in production use proper HMAC verification)
    if (REVENUECAT_WEBHOOK_SECRET && signature !== REVENUECAT_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const { event_type, app_user_id, product_id, expiration_date, entitlement_id } = body;

    if (!app_user_id) {
      return NextResponse.json({ error: "Missing app_user_id" }, { status: 400 });
    }

    // Find user by revenuecat_app_user_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("revenuecat_app_user_id", app_user_id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update subscription status based on event type
    let subscriptionStatus: string | null = null;
    let subscriptionExpiresAt: string | null = null;

    switch (event_type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "PRODUCT_CHANGE":
        subscriptionStatus = "active";
        subscriptionExpiresAt = expiration_date;
        break;
      case "EXPIRATION":
        subscriptionStatus = "expired";
        subscriptionExpiresAt = expiration_date;
        break;
      case "CANCELLATION":
        subscriptionStatus = "cancelled";
        break;
      case "UNCANCELLATION":
        subscriptionStatus = "active";
        break;
      case "REFUND":
        subscriptionStatus = "refunded";
        break;
      default:
        return NextResponse.json({ message: "Event type not handled" }, { status: 200 });
    }

    // Update profile
    await supabase
      .from("profiles")
      .update({
        subscription_status: subscriptionStatus,
        subscription_expires_at: subscriptionExpiresAt,
        subscription_product_id: product_id,
        subscription_entitlement: entitlement_id,
        subscription_updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (subscriptionStatus === "active") {
      await notifySubscriptionSupport({
        platform: "revenuecat",
        eventType: event_type,
        userId: profile.id,
        userEmail: profile.email || null,
        productId: product_id || null,
        planPeriod: null,
        amountTwd: null,
        currency: null,
        expiresAt: subscriptionExpiresAt,
        matchedBy: "revenuecat_app_user_id",
      }).catch((error) => {
        console.warn("[SUBSCRIPTION_NOTIFY] RevenueCat email failed", error instanceof Error ? error.message : String(error));
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("RevenueCat webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
