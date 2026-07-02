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
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    // Authenticate user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const userId = authData.user.id;

    // Delete user data from profiles
    await supabase.from("profiles").delete().eq("id", userId);

    // Delete learning records (if table exists)
    try {
      await supabase.from("learning_records").delete().eq("user_id", userId);
    } catch {
      // Table might not exist, ignore
    }

    // Delete saved words (if table exists)
    try {
      await supabase.from("saved_words").delete().eq("user_id", userId);
    } catch {
      // Table might not exist, ignore
    }

    // Delete saved sentences (if table exists)
    try {
      await supabase.from("saved_sentences").delete().eq("user_id", userId);
    } catch {
      // Table might not exist, ignore
    }

    // Delete cloud-synced app data (settings, saved words, stats, etc.)
    try {
      await supabase.from("user_app_data").delete().eq("user_id", userId);
    } catch {
      // Table might not exist, ignore
    }

    // Delete user from auth
    await supabase.auth.admin.deleteUser(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
