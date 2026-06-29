/**
 * 每日文章生成 Cron Job
 * 
 * 使用 Vercel Cron Jobs 或其他 cron 服務執行
 * 
 * 每日流程：
 * 1. 生成明日文章主題
 * 2. 為五種語言生成文章
 * 3. 預存片語索引與字卡
 * 4. 預生成句子語音
 * 5. 發布文章
 */

import { createClient } from '@supabase/supabase-js';

// 每日主題清單
const DAILY_TOPICS = [
  { key: 'ordering_coffee', title: '在咖啡店點餐', category: 'daily_life' },
  { key: 'first_meeting', title: '第一次參加公司會議', category: 'work' },
  { key: 'weekend_trip', title: '週末旅行計畫', category: 'travel' },
  { key: 'supermarket', title: '超市購物', category: 'daily_life' },
  { key: 'birthday_party', title: '朋友生日聚會', category: 'social' },
  { key: 'weather_clothing', title: '天氣與穿搭', category: 'daily_life' },
  { key: 'taking_leave', title: '工作請假', category: 'work' },
  { key: 'healthy_habits', title: '健康生活習慣', category: 'health' },
  { key: 'hotel_checkin', title: '飯店入住', category: 'travel' },
  { key: 'online_shopping', title: '線上購物', category: 'daily_life' },
  { key: 'job_interview', title: '面試準備', category: 'work' },
  { key: 'daily_commute', title: '日常通勤', category: 'daily_life' },
];

const DIFFICULTY_LEVELS = ['A1', 'A2', 'B1'] as const;
const LANGUAGES = ['en', 'ja', 'ko', 'it', 'es'] as const;

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase environment variables not configured');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. 計算明日日期
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const publishDate = tomorrow.toISOString().split('T')[0];

  console.log(`Generating daily articles for ${publishDate}`);

  // 2. 檢查是否已經有明日的文章
  const { data: existingTopic } = await supabase
    .from('reading_article_topics')
    .select('*')
    .eq('publish_date', publishDate)
    .maybeSingle();

  if (existingTopic) {
    console.log(`Articles for ${publishDate} already exist, skipping`);
    return;
  }

  // 3. 選擇主題（輪流使用）
  const topicIndex = new Date().getDate() % DAILY_TOPICS.length;
  const topic = DAILY_TOPICS[topicIndex];
  const difficultyLevel = DIFFICULTY_LEVELS[new Date().getDate() % DIFFICULTY_LEVELS.length];

  console.log(`Selected topic: ${topic.title} (${topic.key})`);
  console.log(`Difficulty level: ${difficultyLevel}`);

  // 4. 呼叫文章生成 API
  try {
    const generateResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/articles/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publishDate,
        topicKey: topic.key,
        topicTitleZhTw: topic.title,
        topicCategory: topic.category,
        difficultyLevel,
        languages: LANGUAGES,
      }),
    });

    if (!generateResponse.ok) {
      const error = await generateResponse.text();
      console.error('Failed to generate articles:', error);
      process.exit(1);
    }

    const generateData = await generateResponse.json();
    console.log('Articles generated successfully:', generateData.articles.length);

    // 5. 預存每篇文章
    for (const article of generateData.articles) {
      console.log(`Prewarming article ${article.id} (${article.language_code})`);

      const prewarmResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/articles/prewarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: article.id,
        }),
      });

      if (!prewarmResponse.ok) {
        const error = await prewarmResponse.text();
        console.error(`Failed to prewarm article ${article.id}:`, error);
        continue;
      }

      const prewarmData = await prewarmResponse.json();
      console.log(`Prewarm completed for ${article.id}:`, prewarmData);
    }

    // 6. 發布文章
    console.log('Publishing articles...');
    const publishResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/articles/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicId: generateData.topic.id,
      }),
    });

    if (!publishResponse.ok) {
      const error = await publishResponse.text();
      console.error('Failed to publish articles:', error);
      process.exit(1);
    }

    const publishData = await publishResponse.json();
    console.log('Articles published successfully:', publishData);

  } catch (error) {
    console.error('Error in daily article generation:', error);
    process.exit(1);
  }
}

// 執行
main();
