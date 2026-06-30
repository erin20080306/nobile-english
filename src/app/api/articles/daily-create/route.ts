/**
 * 一鍵生成並發布今日文章 API
 * POST /api/articles/daily-create
 *
 * - 自動選今日主題（依日期輪換）
 * - 有 OPENAI_API_KEY → 用 GPT-4o-mini 生成真實文章
 * - 無 API Key → 使用 mock 資料（咖啡店文章）
 * - 直接以 published 狀態寫入 Supabase，跳過複雜 pipeline
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const missing: string[] = [];
    if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Supabase 環境變數未設定：${missing.join("、")}。請至 Vercel Dashboard → Project → Settings → Environment Variables 新增這些變數後重新部署。`,
          missing,
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];

    // 檢查今日是否已有發布文章
    const { data: existingTopic } = await supabase
      .from("reading_article_topics")
      .select("id, status")
      .eq("publish_date", today)
      .eq("status", "published")
      .maybeSingle();

    if (existingTopic) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: "今日文章已存在，無需重新生成",
        topicId: existingTopic.id,
      });
    }

    // 依日期選主題（每天不同）
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
    );
    const topic = TOPICS[dayOfYear % TOPICS.length];

    // 建立 topic（如已存在則更新）
    await supabase
      .from("reading_article_topics")
      .delete()
      .eq("publish_date", today);

    const { data: topicData, error: topicError } = await supabase
      .from("reading_article_topics")
      .insert({
        publish_date: today,
        topic_key: topic.key,
        topic_title_zh_tw: topic.zhTw,
        topic_category: topic.category,
        status: "ready",
      })
      .select()
      .single();

    if (topicError || !topicData) {
      return NextResponse.json(
        { error: "建立主題失敗：" + JSON.stringify(topicError) },
        { status: 500 }
      );
    }

    // 為每種語言生成文章
    const languages = ["en", "ja", "ko", "it", "es"];
    const results: Array<{ lang: string; success: boolean; title?: string; error?: string }> = [];

    for (const lang of languages) {
      try {
        const content = await generateArticle(lang, topic.zhTw, topic.category);

        // 刪除舊草稿
        await supabase
          .from("reading_articles")
          .delete()
          .eq("topic_id", topicData.id)
          .eq("language_code", lang);

        // 插入文章（直接發布）
        const { data: article, error: articleError } = await supabase
          .from("reading_articles")
          .insert({
            topic_id: topicData.id,
            language_code: lang,
            title: content.title,
            title_zh_tw: content.titleZhTw,
            article_text: content.articleText,
            difficulty_level: "A2",
            estimated_reading_seconds: Math.ceil(
              (content.articleText.split(/\s+/).length / 200) * 60
            ),
            source_type: "original_ai",
            content_version: 1,
            status: "published",
            published_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (articleError || !article) {
          results.push({ lang, success: false, error: JSON.stringify(articleError) });
          continue;
        }

        // 插入句子
        for (const s of content.sentences) {
          await supabase.from("reading_article_sentences").insert({
            article_id: article.id,
            sentence_order: s.order,
            sentence_text: s.text,
            sentence_zh_tw: s.zhTw,
            sentence_type: "body",
            estimated_duration_ms: Math.ceil(
              (s.text.split(/\s+/).length / 150) * 60 * 1000
            ),
          });
        }

        // 插入測驗題
        for (let i = 0; i < content.questions.length; i++) {
          const q = content.questions[i];
          await supabase.from("reading_article_questions").insert({
            article_id: article.id,
            question_order: i + 1,
            question_type: q.type,
            question_text: q.question,
            options_json: { options: q.options },
            correct_answer_json: { answer: q.answer },
            explanation_zh_tw: q.explanationZhTw,
          });
        }

        results.push({ lang, success: true, title: content.title });
      } catch (err) {
        results.push({ lang, success: false, error: String(err) });
      }
    }

    // 發布主題
    await supabase
      .from("reading_article_topics")
      .update({ status: "published" })
      .eq("id", topicData.id);

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      date: today,
      topic: topic.zhTw,
      articlesCreated: successCount,
      results,
    });
  } catch (error) {
    console.error("daily-create error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function generateArticle(
  languageCode: string,
  topicZhTw: string,
  category: string
): Promise<ArticleContent> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      return await generateWithOpenAI(languageCode, topicZhTw, category, openaiKey);
    } catch (e) {
      console.warn(`OpenAI failed for ${languageCode}, using mock:`, e);
    }
  }
  return getMockContent(languageCode, topicZhTw);
}

async function generateWithOpenAI(
  languageCode: string,
  topicZhTw: string,
  category: string,
  apiKey: string
): Promise<ArticleContent> {
  const langName = LANG_NAMES[languageCode];

  const prompt = `You are a language learning content creator. Generate a short learning article in ${langName} about the topic: "${topicZhTw}" (category: ${category}).

Requirements:
- 7-9 natural sentences appropriate for A2/B1 level learners
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

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content) as ArticleContent;
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

  const sentences = mockSentences[languageCode] ?? mockSentences["en"];
  const articleText = sentences.map((s) => s.text).join(" ");

  const questions: ArticleContent["questions"] = [
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
  ];

  return {
    title: titleMap[languageCode] ?? titleMap["en"],
    titleZhTw: topicZhTw,
    articleText,
    sentences,
    questions,
  };
}
