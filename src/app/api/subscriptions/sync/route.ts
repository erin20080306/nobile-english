import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
  try {
    const body = await req.json();
    const { userId, platform, productId, expiresAt, entitlement, revenuecatAppUserId } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Update profile with subscription data
    await supabase
      .from("profiles")
      .update({
        subscription_platform: platform || null,
        subscription_status: expiresAt && new Date(expiresAt) > new Date() ? "active" : "expired",
        subscription_product_id: productId || null,
        subscription_expires_at: expiresAt || null,
        subscription_entitlement: entitlement || null,
        revenuecat_app_user_id: revenuecatAppUserId || null,
        subscription_updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Subscription sync error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
