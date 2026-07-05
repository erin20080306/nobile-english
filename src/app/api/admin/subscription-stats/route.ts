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
      learningRecordTypeRows,
      googleSessions,
      googlePageActivity,
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
        learningRecordsByType: Array.from(learningRecordsByType.entries())
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count),
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
