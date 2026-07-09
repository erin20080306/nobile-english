import { NextResponse } from "next/server";

export async function GET() {
  const vars = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY: !!(
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY
    ),
    GOOGLE_TTS_API_KEY: !!process.env.GOOGLE_TTS_API_KEY,
    GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON: !!process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON,
    AWS_ACCESS_KEY_ID: !!process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: !!process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: !!process.env.AWS_REGION,
    GNEWS_API_KEY: !!process.env.GNEWS_API_KEY,
    KOREAN_DICTIONARY_API_KEY: !!process.env.KOREAN_DICTIONARY_API_KEY,
    PAYPAL_ENV: !!process.env.PAYPAL_ENV,
    PAYPAL_CLIENT_ID: !!process.env.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET: !!process.env.PAYPAL_CLIENT_SECRET,
    PAYPAL_WEBHOOK_ID: !!process.env.PAYPAL_WEBHOOK_ID,
  };
  const supabaseOk = vars.NEXT_PUBLIC_SUPABASE_URL && vars.NEXT_PUBLIC_SUPABASE_ANON_KEY && vars.SUPABASE_SERVICE_ROLE_KEY;
  const geminiTtsOk = vars.GEMINI_API_KEY;
  const googleTtsOk = vars.GOOGLE_TTS_API_KEY || vars.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON;
  const pollyTtsOk = vars.AWS_ACCESS_KEY_ID && vars.AWS_SECRET_ACCESS_KEY;
  return NextResponse.json({
    ok: Boolean(supabaseOk && (geminiTtsOk || googleTtsOk || pollyTtsOk)),
    vars,
    ttsProvider: geminiTtsOk ? "gemini" : googleTtsOk ? "google" : pollyTtsOk ? "polly" : "not_configured",
  });
}
