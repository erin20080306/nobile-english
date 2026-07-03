/**
 * 一鍵生成並發布今日文章 API
 * POST /api/articles/daily-create
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createDailyArticles,
  isMissingReadingArticleSchema,
} from "@/server/articles/dailyCreate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function readOptionalJson(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function missingEnvResponse(missing: string[]) {
  return NextResponse.json(
    {
      error: `Supabase 環境變數未設定：${missing.join("、")}。請至 Vercel Dashboard → Project → Settings → Environment Variables 新增這些變數後重新部署。`,
      missing,
    },
    { status: 500 }
  );
}

function missingSchemaResponse() {
  return NextResponse.json(
    {
      error:
        "每日文章資料表尚未建立。請先在 Supabase SQL Editor 執行 supabase/migrations/20240629_daily_reading_articles.sql，建立 reading_article_topics 等資料表後再重試。",
      code: "READING_ARTICLE_SCHEMA_MISSING",
    },
    { status: 500 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const missing: string[] = [];
    if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    if (missing.length > 0) return missingEnvResponse(missing);

    const body = await readOptionalJson(request);
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    const result = await createDailyArticles(supabase, {
      publishDate: typeof body.publishDate === "string" ? body.publishDate : undefined,
      prewarm: body.prewarm === true,
      includeAudio: body.includeAudio !== false,
      force: body.force === true,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("daily-create error:", error);
    if (isMissingReadingArticleSchema(error)) return missingSchemaResponse();
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
