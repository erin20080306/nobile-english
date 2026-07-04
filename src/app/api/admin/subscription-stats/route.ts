import { NextResponse } from "next/server";
import { getSupabaseServerClient, missingSupabaseServerEnv } from "@/server/supabaseClient";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing Supabase server env", missing: missingSupabaseServerEnv() },
      { status: 500 }
    );
  }

  try {
    const now = new Date().toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      totalUsers,
      activeToday,
      activeThirtyDays,
      profileSubscribers,
      paypalSubscribers,
      cloudSyncRows,
      cloudSyncUsers,
      latestCloudSync,
      learningRecordRows,
    ] =
      await Promise.all([
      supabase.from("app_user_sessions").select("user_id", { count: "exact", head: true }),
      supabase
        .from("app_user_sessions")
        .select("user_id", { count: "exact", head: true })
        .gte("last_seen_at", dayAgo),
      supabase
        .from("app_user_sessions")
        .select("user_id", { count: "exact", head: true })
        .gte("last_seen_at", thirtyDaysAgo),
      supabase
        .from("profiles")
        .select("id, email")
        .eq("subscription_status", "active")
        .neq("subscription_platform", "paypal")
        .gt("subscription_expires_at", now),
      supabase
        .from("paypal_subscription_payments")
        .select("id, user_id, user_email, payer_email")
        .eq("status", "active")
        .gt("expires_at", now),
      supabase.from("user_app_data").select("user_id", { count: "exact", head: true }),
      supabase.from("user_app_data").select("user_id").limit(10000),
      supabase
        .from("user_app_data")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("learning_records").select("id", { count: "exact", head: true }),
    ]);

    const errors = [
      totalUsers.error,
      activeToday.error,
      activeThirtyDays.error,
      profileSubscribers.error,
      paypalSubscribers.error,
      cloudSyncRows.error,
      cloudSyncUsers.error,
      latestCloudSync.error,
      learningRecordRows.error,
    ].filter(Boolean);
    if (errors.length) throw errors[0];

    const storeSubscriberKeys = new Set(
      (profileSubscribers.data || []).map((row) => String(row.id || row.email || "").toLowerCase()).filter(Boolean)
    );
    const paypalSubscriberKeys = new Set(
      (paypalSubscribers.data || [])
        .map((row) => String(row.user_id || row.user_email || row.payer_email || row.id || "").toLowerCase())
        .filter(Boolean)
    );
    const cloudSyncUserKeys = new Set<string>();
    (cloudSyncUsers.data || []).forEach((row) => {
      const userId = String(row.user_id || "").trim();
      if (userId) cloudSyncUserKeys.add(userId);
    });

    return NextResponse.json({
      appUsers: {
        total: totalUsers.count ?? 0,
        activeToday: activeToday.count ?? 0,
        activeThirtyDays: activeThirtyDays.count ?? 0,
      },
      subscribers: {
        total: storeSubscriberKeys.size + paypalSubscriberKeys.size,
        storeOrProfile: storeSubscriberKeys.size,
        paypal: paypalSubscriberKeys.size,
      },
      cloudSync: {
        users: cloudSyncUserKeys.size,
        dataRows: cloudSyncRows.count ?? 0,
        learningRecords: learningRecordRows.count ?? 0,
        latestUpdatedAt: latestCloudSync.data?.updated_at ?? null,
      },
    });
  } catch (error) {
    console.error("Admin subscription stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
