import type { SupabaseClient } from "@supabase/supabase-js";
import { getDatedTopicKey, getDayOfYearFromDateString, getTaipeiDateString } from "./dates";
import { prewarmReadingArticle, type ArticlePrewarmResult } from "./prewarm";
import { generateJsonWithGemini, hasGeminiConfig } from "../gemini";
import { fetchDailyNewsHeadline, type NewsHeadline } from "./newsSource";

const TOPICS = [
  { key: "coffee_shop", zhTw: "咖啡店點餐", category: "daily_life" },
  { key: "airport_checkin", zhTw: "機場報到", category: "travel" },
  { key: "job_interview", zhTw: "求職面試", category: "work" },
  { key: "restaurant_order", zhTw: "餐廳點餐", category: "daily_life" },
  { key: "shopping_mall", zhTw: "購物中心", category: "shopping" },
  { key: "making_friends", zhTw: "認識新朋友", category: "social" },
  { key: "gym_workout", zhTw: "健身房運動", category: "health" },
  { key: "hotel_checkin", zhTw: "飯店入住", category: "travel" },
  { key: "doctor_visit", zhTw: "看診就醫", category: "health" },
  { key: "movie_theater", zhTw: "看電影", category: "entertainment" },
  { key: "public_transport", zhTw: "搭大眾運輸", category: "daily_life" },
  { key: "cooking_at_home", zhTw: "在家料理", category: "daily_life" },
  { key: "weekend_plans", zhTw: "週末計劃", category: "social" },
  { key: "technology_life", zhTw: "科技生活", category: "tech" },
  { key: "travel_abroad", zhTw: "出國旅行", category: "travel" },
  { key: "campus_life", zhTw: "校園生活", category: "education" },
  { key: "work_meeting", zhTw: "工作會議", category: "work" },
  { key: "bank_service", zhTw: "銀行業務", category: "finance" },
  { key: "pets_care", zhTw: "照顧寵物", category: "daily_life" },
  { key: "healthy_eating", zhTw: "健康飲食", category: "health" },
  { key: "social_media", zhTw: "社群媒體", category: "tech" },
  { key: "music_sharing", zhTw: "分享音樂", category: "entertainment" },
  { key: "sports_talk", zhTw: "運動話題", category: "sports" },
  { key: "food_culture", zhTw: "飲食文化", category: "culture" },
  { key: "seasons_weather", zhTw: "四季天氣", category: "daily_life" },
  { key: "career_advice", zhTw: "職涯建議", category: "work" },
  { key: "family_gathering", zhTw: "家庭聚會", category: "daily_life" },
  { key: "travel_tips", zhTw: "旅遊小技巧", category: "travel" },
  { key: "bookstore_visit", zhTw: "逛書店", category: "education" },
  { key: "volunteer_work", zhTw: "志工服務", category: "society" },
];

const LANG_NAMES: Record<string, string> = {
  en: "English",
  ja: "Japanese",
  ko: "Korean",
  it: "Italian",
  es: "Spanish",
};

const LANGUAGES = ["en", "ja", "ko", "it", "es"] as const;

interface ArticleContent {
  title: string;
  titleZhTw: string;
  articleText: string;
  sentences: Array<{ order: number; text: string; zhTw: string }>;
  questions: Array<{
    type: string;
    question: string;
    options: string[];
    answer: string;
    explanationZhTw: string;
  }>;
}

export interface DailyArticleCreateResult {
  success: boolean;
  skipped?: boolean;
  forced?: boolean;
  date: string;
  topic: string;
  topicId?: string;
  articlesCreated: number;
  results: Array<{ lang: string; success: boolean; articleId?: string; title?: string; error?: string }>;
  prewarm?: {
    requested: boolean;
    results: ArticlePrewarmResult[];
  };
}

export function isMissingReadingArticleSchema(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === "PGRST205" ||
    maybeError.code === "42P01" ||
    Boolean(maybeError.message?.includes("reading_article_topics")) ||
    Boolean(maybeError.message?.includes("schema cache"))
  );
}

function estimateReadingSeconds(text: string, languageCode: string): number {
  if (languageCode === "ja" || languageCode === "ko") {
    return Math.max(45, Math.ceil((Array.from(text).length / 350) * 60));
  }
  return Math.max(45, Math.ceil((text.split(/\s+/).filter(Boolean).length / 200) * 60));
}

function estimateSentenceDurationMs(text: string, languageCode: string): number {
  if (languageCode === "ja" || languageCode === "ko") {
    return Math.max(1800, Math.ceil((Array.from(text).length / 280) * 60 * 1000));
  }
  return Math.max(1800, Math.ceil((text.split(/\s+/).filter(Boolean).length / 150) * 60 * 1000));
}

async function prewarmCreatedArticles(
  supabase: SupabaseClient,
  articleIds: string[],
  includeAudio: boolean
): Promise<ArticlePrewarmResult[]> {
  const results: ArticlePrewarmResult[] = [];
  for (const articleId of articleIds) {
    try {
      results.push(await prewarmReadingArticle(supabase, articleId, { includeAudio }));
    } catch (error) {
      results.push({
        articleId,
        languageCode: "en",
        lexemeLinksCreated: 0,
        audioCreated: 0,
        audioCached: 0,
        audioFailed: 1,
        statusUpdated: false,
      });
      console.warn("article prewarm failed:", error);
    }
  }
  return results;
}

export async function createDailyArticles(
  supabase: SupabaseClient,
  options: { publishDate?: string; prewarm?: boolean; includeAudio?: boolean; force?: boolean } = {}
): Promise<DailyArticleCreateResult> {
  const publishDate = options.publishDate || getTaipeiDateString();
  const shouldPrewarm = options.prewarm ?? false;
  const includeAudio = options.includeAudio ?? true;
  const force = options.force ?? false;

  const { data: existingTopic, error: existingTopicError } = await supabase
    .from("reading_article_topics")
    .select("id, status, topic_title_zh_tw")
    .eq("publish_date", publishDate)
    .eq("status", "published")
    .maybeSingle();

  if (existingTopicError && isMissingReadingArticleSchema(existingTopicError)) {
    throw existingTopicError;
  }

  if (existingTopic && !force) {
    let prewarm: DailyArticleCreateResult["prewarm"];
    if (shouldPrewarm) {
      const { data: existingArticles } = await supabase
        .from("reading_articles")
        .select("id")
        .eq("topic_id", existingTopic.id);
      const articleIds = (existingArticles || []).map((article) => article.id as string);
      prewarm = {
        requested: true,
        results: await prewarmCreatedArticles(supabase, articleIds, includeAudio),
      };
    }
    return {
      success: true,
      skipped: true,
      date: publishDate,
      topic: (existingTopic.topic_title_zh_tw as string | undefined) || "今日文章",
      topicId: existingTopic.id as string,
      articlesCreated: 0,
      results: [],
      prewarm,
    };
  }

  const newsHeadline = await fetchDailyNewsHeadline(publishDate);
  const dayOfYear = getDayOfYearFromDateString(publishDate);
  const topic = newsHeadline
    ? { key: `news_${newsHeadline.category}`, zhTw: newsHeadline.title, category: newsHeadline.category }
    : TOPICS[dayOfYear % TOPICS.length];
  const topicKey = getDatedTopicKey(topic.key, publishDate);

  await supabase.from("reading_article_topics").delete().eq("publish_date", publishDate);

  const { data: topicData, error: topicError } = await supabase
    .from("reading_article_topics")
    .insert({
      publish_date: publishDate,
      topic_key: topicKey,
      topic_title_zh_tw: topic.zhTw,
      topic_category: topic.category,
      status: "ready",
    })
    .select()
    .single();

  if (topicError || !topicData) {
    throw new Error(`建立主題失敗：${JSON.stringify(topicError)}`);
  }

  // Generate and insert all five languages concurrently instead of one at a
  // time — Gemini calls are the dominant latency here, so running them in
  // parallel cuts total generation time roughly 5x.
  const perLanguageResults = await Promise.all(
    LANGUAGES.map(async (lang) => {
      try {
        const content = await generateArticle(lang, topic.zhTw, topic.category, newsHeadline);

        await supabase
          .from("reading_articles")
          .delete()
          .eq("topic_id", topicData.id)
          .eq("language_code", lang);

        const { data: article, error: articleError } = await supabase
          .from("reading_articles")
          .insert({
            topic_id: topicData.id,
            language_code: lang,
            title: content.title,
            title_zh_tw: content.titleZhTw,
            article_text: content.articleText,
            difficulty_level: "A2",
            estimated_reading_seconds: estimateReadingSeconds(content.articleText, lang),
            source_type: "original_ai",
            content_version: 1,
            status: "published",
            published_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (articleError || !article) {
          return { lang, success: false, error: JSON.stringify(articleError) } as const;
        }

        const sentenceRows = content.sentences.map((sentence) => ({
          article_id: article.id,
          sentence_order: sentence.order,
          sentence_text: sentence.text,
          sentence_zh_tw: sentence.zhTw,
          sentence_type: "body",
          estimated_duration_ms: estimateSentenceDurationMs(sentence.text, lang),
        }));
        const { error: sentenceError } = await supabase
          .from("reading_article_sentences")
          .insert(sentenceRows);
        if (sentenceError) throw sentenceError;

        const questionRows = content.questions.map((question, index) => ({
          article_id: article.id,
          question_order: index + 1,
          question_type: question.type,
          question_text: question.question,
          options_json: { options: question.options },
          correct_answer_json: { answer: question.answer },
          explanation_zh_tw: question.explanationZhTw,
        }));
        const { error: questionError } = await supabase
          .from("reading_article_questions")
          .insert(questionRows);
        if (questionError) throw questionError;

        return { lang, success: true, articleId: article.id as string, title: content.title } as const;
      } catch (err) {
        return { lang, success: false, error: err instanceof Error ? err.message : String(err) } as const;
      }
    })
  );

  const results: DailyArticleCreateResult["results"] = perLanguageResults.map(({ lang, success, ...rest }) => ({
    lang,
    success,
    ...rest,
  }));
  const articleIds: string[] = perLanguageResults
    .filter((result): result is Extract<typeof result, { success: true }> => result.success)
    .map((result) => result.articleId);

  await supabase
    .from("reading_article_topics")
    .update({ status: "published" })
    .eq("id", topicData.id);

  const successCount = results.filter((result) => result.success).length;
  const prewarm = shouldPrewarm
    ? {
        requested: true,
        results: await prewarmCreatedArticles(supabase, articleIds, includeAudio),
      }
    : undefined;

  return {
    success: true,
    forced: force,
    date: publishDate,
    topic: topic.zhTw,
    topicId: topicData.id as string,
    articlesCreated: successCount,
    results,
    prewarm,
  };
}

async function generateArticle(
  languageCode: string,
  topicZhTw: string,
  category: string,
  newsHeadline?: NewsHeadline | null
): Promise<ArticleContent> {
  if (hasGeminiConfig()) {
    try {
      return await generateWithGeminiArticle(languageCode, topicZhTw, category, newsHeadline);
    } catch (e) {
      console.warn(`Gemini failed for ${languageCode}, using mock:`, e);
    }
  }
  return getMockContent(languageCode, topicZhTw);
}

async function generateWithGeminiArticle(
  languageCode: string,
  topicZhTw: string,
  category: string,
  newsHeadline?: NewsHeadline | null
): Promise<ArticleContent> {
  const langName = LANG_NAMES[languageCode];

  const newsContext = newsHeadline
    ? `\n\nBase this article on the following real, current news story so learners practice with authentic current events. Simplify vocabulary and sentence structure for A2/B1 learners, but keep the real facts (who/what/where) accurate. Do not copy sentences verbatim; rewrite them for language learners.\nNews title: ${newsHeadline.title}\nNews summary: ${newsHeadline.description || "(no summary provided)"}`
    : "";

  const prompt = `You are a language learning content creator. Generate a learning article in ${langName} about the topic: "${topicZhTw}" (category: ${category}).${newsContext}

Requirements:
- 11-14 natural sentences appropriate for A2/B1 level learners
- Each sentence should be clear enough for sentence-by-sentence audio playback
- English articles should be about 180-260 words; other languages should be similar in reading time
- Include useful vocabulary repeatedly enough for learners to tap words and review them
- Include Traditional Chinese (繁體中文) translations for each sentence
- 3 comprehension questions (mix of multiple_choice and true_false)
- Return ONLY valid JSON, no extra text

Output JSON format:
{
  "title": "Article title in ${langName}",
  "titleZhTw": "繁體中文標題",
  "articleText": "Full article in ${langName}",
  "sentences": [
    {"order": 1, "text": "sentence in ${langName}", "zhTw": "繁體中文翻譯"}
  ],
  "questions": [
    {
      "type": "multiple_choice",
      "question": "Question in ${langName}",
      "options": ["A", "B", "C", "D"],
      "answer": "A",
      "explanationZhTw": "解釋"
    }
  ]
}`;

  const content = await generateJsonWithGemini<ArticleContent>({
    prompt,
    temperature: 0.7,
    maxOutputTokens: 4096,
  });
  if (!content?.sentences?.length) throw new Error("Gemini returned no sentences");
  return content;
}

function getMockContent(languageCode: string, topicZhTw: string): ArticleContent {
  const titleMap: Record<string, string> = {
    en: `Learning About ${topicZhTw}`,
    ja: `${topicZhTw}について学ぼう`,
    ko: `${topicZhTw}에 대해 배우기`,
    it: `Impariamo su ${topicZhTw}`,
    es: `Aprendamos sobre ${topicZhTw}`,
  };

  const mockSentences: Record<string, Array<{ order: number; text: string; zhTw: string }>> = {
    en: [
      { order: 1, text: "Good morning! How can I help you today?", zhTw: "早安！今天我能為您做什麼？" },
      { order: 2, text: "I would like to practice my English.", zhTw: "我想練習我的英文。" },
      { order: 3, text: "That's a great idea!", zhTw: "這是個好主意！" },
      { order: 4, text: "Let's start with some basic phrases.", zhTw: "讓我們從一些基本短語開始。" },
      { order: 5, text: "Please repeat after me.", zhTw: "請跟著我重複。" },
      { order: 6, text: "You are doing very well.", zhTw: "你做得很好。" },
      { order: 7, text: "Practice makes perfect.", zhTw: "熟能生巧。" },
    ],
    ja: [
      { order: 1, text: "おはようございます！今日はどうしますか。", zhTw: "早安！今天要做什麼呢？" },
      { order: 2, text: "日本語を練習したいです。", zhTw: "我想練習日文。" },
      { order: 3, text: "それは素晴らしい考えですね！", zhTw: "那是個很棒的想法！" },
      { order: 4, text: "基本的な表現から始めましょう。", zhTw: "讓我們從基本表達開始吧。" },
      { order: 5, text: "私の後に繰り返してください。", zhTw: "請跟著我重複。" },
      { order: 6, text: "とても上手ですよ。", zhTw: "你做得很好。" },
      { order: 7, text: "練習を続けましょう。", zhTw: "讓我們繼續練習。" },
    ],
    ko: [
      { order: 1, text: "안녕하세요! 오늘 어떻게 도와드릴까요?", zhTw: "您好！今天我能幫您什麼？" },
      { order: 2, text: "한국어를 연습하고 싶습니다.", zhTw: "我想練習韓文。" },
      { order: 3, text: "좋은 생각이에요!", zhTw: "這是個好主意！" },
      { order: 4, text: "기본 표현부터 시작합시다.", zhTw: "讓我們從基本表達開始。" },
      { order: 5, text: "제 뒤를 따라 반복해 주세요.", zhTw: "請跟著我重複。" },
      { order: 6, text: "정말 잘하고 있어요.", zhTw: "你做得非常好。" },
      { order: 7, text: "계속 연습해요!", zhTw: "繼續練習吧！" },
    ],
    it: [
      { order: 1, text: "Buongiorno! Come posso aiutarla oggi?", zhTw: "早安！今天我能為您做什麼？" },
      { order: 2, text: "Vorrei praticare il mio italiano.", zhTw: "我想練習我的義大利文。" },
      { order: 3, text: "È un'ottima idea!", zhTw: "這是個好主意！" },
      { order: 4, text: "Cominciamo con alcune frasi di base.", zhTw: "讓我們從一些基本短語開始。" },
      { order: 5, text: "Per favore, ripeta dopo di me.", zhTw: "請跟著我重複。" },
      { order: 6, text: "Sta andando molto bene.", zhTw: "你做得很好。" },
      { order: 7, text: "La pratica rende perfetti.", zhTw: "熟能生巧。" },
    ],
    es: [
      { order: 1, text: "¡Buenos días! ¿Cómo puedo ayudarle hoy?", zhTw: "早安！今天我能為您做什麼？" },
      { order: 2, text: "Me gustaría practicar mi español.", zhTw: "我想練習我的西班牙文。" },
      { order: 3, text: "¡Es una gran idea!", zhTw: "這是個好主意！" },
      { order: 4, text: "Empecemos con algunas frases básicas.", zhTw: "讓我們從一些基本短語開始。" },
      { order: 5, text: "Por favor, repita después de mí.", zhTw: "請跟著我重複。" },
      { order: 6, text: "Lo está haciendo muy bien.", zhTw: "你做得很好。" },
      { order: 7, text: "La práctica hace al maestro.", zhTw: "熟能生巧。" },
    ],
  };

  const sentences = mockSentences[languageCode] ?? mockSentences.en;
  const articleText = sentences.map((sentence) => sentence.text).join(" ");

  return {
    title: titleMap[languageCode] ?? titleMap.en,
    titleZhTw: topicZhTw,
    articleText,
    sentences,
    questions: [
      {
        type: "multiple_choice",
        question: sentences[1]?.text ?? "What did the person want to do?",
        options: [sentences[1]?.text ?? "Practice", "Sleep", "Eat", "Leave"],
        answer: sentences[1]?.text ?? "Practice",
        explanationZhTw: `文中提到：「${sentences[1]?.zhTw}」`,
      },
      {
        type: "true_false",
        question: sentences[2]?.text ?? "Is it a great idea?",
        options: ["True", "False"],
        answer: "True",
        explanationZhTw: `文中肯定地說：「${sentences[2]?.zhTw}」`,
      },
      {
        type: "fill_in_blank",
        question: sentences[6]?.text.replace(/\S+$/, "___") ?? "Practice makes ___.",
        options: ["perfect", "easy", "hard", "fast"],
        answer: "perfect",
        explanationZhTw: `文中說：「${sentences[6]?.zhTw}」`,
      },
    ],
  };
}
