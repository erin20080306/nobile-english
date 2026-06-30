-- ============================================================
-- 每日閱讀文章測試資料 (Seed)
-- 在 Supabase SQL Editor 執行此檔案即可插入今日測試文章
-- ============================================================

DO $$
DECLARE
  v_topic_id    UUID;
  v_article_en  UUID;
  v_article_ja  UUID;
  v_article_ko  UUID;
  v_article_it  UUID;
  v_article_es  UUID;

  -- 英文句子 ID
  s_en_1 UUID; s_en_2 UUID; s_en_3 UUID; s_en_4 UUID; s_en_5 UUID;
  s_en_6 UUID; s_en_7 UUID; s_en_8 UUID; s_en_9 UUID;

  -- 日文句子 ID
  s_ja_1 UUID; s_ja_2 UUID; s_ja_3 UUID; s_ja_4 UUID; s_ja_5 UUID;
  s_ja_6 UUID; s_ja_7 UUID; s_ja_8 UUID; s_ja_9 UUID;

  -- 韓文句子 ID
  s_ko_1 UUID; s_ko_2 UUID; s_ko_3 UUID; s_ko_4 UUID; s_ko_5 UUID;
  s_ko_6 UUID; s_ko_7 UUID; s_ko_8 UUID; s_ko_9 UUID;

  -- 義大利文句子 ID
  s_it_1 UUID; s_it_2 UUID; s_it_3 UUID; s_it_4 UUID; s_it_5 UUID;
  s_it_6 UUID; s_it_7 UUID; s_it_8 UUID; s_it_9 UUID;

  -- 西班牙文句子 ID
  s_es_1 UUID; s_es_2 UUID; s_es_3 UUID; s_es_4 UUID; s_es_5 UUID;
  s_es_6 UUID; s_es_7 UUID; s_es_8 UUID; s_es_9 UUID;

BEGIN

-- ──────────────────────────────────────────
-- 1. 今日 Topic
-- ──────────────────────────────────────────
INSERT INTO reading_article_topics (publish_date, topic_key, topic_title_zh_tw, topic_category, status)
VALUES (CURRENT_DATE, 'coffee_shop_' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD'), '在咖啡店點餐', 'daily_life', 'published')
ON CONFLICT (publish_date) DO UPDATE SET status = 'published'
RETURNING id INTO v_topic_id;

-- ──────────────────────────────────────────
-- 2. 英文文章
-- ──────────────────────────────────────────
INSERT INTO reading_articles (topic_id, language_code, title, title_zh_tw, article_text, difficulty_level,
  estimated_reading_seconds, source_type, content_version, status, published_at)
VALUES (v_topic_id, 'en', 'Ordering Coffee', '在咖啡店點餐',
  'Welcome to the coffee shop. What would you like to order today? We have many options available. You can choose hot or cold drinks. Our special coffee is very popular. Would you like to try it? We also have delicious pastries. Please take a look at our menu. I''ll be happy to help you decide.',
  'A2', 60, 'original_ai', 1, 'published', NOW())
ON CONFLICT (topic_id, language_code) DO UPDATE SET status = 'published', published_at = NOW()
RETURNING id INTO v_article_en;

-- 英文句子
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_en, 1, 'Welcome to the coffee shop.', '歡迎來到咖啡店。', 'body', 2000) RETURNING id INTO s_en_1;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_en, 2, 'What would you like to order today?', '您今天想點什麼？', 'body', 2500) RETURNING id INTO s_en_2;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_en, 3, 'We have many options available.', '我們有很多選擇。', 'body', 2000) RETURNING id INTO s_en_3;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_en, 4, 'You can choose hot or cold drinks.', '您可以選擇熱飲或冷飲。', 'body', 2500) RETURNING id INTO s_en_4;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_en, 5, 'Our special coffee is very popular.', '我們的特製咖啡很受歡迎。', 'body', 2500) RETURNING id INTO s_en_5;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_en, 6, 'Would you like to try it?', '您想試試看嗎？', 'body', 1800) RETURNING id INTO s_en_6;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_en, 7, 'We also have delicious pastries.', '我們還有美味的糕點。', 'body', 2200) RETURNING id INTO s_en_7;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_en, 8, 'Please take a look at our menu.', '請看看我們的菜單。', 'body', 2200) RETURNING id INTO s_en_8;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_en, 9, 'I''ll be happy to help you decide.', '我很樂意幫您決定。', 'body', 2500) RETURNING id INTO s_en_9;

-- 英文測驗
INSERT INTO reading_article_questions (article_id, question_order, question_type, question_text, options_json, correct_answer_json, explanation_zh_tw)
VALUES (v_article_en, 1, 'multiple_choice', 'What can you choose at the coffee shop?',
  '{"options": ["Hot or cold drinks", "Only hot drinks", "Only cold drinks", "No drinks"]}',
  '{"answer": "Hot or cold drinks"}',
  '文中提到您可以選擇熱飲或冷飲。');

INSERT INTO reading_article_questions (article_id, question_order, question_type, question_text, options_json, correct_answer_json, explanation_zh_tw)
VALUES (v_article_en, 2, 'true_false', 'The special coffee is not popular.',
  '{"options": ["True", "False"]}',
  '{"answer": "False"}',
  '文中說特製咖啡很受歡迎，所以這是錯的。');

INSERT INTO reading_article_questions (article_id, question_order, question_type, question_text, options_json, correct_answer_json, explanation_zh_tw)
VALUES (v_article_en, 3, 'fill_in_blank', 'Please take a look at our ___.',
  '{"options": ["menu", "coffee", "order", "shop"]}',
  '{"answer": "menu"}',
  '文中說請看看我們的菜單。');

-- 英文獎勵
INSERT INTO reading_article_rewards (article_id, language_code, reward_type, reward_amount) VALUES (v_article_en, 'en', 'coins', 10);
INSERT INTO reading_article_rewards (article_id, language_code, reward_type, reward_amount, crop_type) VALUES (v_article_en, 'en', 'seeds', 5, 'english_crop');
INSERT INTO reading_article_rewards (article_id, language_code, reward_type, reward_amount) VALUES (v_article_en, 'en', 'water', 3);

-- ──────────────────────────────────────────
-- 3. 日文文章
-- ──────────────────────────────────────────
INSERT INTO reading_articles (topic_id, language_code, title, title_zh_tw, article_text, difficulty_level,
  estimated_reading_seconds, source_type, content_version, status, published_at)
VALUES (v_topic_id, 'ja', 'コーヒーを注文する', '在咖啡店點餐',
  'コーヒーショップへようこそ。今日は何をご注文なさいますか。たくさんの種類があります。ホットドリンクかコールドドリンクを選べます。当店のスペシャルコーヒーはとても人気です。いかがですか。美味しいペストリーもあります。メニューをご覧ください。お選びのお手伝いをさせていただきます。',
  'A2', 70, 'original_ai', 1, 'published', NOW())
ON CONFLICT (topic_id, language_code) DO UPDATE SET status = 'published', published_at = NOW()
RETURNING id INTO v_article_ja;

INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_ja, 1, 'コーヒーショップへようこそ。', '歡迎來到咖啡店。', 'body', 2200) RETURNING id INTO s_ja_1;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_ja, 2, '今日は何をご注文なさいますか。', '您今天想點什麼？', 'body', 2800) RETURNING id INTO s_ja_2;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_ja, 3, 'たくさんの種類があります。', '我們有很多選擇。', 'body', 2200) RETURNING id INTO s_ja_3;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_ja, 4, 'ホットドリンクかコールドドリンクを選べます。', '您可以選擇熱飲或冷飲。', 'body', 3000) RETURNING id INTO s_ja_4;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_ja, 5, '当店のスペシャルコーヒーはとても人気です。', '我們的特製咖啡很受歡迎。', 'body', 3000) RETURNING id INTO s_ja_5;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_ja, 6, 'いかがですか。', '您想試試看嗎？', 'body', 1500) RETURNING id INTO s_ja_6;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_ja, 7, '美味しいペストリーもあります。', '我們還有美味的糕點。', 'body', 2500) RETURNING id INTO s_ja_7;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_ja, 8, 'メニューをご覧ください。', '請看看我們的菜單。', 'body', 2000) RETURNING id INTO s_ja_8;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_ja, 9, 'お選びのお手伝いをさせていただきます。', '我很樂意幫您決定。', 'body', 3200) RETURNING id INTO s_ja_9;

INSERT INTO reading_article_questions (article_id, question_order, question_type, question_text, options_json, correct_answer_json, explanation_zh_tw)
VALUES (v_article_ja, 1, 'multiple_choice', 'コーヒーショップで何を選べますか。',
  '{"options": ["ホットかコールドドリンク", "ホットドリンクだけ", "コールドドリンクだけ", "ドリンクなし"]}',
  '{"answer": "ホットかコールドドリンク"}', '文中提到可以選擇熱飲或冷飲。');

INSERT INTO reading_article_questions (article_id, question_order, question_type, question_text, options_json, correct_answer_json, explanation_zh_tw)
VALUES (v_article_ja, 2, 'true_false', 'スペシャルコーヒーは人気がありません。',
  '{"options": ["はい", "いいえ"]}', '{"answer": "いいえ"}', '文中說特製咖啡很受歡迎，所以這是錯的。');

INSERT INTO reading_article_questions (article_id, question_order, question_type, question_text, options_json, correct_answer_json, explanation_zh_tw)
VALUES (v_article_ja, 3, 'fill_in_blank', '___をご覧ください。',
  '{"options": ["メニュー", "コーヒー", "注文", "ショップ"]}', '{"answer": "メニュー"}', '文中說請看看菜單。');

INSERT INTO reading_article_rewards (article_id, language_code, reward_type, reward_amount) VALUES (v_article_ja, 'ja', 'coins', 10);
INSERT INTO reading_article_rewards (article_id, language_code, reward_type, reward_amount, crop_type) VALUES (v_article_ja, 'ja', 'seeds', 5, 'japanese_crop');
INSERT INTO reading_article_rewards (article_id, language_code, reward_type, reward_amount) VALUES (v_article_ja, 'ja', 'water', 3);

-- ──────────────────────────────────────────
-- 4. 韓文文章
-- ──────────────────────────────────────────
INSERT INTO reading_articles (topic_id, language_code, title, title_zh_tw, article_text, difficulty_level,
  estimated_reading_seconds, source_type, content_version, status, published_at)
VALUES (v_topic_id, 'ko', '커피 주문하기', '在咖啡店點餐',
  '커피숍에 오신 것을 환영합니다. 오늘은 무엇을 주문하시겠습니까. 많은 옵션이 있습니다. 뜨거운 음료나 차가운 음료를 선택할 수 있습니다. 우리의 특별 커피는 매우 인기가 많습니다. 한번 드셔보시겠습니까. 맛있는 페이스트리도 있습니다. 메뉴를 보세요. 선택하는 것을 도와드리겠습니다.',
  'A2', 70, 'original_ai', 1, 'published', NOW())
ON CONFLICT (topic_id, language_code) DO UPDATE SET status = 'published', published_at = NOW()
RETURNING id INTO v_article_ko;

INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_ko, 1, '커피숍에 오신 것을 환영합니다.', '歡迎來到咖啡店。', 'body', 2500) RETURNING id INTO s_ko_1;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_ko, 2, '오늘은 무엇을 주문하시겠습니까.', '您今天想點什麼？', 'body', 2800) RETURNING id INTO s_ko_2;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_ko, 3, '많은 옵션이 있습니다.', '我們有很多選擇。', 'body', 2000) RETURNING id INTO s_ko_3;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_ko, 4, '뜨거운 음료나 차가운 음료를 선택할 수 있습니다.', '您可以選擇熱飲或冷飲。', 'body', 3200) RETURNING id INTO s_ko_4;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_ko, 5, '우리의 특별 커피는 매우 인기가 많습니다.', '我們的特製咖啡很受歡迎。', 'body', 3200) RETURNING id INTO s_ko_5;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_ko, 6, '한번 드셔보시겠습니까.', '您想試試看嗎？', 'body', 2000) RETURNING id INTO s_ko_6;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_ko, 7, '맛있는 페이스트리도 있습니다.', '我們還有美味的糕點。', 'body', 2500) RETURNING id INTO s_ko_7;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_ko, 8, '메뉴를 보세요.', '請看看我們的菜單。', 'body', 1800) RETURNING id INTO s_ko_8;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_ko, 9, '선택하는 것을 도와드리겠습니다.', '我很樂意幫您決定。', 'body', 3000) RETURNING id INTO s_ko_9;

INSERT INTO reading_article_questions (article_id, question_order, question_type, question_text, options_json, correct_answer_json, explanation_zh_tw)
VALUES (v_article_ko, 1, 'multiple_choice', '커피숍에서 무엇을 선택할 수 있습니까.',
  '{"options": ["뜨거운 음료나 차가운 음료", "뜨거운 음료만", "차가운 음료만", "음료 없음"]}',
  '{"answer": "뜨거운 음료나 차가운 음료"}', '文中提到可以選擇熱飲或冷飲。');

INSERT INTO reading_article_questions (article_id, question_order, question_type, question_text, options_json, correct_answer_json, explanation_zh_tw)
VALUES (v_article_ko, 2, 'true_false', '특별 커피는 인기가 없습니다.',
  '{"options": ["예", "아니오"]}', '{"answer": "아니오"}', '文中說特製咖啡很受歡迎，所以這是錯的。');

INSERT INTO reading_article_questions (article_id, question_order, question_type, question_text, options_json, correct_answer_json, explanation_zh_tw)
VALUES (v_article_ko, 3, 'fill_in_blank', '___를 보세요.',
  '{"options": ["메뉴", "커피", "주문", "숍"]}', '{"answer": "메뉴"}', '文中說請看看菜單。');

INSERT INTO reading_article_rewards (article_id, language_code, reward_type, reward_amount) VALUES (v_article_ko, 'ko', 'coins', 10);
INSERT INTO reading_article_rewards (article_id, language_code, reward_type, reward_amount, crop_type) VALUES (v_article_ko, 'ko', 'seeds', 5, 'korean_crop');
INSERT INTO reading_article_rewards (article_id, language_code, reward_type, reward_amount) VALUES (v_article_ko, 'ko', 'water', 3);

-- ──────────────────────────────────────────
-- 5. 義大利文文章
-- ──────────────────────────────────────────
INSERT INTO reading_articles (topic_id, language_code, title, title_zh_tw, article_text, difficulty_level,
  estimated_reading_seconds, source_type, content_version, status, published_at)
VALUES (v_topic_id, 'it', 'Ordinare un caffè', '在咖啡店點餐',
  'Benvenuti al caffè. Cosa vorreste ordinare oggi? Abbiamo molte opzioni disponibili. Potete scegliere bevande calde o fredde. Il nostro caffè speciale è molto popolare. Vorreste provarlo? Abbiamo anche deliziosi pasticcini. Date un''occhiata al nostro menu. Sarò felice di aiutarvi a scegliere.',
  'A2', 65, 'original_ai', 1, 'published', NOW())
ON CONFLICT (topic_id, language_code) DO UPDATE SET status = 'published', published_at = NOW()
RETURNING id INTO v_article_it;

INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_it, 1, 'Benvenuti al caffè.', '歡迎來到咖啡店。', 'body', 2000) RETURNING id INTO s_it_1;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_it, 2, 'Cosa vorreste ordinare oggi?', '您今天想點什麼？', 'body', 2500) RETURNING id INTO s_it_2;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_it, 3, 'Abbiamo molte opzioni disponibili.', '我們有很多選擇。', 'body', 2500) RETURNING id INTO s_it_3;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_it, 4, 'Potete scegliere bevande calde o fredde.', '您可以選擇熱飲或冷飲。', 'body', 2800) RETURNING id INTO s_it_4;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_it, 5, 'Il nostro caffè speciale è molto popolare.', '我們的特製咖啡很受歡迎。', 'body', 3000) RETURNING id INTO s_it_5;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_it, 6, 'Vorreste provarlo?', '您想試試看嗎？', 'body', 1800) RETURNING id INTO s_it_6;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_it, 7, 'Abbiamo anche deliziosi pasticcini.', '我們還有美味的糕點。', 'body', 2500) RETURNING id INTO s_it_7;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_it, 8, 'Date un''occhiata al nostro menu.', '請看看我們的菜單。', 'body', 2500) RETURNING id INTO s_it_8;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_it, 9, 'Sarò felice di aiutarvi a scegliere.', '我很樂意幫您決定。', 'body', 2800) RETURNING id INTO s_it_9;

INSERT INTO reading_article_questions (article_id, question_order, question_type, question_text, options_json, correct_answer_json, explanation_zh_tw)
VALUES (v_article_it, 1, 'multiple_choice', 'Cosa potete scegliere al caffè?',
  '{"options": ["Bevande calde o fredde", "Solo bevande calde", "Solo bevande fredde", "Nessuna bevanda"]}',
  '{"answer": "Bevande calde o fredde"}', '文中提到可以選擇熱飲或冷飲。');

INSERT INTO reading_article_questions (article_id, question_order, question_type, question_text, options_json, correct_answer_json, explanation_zh_tw)
VALUES (v_article_it, 2, 'true_false', 'Il caffè speciale non è popolare.',
  '{"options": ["Vero", "Falso"]}', '{"answer": "Falso"}', '文中說特製咖啡很受歡迎，所以這是錯的。');

INSERT INTO reading_article_questions (article_id, question_order, question_type, question_text, options_json, correct_answer_json, explanation_zh_tw)
VALUES (v_article_it, 3, 'fill_in_blank', 'Date un''occhiata al nostro ___.',
  '{"options": ["menu", "caffè", "ordine", "locale"]}', '{"answer": "menu"}', '文中說請看看菜單。');

INSERT INTO reading_article_rewards (article_id, language_code, reward_type, reward_amount) VALUES (v_article_it, 'it', 'coins', 10);
INSERT INTO reading_article_rewards (article_id, language_code, reward_type, reward_amount, crop_type) VALUES (v_article_it, 'it', 'seeds', 5, 'italian_crop');
INSERT INTO reading_article_rewards (article_id, language_code, reward_type, reward_amount) VALUES (v_article_it, 'it', 'water', 3);

-- ──────────────────────────────────────────
-- 6. 西班牙文文章
-- ──────────────────────────────────────────
INSERT INTO reading_articles (topic_id, language_code, title, title_zh_tw, article_text, difficulty_level,
  estimated_reading_seconds, source_type, content_version, status, published_at)
VALUES (v_topic_id, 'es', 'Pedir café', '在咖啡店點餐',
  'Bienvenidos a la cafetería. ¿Qué les gustaría pedir hoy? Tenemos muchas opciones disponibles. Pueden elegir bebidas calientes o frías. Nuestro café especial es muy popular. ¿Les gustaría probarlo? También tenemos deliciosos pasteles. Por favor, miren nuestro menú. Estaré feliz de ayudarles a decidir.',
  'A2', 65, 'original_ai', 1, 'published', NOW())
ON CONFLICT (topic_id, language_code) DO UPDATE SET status = 'published', published_at = NOW()
RETURNING id INTO v_article_es;

INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_es, 1, 'Bienvenidos a la cafetería.', '歡迎來到咖啡店。', 'body', 2000) RETURNING id INTO s_es_1;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_es, 2, '¿Qué les gustaría pedir hoy?', '您今天想點什麼？', 'body', 2500) RETURNING id INTO s_es_2;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_es, 3, 'Tenemos muchas opciones disponibles.', '我們有很多選擇。', 'body', 2500) RETURNING id INTO s_es_3;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_es, 4, 'Pueden elegir bebidas calientes o frías.', '您可以選擇熱飲或冷飲。', 'body', 2800) RETURNING id INTO s_es_4;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_es, 5, 'Nuestro café especial es muy popular.', '我們的特製咖啡很受歡迎。', 'body', 2800) RETURNING id INTO s_es_5;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_es, 6, '¿Les gustaría probarlo?', '您想試試看嗎？', 'body', 1800) RETURNING id INTO s_es_6;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_es, 7, 'También tenemos deliciosos pasteles.', '我們還有美味的糕點。', 'body', 2500) RETURNING id INTO s_es_7;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_es, 8, 'Por favor, miren nuestro menú.', '請看看我們的菜單。', 'body', 2200) RETURNING id INTO s_es_8;
INSERT INTO reading_article_sentences (article_id, sentence_order, sentence_text, sentence_zh_tw, sentence_type, estimated_duration_ms) VALUES (v_article_es, 9, 'Estaré feliz de ayudarles a decidir.', '我很樂意幫您決定。', 'body', 2800) RETURNING id INTO s_es_9;

INSERT INTO reading_article_questions (article_id, question_order, question_type, question_text, options_json, correct_answer_json, explanation_zh_tw)
VALUES (v_article_es, 1, 'multiple_choice', '¿Qué pueden elegir en la cafetería?',
  '{"options": ["Bebidas calientes o frías", "Solo bebidas calientes", "Solo bebidas frías", "Ninguna bebida"]}',
  '{"answer": "Bebidas calientes o frías"}', '文中提到可以選擇熱飲或冷飲。');

INSERT INTO reading_article_questions (article_id, question_order, question_type, question_text, options_json, correct_answer_json, explanation_zh_tw)
VALUES (v_article_es, 2, 'true_false', 'El café especial no es popular.',
  '{"options": ["Verdadero", "Falso"]}', '{"answer": "Falso"}', '文中說特製咖啡很受歡迎，所以這是錯的。');

INSERT INTO reading_article_questions (article_id, question_order, question_type, question_text, options_json, correct_answer_json, explanation_zh_tw)
VALUES (v_article_es, 3, 'fill_in_blank', 'Por favor, miren nuestro ___.',
  '{"options": ["menú", "café", "pedido", "local"]}', '{"answer": "menú"}', '文中說請看看菜單。');

INSERT INTO reading_article_rewards (article_id, language_code, reward_type, reward_amount) VALUES (v_article_es, 'es', 'coins', 10);
INSERT INTO reading_article_rewards (article_id, language_code, reward_type, reward_amount, crop_type) VALUES (v_article_es, 'es', 'seeds', 5, 'spanish_crop');
INSERT INTO reading_article_rewards (article_id, language_code, reward_type, reward_amount) VALUES (v_article_es, 'es', 'water', 3);

RAISE NOTICE '✅ 今日文章資料插入完成！Topic ID: %', v_topic_id;
RAISE NOTICE '   英文文章 ID: %', v_article_en;
RAISE NOTICE '   日文文章 ID: %', v_article_ja;
RAISE NOTICE '   韓文文章 ID: %', v_article_ko;
RAISE NOTICE '   義大利文文章 ID: %', v_article_it;
RAISE NOTICE '   西班牙文文章 ID: %', v_article_es;

END $$;
