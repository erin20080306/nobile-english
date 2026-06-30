/**
 * Creates tomorrow's shared five-language reading article. Run this from a
 * trusted scheduler; it never generates per-user content.
 */

const DAILY_TOPICS = [
  { key: "ordering_coffee", title: "在咖啡店點餐", category: "daily_life" },
  { key: "first_meeting", title: "第一次參加公司會議", category: "work" },
  { key: "weekend_trip", title: "週末旅行計畫", category: "travel" },
  { key: "supermarket", title: "超市購物", category: "daily_life" },
  { key: "birthday_party", title: "朋友生日聚會", category: "social" },
  { key: "weather_clothing", title: "天氣與穿搭", category: "daily_life" },
  { key: "taking_leave", title: "工作請假", category: "work" },
  { key: "healthy_habits", title: "健康生活習慣", category: "health" },
  { key: "hotel_checkin", title: "飯店入住", category: "travel" },
  { key: "online_shopping", title: "線上購物", category: "daily_life" },
  { key: "job_interview", title: "面試準備", category: "work" },
  { key: "daily_commute", title: "日常通勤", category: "daily_life" },
] as const;

const LANGUAGES = ["en", "ja", "ko", "it", "es"] as const;
const DIFFICULTIES = ["A1", "A2", "B1"] as const;

function taipeiDate(offsetDays: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = Number(values.get("year"));
  const month = Number(values.get("month"));
  const day = Number(values.get("day"));
  return new Date(Date.UTC(year, month - 1, day + offsetDays, 12)).toISOString().slice(0, 10);
}

function indexForDate(date: string, length: number): number {
  const [year, month, day] = date.split("-").map(Number);
  const ordinal = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  return Math.abs(ordinal) % length;
}

async function post(baseUrl: string, path: string, secret: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": secret },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${JSON.stringify(json)}`);
  return json as Record<string, unknown>;
}

async function main() {
  const baseUrl = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET || "";
  if (!baseUrl) throw new Error("APP_BASE_URL is required");
  if (!secret && process.env.NODE_ENV === "production") throw new Error("CRON_SECRET is required in production");

  const publishDate = taipeiDate(1);
  const topic = DAILY_TOPICS[indexForDate(publishDate, DAILY_TOPICS.length)];
  const difficultyLevel = DIFFICULTIES[indexForDate(publishDate, DIFFICULTIES.length)];
  console.log(`Preparing ${publishDate}: ${topic.key} (${difficultyLevel})`);

  const generated = await post(baseUrl, "/api/articles/generate", secret, {
    publishDate,
    topicKey: topic.key,
    topicTitleZhTw: topic.title,
    topicCategory: topic.category,
    difficultyLevel,
    languages: LANGUAGES,
  });

  const articles = Array.isArray(generated.articles) ? generated.articles as Array<{ id: string; language_code: string }> : [];
  if (articles.length !== LANGUAGES.length) throw new Error("Generation did not return all five articles");

  for (const article of articles) {
    const result = await post(baseUrl, "/api/articles/prewarm", secret, { articleId: article.id });
    if (result.articleReady !== true) throw new Error(`Prewarm did not make ${article.language_code} ready`);
  }

  const topicRecord = generated.topic as { id?: string } | undefined;
  if (!topicRecord?.id) throw new Error("Generation did not return a topic id");
  await post(baseUrl, "/api/articles/publish", secret, { topicId: topicRecord.id });
  console.log(`Published daily reading articles for ${publishDate}`);
}

main().catch((error) => {
  console.error("Daily article cron failed", error);
  process.exit(1);
});
