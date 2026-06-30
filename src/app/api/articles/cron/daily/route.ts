import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createDailyArticles,
  isMissingReadingArticleSchema,
} from "@/server/articles/dailyCreate";
import { getTaipeiDateString } from "@/server/articles/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const expectedSecret = process.env.CRON_SECRET?.trim();
  if (!expectedSecret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${expectedSecret}`;
}

function missingSchemaResponse() {
  return NextResponse.json(
    {
      error:
        "每日文章資料表尚未建立。請先在 Supabase SQL Editor 執行 daily reading articles migration。",
      code: "READING_ARTICLE_SCHEMA_MISSING",
    },
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { error: "Unauthorized cron request. Set CRON_SECRET in Vercel Production." },
      { status: 401 }
    );
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        {
          error: "Supabase environment variables not configured",
          missing: {
            NEXT_PUBLIC_SUPABASE_URL: !supabaseUrl,
            SUPABASE_SERVICE_ROLE_KEY: !supabaseServiceKey,
          },
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const result = await createDailyArticles(supabase, {
      publishDate: getTaipeiDateString(),
      prewarm: true,
      includeAudio: true,
    });

    return NextResponse.json({
      ...result,
      cron: true,
    });
  } catch (error) {
    console.error("daily article cron error:", error);
    if (isMissingReadingArticleSchema(error)) return missingSchemaResponse();
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
