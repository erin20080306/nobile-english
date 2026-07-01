import { NextRequest, NextResponse } from "next/server";
import { pickDailyReadingPlan } from "@/server/articles/dailyTopics";
import { fetchDailyNewsHeadline } from "@/server/articles/newsSource";
import { ARTICLE_LANGUAGES, requireCronOrAdmin, taipeiDate } from "@/server/articles/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return runDailyArticleCron(request);
}

export async function POST(request: NextRequest) {
  return runDailyArticleCron(request);
}

async function runDailyArticleCron(request: NextRequest) {
  const unauthorized = requireCronOrAdmin(request);
  if (unauthorized) return unauthorized;

  const publishDate = request.nextUrl.searchParams.get("date") || taipeiDate(1);
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const cronSecret = process.env.CRON_SECRET || process.env.ARTICLE_CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET or ARTICLE_CRON_SECRET is required for internal article cron calls" }, { status: 500 });
  }

  const { topic, difficultyLevel } = pickDailyReadingPlan(publishDate);
  const news = await fetchDailyNewsHeadline(publishDate);

  const generate = await postJson(`${baseUrl}/api/articles/generate`, cronSecret, {
    publishDate,
    topicKey: news ? `news_${publishDate}` : topic.key,
    topicTitleZhTw: news ? news.title : topic.titleZhTw,
    topicCategory: news ? news.category : topic.category,
    difficultyLevel,
    languages: ARTICLE_LANGUAGES,
    newsSummary: news ? `${news.title}. ${news.description}`.trim() : undefined,
    newsSourceUrl: news?.url,
  });

  if (!generate.ok) {
    return NextResponse.json({ error: "Article generation failed", detail: generate.data }, { status: generate.status });
  }

  const articles = Array.isArray(generate.data?.articles) ? generate.data.articles : [];
  if (articles.length !== ARTICLE_LANGUAGES.length) {
    return NextResponse.json({
      error: "Article generation did not return all five languages",
      expected: ARTICLE_LANGUAGES,
      generated: articles.map((article: any) => article?.language_code).filter(Boolean),
      detail: generate.data,
    }, { status: 500 });
  }

  const prewarmResults = [];
  for (const article of articles) {
    const prewarm = await postJson(`${baseUrl}/api/articles/prewarm`, cronSecret, { articleId: article.id });
    prewarmResults.push({ articleId: article.id, languageCode: article.language_code, ok: prewarm.ok, status: prewarm.status, data: prewarm.data });
  }

  const failedPrewarm = prewarmResults.filter((result) => !result.ok || result.data?.success !== true);
  if (failedPrewarm.length > 0) {
    return NextResponse.json({
      error: "Prewarm failed; publish skipped",
      publishDate,
      topicId: generate.data?.topic?.id,
      prewarmResults,
    }, { status: 500 });
  }

  const validation = await postJson(`${baseUrl}/api/articles/publish`, cronSecret, {
    topicId: generate.data?.topic?.id,
    dryRun: true,
  });
  if (!validation.ok) {
    return NextResponse.json({
      error: "Publish validation failed; publish skipped",
      publishDate,
      topicId: generate.data?.topic?.id,
      validation: validation.data,
    }, { status: validation.status });
  }

  const publish = dryRun
    ? validation
    : await postJson(`${baseUrl}/api/articles/publish`, cronSecret, {
        topicId: generate.data?.topic?.id,
      });

  return NextResponse.json({
    success: publish.ok,
    dryRun,
    publishDate,
    topic: generate.data?.topic,
    generatedArticles: articles.length,
    prewarmResults,
    validation: validation.data,
    publish: publish.data,
  }, { status: publish.ok ? 200 : publish.status });
}

async function postJson(url: string, cronSecret: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cronSecret}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: response.ok, status: response.status, data };
}
