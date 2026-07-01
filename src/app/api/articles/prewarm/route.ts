import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  prewarmReadingArticle,
  prewarmReadingArticlesForDate,
} from "@/server/articles/prewarm";

/**
 * 文章預存流程 API
 *
 * POST /api/articles/prewarm
 *
 * Body:
 * {
 *   articleId?: string
 *   publishDate?: string
 *   includeAudio?: boolean
 *   languageCode?: string  // e.g. "ja" — limit to one language to avoid timeouts
 * }
 *
 * 未傳 articleId 時，會預熱今日五語文章（可用 languageCode 限制單一語言，避免逾時）。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function readOptionalJson(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase environment variables not configured" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await readOptionalJson(request);
    const includeAudio = body.includeAudio !== false;

    if (typeof body.articleId === "string" && body.articleId.trim()) {
      const result = await prewarmReadingArticle(supabase, body.articleId.trim(), {
        includeAudio,
      });
      return NextResponse.json({ success: true, ...result });
    }

    const summary = await prewarmReadingArticlesForDate(supabase, {
      publishDate: typeof body.publishDate === "string" ? body.publishDate : undefined,
      includeAudio,
      languageCode: typeof body.languageCode === "string" ? body.languageCode : undefined,
    });
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Article prewarm error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to prewarm article" },
      { status: 500 }
    );
  }
}
