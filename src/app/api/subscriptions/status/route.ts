import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "subscription_platform, subscription_status, subscription_product_id, subscription_expires_at, subscription_entitlement"
      )
      .eq("id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if subscription is active
    const isActive =
      profile.subscription_status === "active" &&
      profile.subscription_expires_at &&
      new Date(profile.subscription_expires_at) > new Date();

    return NextResponse.json({
      isActive,
      platform: profile.subscription_platform,
      status: profile.subscription_status,
      productId: profile.subscription_product_id,
      expiresAt: profile.subscription_expires_at,
      entitlement: profile.subscription_entitlement,
    });
  } catch (error) {
    console.error("Subscription status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
