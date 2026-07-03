// Fetches a real, current news headline to use as source material for the
// daily reading article. If GNEWS_API_KEY is missing or the request fails,
// callers should fall back to the fixed evergreen topic pool.

import { incrementApiUsage } from "@/server/apiUsage";

export interface NewsHeadline {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  category: string;
}

interface GNewsArticle {
  title?: string;
  description?: string;
  content?: string;
  url?: string;
  publishedAt?: string;
}

interface GNewsResponse {
  totalArticles?: number;
  articles?: GNewsArticle[];
}

const NEWS_CATEGORIES = ["world", "nation", "business", "technology", "science", "health"];
const NEWS_SEARCH_QUERIES: Record<string, string> = {
  world: "world OR climate OR diplomacy",
  nation: "education OR transport OR community",
  business: "business OR economy OR jobs",
  technology: "technology OR science OR AI",
  science: "science OR space OR environment",
  health: "health OR research OR wellness",
};

// Deterministic per-day category rotation so the topic pool feels varied
// without needing extra state.
function categoryForDate(publishDate: string): string {
  const day = Number(publishDate.slice(-2)) || new Date().getDate();
  return NEWS_CATEGORIES[day % NEWS_CATEGORIES.length];
}

function daySeed(publishDate: string): number {
  return publishDate
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function taipeiDateRangeUtc(publishDate: string): { from: string; to: string } {
  const start = new Date(`${publishDate}T00:00:00+08:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

async function fetchGNews(
  endpoint: "search" | "top-headlines",
  params: Record<string, string>,
  apiKey: string
): Promise<GNewsArticle[]> {
  const search = new URLSearchParams({
    lang: "en",
    max: "10",
    ...params,
    apikey: apiKey,
  });
  const url = `https://gnews.io/api/v4/${endpoint}?${search.toString()}`;
  void incrementApiUsage(`gnews:${endpoint}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];

  const data = (await res.json()) as GNewsResponse;
  return data.articles || [];
}

function pickArticle(articles: GNewsArticle[], publishDate: string): GNewsArticle | null {
  const usable = articles.filter((article) => article.title && (article.description || "").length > 40);
  if (!usable.length) return articles.find((article) => article.title) || null;
  return usable[daySeed(publishDate) % usable.length] || usable[0];
}

export async function fetchDailyNewsHeadline(publishDate: string): Promise<NewsHeadline | null> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) return null;

  const category = categoryForDate(publishDate);
  const { from, to } = taipeiDateRangeUtc(publishDate);

  try {
    const searchArticles = await fetchGNews(
      "search",
      {
        q: NEWS_SEARCH_QUERIES[category] || category,
        in: "title,description",
        from,
        to,
        sortby: "publishedAt",
      },
      apiKey
    );
    const headlineArticles = searchArticles.length
      ? searchArticles
      : await fetchGNews("top-headlines", { category, from, to }, apiKey);
    const candidate = pickArticle(headlineArticles, publishDate);

    if (!candidate?.title) return null;

    return {
      title: candidate.title.trim(),
      description: (candidate.description || "").trim(),
      url: candidate.url || "",
      publishedAt: candidate.publishedAt || new Date().toISOString(),
      category,
    };
  } catch (error) {
    console.warn("[NEWS_SOURCE] GNews fetch failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
