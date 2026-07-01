#!/usr/bin/env node

const LANGUAGES = ["en", "ja", "ko", "it", "es"];
const TOPICS = [
  { key: "ordering_coffee", titleZhTw: "在咖啡店點餐", category: "daily_life" },
  { key: "first_meeting", titleZhTw: "第一次參加公司會議", category: "work" },
  { key: "weekend_trip", titleZhTw: "週末旅行計畫", category: "travel" },
  { key: "supermarket", titleZhTw: "超市購物", category: "daily_life" },
  { key: "birthday_party", titleZhTw: "朋友生日聚會", category: "social" },
  { key: "weather_clothing", titleZhTw: "天氣與穿搭", category: "daily_life" },
  { key: "taking_leave", titleZhTw: "工作請假", category: "work" },
  { key: "healthy_habits", titleZhTw: "健康生活習慣", category: "health" },
  { key: "hotel_checkin", titleZhTw: "飯店入住", category: "travel" },
  { key: "online_shopping", titleZhTw: "線上購物", category: "daily_life" },
  { key: "job_interview", titleZhTw: "面試準備", category: "work" },
  { key: "daily_commute", titleZhTw: "日常通勤", category: "daily_life" },
];
const DIFFICULTIES = ["A1", "A2", "B1"];

const [command = "help", ...rawArgs] = process.argv.slice(2);
const args = parseArgs(rawArgs);
const baseUrl = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const cronSecret = process.env.CRON_SECRET || process.env.ARTICLE_CRON_SECRET;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  if (command === "help" || args.help) {
    printHelp();
    return;
  }
  if (!cronSecret) {
    throw new Error("CRON_SECRET or ARTICLE_CRON_SECRET is required.");
  }

  if (command === "cron") {
    const date = args.date ? `?date=${encodeURIComponent(args.date)}` : "";
    const dryRun = args["dry-run"] ? `${date ? "&" : "?"}dryRun=1` : "";
    await request("GET", `/api/articles/cron${date}${dryRun}`);
    return;
  }

  if (command === "generate") {
    const publishDate = args.date || taipeiDate(1);
    const plan = pickPlan(publishDate);
    const body = {
      publishDate,
      topicKey: args["topic-key"] || plan.topic.key,
      topicTitleZhTw: args["topic-title"] || plan.topic.titleZhTw,
      topicCategory: args["topic-category"] || plan.topic.category,
      difficultyLevel: args.difficulty || plan.difficultyLevel,
      languages: args.languages ? String(args.languages).split(",").map((item) => item.trim()).filter(Boolean) : LANGUAGES,
    };
    if (args["dry-run"]) {
      console.log(JSON.stringify({ dryRun: true, command: "generate", body }, null, 2));
      return;
    }
    if (!args.confirm) throw new Error("reading:generate requires --confirm, or use --dry-run.");
    await request("POST", "/api/articles/generate", body);
    return;
  }

  if (command === "prewarm") {
    const articleIds = String(args["article-id"] || args["article-ids"] || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const body = articleIds.length > 0
      ? { articleIds }
      : { publishDate: args.date, topicId: args["topic-id"] };
    if (!body.publishDate && !body.topicId && articleIds.length === 0) {
      throw new Error("reading:prewarm requires --date=YYYY-MM-DD, --topic-id=<id>, or --article-id=<id>.");
    }
    if (args["dry-run"]) {
      console.log(JSON.stringify({ dryRun: true, command: "prewarm", body }, null, 2));
      return;
    }
    if (!args.confirm) throw new Error("reading:prewarm requires --confirm, or use --dry-run.");
    for (const articleId of articleIds) {
      await request("POST", "/api/articles/prewarm", { articleId });
    }
    if (articleIds.length === 0) {
      await request("POST", "/api/articles/prewarm", body);
    }
    return;
  }

  if (command === "validate") {
    await request("POST", "/api/articles/publish", {
      topicId: args["topic-id"],
      publishDate: args.date,
      dryRun: true,
    });
    return;
  }

  if (command === "publish") {
    if (!args.confirm) throw new Error("reading:publish requires --confirm.");
    await request("POST", "/api/articles/publish", {
      topicId: args["topic-id"],
      publishDate: args.date,
    });
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cronSecret}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  console.log(JSON.stringify({ ok: response.ok, status: response.status, path, data }, null, 2));
  if (!response.ok) process.exit(1);
  return data;
}

function parseArgs(items) {
  const parsed = {};
  for (const item of items) {
    if (!item.startsWith("--")) continue;
    const [key, ...valueParts] = item.slice(2).split("=");
    parsed[key] = valueParts.length > 0 ? valueParts.join("=") : true;
  }
  return parsed;
}

function taipeiDate(offsetDays = 0) {
  const now = new Date();
  const taipei = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  taipei.setDate(taipei.getDate() + offsetDays);
  return `${taipei.getFullYear()}-${String(taipei.getMonth() + 1).padStart(2, "0")}-${String(taipei.getDate()).padStart(2, "0")}`;
}

function pickPlan(publishDate) {
  const day = Number(String(publishDate).slice(-2)) || new Date().getDate();
  return {
    topic: TOPICS[day % TOPICS.length],
    difficultyLevel: DIFFICULTIES[day % DIFFICULTIES.length],
  };
}

function printHelp() {
  console.log(`Daily reading article CLI

Environment:
  APP_BASE_URL or NEXT_PUBLIC_APP_URL
  CRON_SECRET or ARTICLE_CRON_SECRET

Commands:
  node scripts/reading-article-cli.mjs generate --date=YYYY-MM-DD
  node scripts/reading-article-cli.mjs prewarm --article-id=<id>
  node scripts/reading-article-cli.mjs validate --date=YYYY-MM-DD
  node scripts/reading-article-cli.mjs publish --date=YYYY-MM-DD --confirm
  node scripts/reading-article-cli.mjs cron --date=YYYY-MM-DD --dry-run
`);
}
