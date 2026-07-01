// Fetches a real, current news headline to use as source material for the
// daily reading article. If GNEWS_API_KEY is missing or the request fails,
// callers should fall back to the fixed evergreen topic pool.

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

// Deterministic per-day category rotation so the topic pool feels varied
// without needing extra state.
function categoryForDate(publishDate: string): string {
  const day = Number(publishDate.slice(-2)) || new Date().getDate();
  return NEWS_CATEGORIES[day % NEWS_CATEGORIES.length];
}

export async function fetchDailyNewsHeadline(publishDate: string): Promise<NewsHeadline | null> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) return null;

  const category = categoryForDate(publishDate);

  try {
    const url = `https://gnews.io/api/v4/top-headlines?category=${category}&lang=en&max=8&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;

    const data = (await res.json()) as GNewsResponse;
    const articles = data.articles || [];
    if (!articles.length) return null;

    // Prefer an article with a substantial description (better source material
    // for the AI to rewrite); avoid ones that are too short or missing fields.
    const candidate =
      articles.find((a) => (a.description || "").length > 60 && a.title) || articles[0];

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
