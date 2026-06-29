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
    const { identityToken, user, email, name } = body;

    if (!identityToken) {
      return NextResponse.json({ error: "Missing identityToken" }, { status: 400 });
    }

    // In production, verify the identityToken with Apple's public key
    // For now, we'll trust the token and create/update the user
    // TODO: Implement proper Apple token verification using node-apple-signin or similar

    // Check if user exists by Apple ID
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .single();

    if (existingUser) {
      // User exists, return user data
      return NextResponse.json({
        user: existingUser,
        onboarded: true,
      });
    }

    // Create new user with auth
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: email || "",
      password: Math.random().toString(36).slice(-10), // Random password for Apple users
      options: {
        data: {
          name: name || "Apple User",
          provider: "apple",
        },
      },
    });

    if (signUpError) {
      console.error("Apple sign up error:", signUpError);
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    // Create profile
    if (authData.user) {
      await supabase.from("profiles").insert({
        id: authData.user.id,
        email: email || "",
        name: name || "Apple User",
        provider: "apple",
        created_at: new Date().toISOString(),
      });

      return NextResponse.json({
        user: authData.user,
        onboarded: false,
      });
    }

    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  } catch (error) {
    console.error("Apple auth error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
