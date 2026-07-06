import { NextResponse } from "next/server";
import { getSupabaseServerClient, missingSupabaseServerEnv } from "@/server/supabaseClient";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "erin20080306@gmail.com";

type PageActivityRow = {
  user_id?: string | null;
  email?: string | null;
  name?: string | null;
  path?: string | null;
  title?: string | null;
  visit_count?: number | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
};

type SessionRow = {
  user_id?: string | null;
  email?: string | null;
  name?: string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
};

type PromoTrialRedemptionRow = {
  id?: string | null;
  promo_code?: string | null;
  user_id?: string | null;
  user_email?: string | null;
  status?: string | null;
  starts_at?: string | null;
  expires_at?: string | null;
  trial_days?: number | null;
  max_feature_uses?: number | null;
  redeemed_slot?: number | null;
  created_at?: string | null;
};

type PromoTrialUsageRow = {
  user_id?: string | null;
  feature_key?: string | null;
  used_count?: number | null;
  usage_date?: string | null;
};

function earlier(a?: string | null, b?: string | null): string | null {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

function later(a?: string | null, b?: string | null): string | null {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function taipeiDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildGoogleActivity(sessions: SessionRow[], pageRows: PageActivityRow[]) {
  const users = new Map<
    string,
    {
      userId: string;
      email: string;
      name: string | null;
      firstSeenAt: string | null;
      lastSeenAt: string | null;
      totalPageVisits: number;
      pages: Array<{
        path: string;
        title: string | null;
        visitCount: number;
        firstSeenAt: string | null;
        lastSeenAt: string | null;
      }>;
    }
  >();

  sessions.forEach((row) => {
    const email = String(row.email || "").trim().toLowerCase();
    if (!email || email === ADMIN_EMAIL) return;
    const userId = String(row.user_id || email);
    users.set(email, {
      userId,
      email,
      name: row.name || null,
      firstSeenAt: row.first_seen_at || null,
      lastSeenAt: row.last_seen_at || null,
      totalPageVisits: 0,
      pages: [],
    });
  });

  pageRows.forEach((row) => {
    const email = String(row.email || "").trim().toLowerCase();
    const path = String(row.path || "").trim();
    if (!email || email === ADMIN_EMAIL || !path) return;
    const existing = users.get(email);
    const user = existing || {
      userId: String(row.user_id || email),
      email,
      name: row.name || null,
      firstSeenAt: row.first_seen_at || null,
      lastSeenAt: row.last_seen_at || null,
      totalPageVisits: 0,
      pages: [],
    };
    const visitCount = Math.max(0, Number(row.visit_count || 0));
    user.name = user.name || row.name || null;
    user.firstSeenAt = earlier(user.firstSeenAt, row.first_seen_at || null);
    user.lastSeenAt = later(user.lastSeenAt, row.last_seen_at || null);
    user.totalPageVisits += visitCount;
    user.pages.push({
      path,
      title: row.title || null,
      visitCount,
      firstSeenAt: row.first_seen_at || null,
      lastSeenAt: row.last_seen_at || null,
    });
    users.set(email, user);
  });

  return Array.from(users.values())
    .map((user) => ({
      ...user,
      pages: user.pages
        .sort((a, b) => (b.lastSeenAt || "").localeCompare(a.lastSeenAt || ""))
        .slice(0, 8),
    }))
    .sort((a, b) => (b.lastSeenAt || "").localeCompare(a.lastSeenAt || ""))
    .slice(0, 20);
}

function buildPromoTrialStats(
  redemptions: PromoTrialRedemptionRow[],
  usageRows: PromoTrialUsageRow[],
  error?: string
) {
  const usageByUser = new Map<
    string,
    {
      totalToday: number;
      features: Array<{ featureKey: string; usedCount: number }>;
    }
  >();

  usageRows.forEach((row) => {
    const userId = String(row.user_id || "").trim();
    const featureKey = String(row.feature_key || "").trim();
    if (!userId || !featureKey) return;
    const usedCount = Math.max(0, Number(row.used_count || 0));
    const userUsage = usageByUser.get(userId) || { totalToday: 0, features: [] };
    userUsage.totalToday += usedCount;
    userUsage.features.push({ featureKey, usedCount });
    usageByUser.set(userId, userUsage);
  });

  const now = Date.now();
  const mapped = redemptions.map((row) => {
    const userId = String(row.user_id || "").trim();
    const expiresAt = row.expires_at || null;
    const expiresTime = expiresAt ? new Date(expiresAt).getTime() : 0;
    const remainingMs = expiresTime - now;
    const usage = usageByUser.get(userId) || { totalToday: 0, features: [] };
    return {
      id: String(row.id || userId || row.user_email || ""),
      promoCode: String(row.promo_code || ""),
      userId,
      userEmail: String(row.user_email || "").trim().toLowerCase(),
      status: String(row.status || "unknown"),
      startsAt: row.starts_at || null,
      expiresAt,
      trialDays: Number(row.trial_days || 30),
      maxFeatureUses: Number(row.max_feature_uses || 20),
      redeemedSlot: Number(row.redeemed_slot || 0),
      createdAt: row.created_at || null,
      daysLeft: Math.max(0, Math.ceil(remainingMs / 86400000)),
      isActive: row.status === "active" && remainingMs > 0,
      todayUsage: {
        total: usage.totalToday,
        features: usage.features.sort((a, b) => b.usedCount - a.usedCount),
      },
    };
  });

  return {
    available: !error,
    error,
    total: mapped.length,
    active: mapped.filter((row) => row.isActive).length,
    expired: mapped.filter((row) => row.status === "expired" || (!row.isActive && row.status === "active")).length,
    redemptions: mapped,
  };
}

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
    const todayTaipei = taipeiDateKey(new Date());

    const [
      totalUsers,
      activeToday,
      activeThirtyDays,
      profileSubscribers,
      paypalSubscribers,
      cloudSyncRows,
      cloudSyncUsers,
      latestCloudSync,
      learningRecordTypeRows,
      googleSessions,
      googlePageActivity,
      promoRedemptions,
      promoUsageToday,
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
      supabase.from("learning_records").select("type").limit(20000),
      supabase
        .from("app_user_sessions")
        .select("user_id, email, name, first_seen_at, last_seen_at")
        .eq("provider", "google")
        .neq("email", ADMIN_EMAIL)
        .order("last_seen_at", { ascending: false })
        .limit(100),
      supabase
        .from("app_user_page_activity")
        .select("user_id, email, name, path, title, visit_count, first_seen_at, last_seen_at")
        .eq("provider", "google")
        .neq("email", ADMIN_EMAIL)
        .order("last_seen_at", { ascending: false })
        .limit(500),
      supabase
        .from("promo_trial_redemptions")
        .select(
          "id, promo_code, user_id, user_email, status, starts_at, expires_at, trial_days, max_feature_uses, redeemed_slot, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("promo_trial_feature_usage")
        .select("user_id, feature_key, used_count, usage_date")
        .eq("usage_date", todayTaipei)
        .limit(1000),
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
      learningRecordTypeRows.error,
      googleSessions.error,
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
    const learningRecordsByType = new Map<string, number>();
    (learningRecordTypeRows.data || []).forEach((row) => {
      const type = String(row.type || "unknown");
      learningRecordsByType.set(type, (learningRecordsByType.get(type) || 0) + 1);
    });
    const learningRecordTypeList = Array.from(learningRecordsByType.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    const learningRecordTotal = learningRecordTypeList.reduce((sum, item) => sum + item.count, 0);
    const promoTrialError = promoRedemptions.error?.message || promoUsageToday.error?.message;
    const promoTrialStats = buildPromoTrialStats(
      promoRedemptions.error ? [] : ((promoRedemptions.data || []) as PromoTrialRedemptionRow[]),
      promoUsageToday.error ? [] : ((promoUsageToday.data || []) as PromoTrialUsageRow[]),
      promoTrialError
    );

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
      promoTrials: promoTrialStats,
      cloudSync: {
        users: cloudSyncUserKeys.size,
        dataRows: cloudSyncRows.count ?? 0,
        learningRecords: learningRecordTotal,
        learningRecordsByType: learningRecordTypeList,
        latestUpdatedAt: latestCloudSync.data?.updated_at ?? null,
      },
      googleActivity: {
        users: buildGoogleActivity(
          (googleSessions.data || []) as SessionRow[],
          googlePageActivity.error ? [] : ((googlePageActivity.data || []) as PageActivityRow[])
        ),
        pageActivityAvailable: !googlePageActivity.error,
        error: googlePageActivity.error?.message,
      },
    });
  } catch (error) {
    console.error("Admin subscription stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
