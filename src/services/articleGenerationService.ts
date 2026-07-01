/**
 * 每日五語閱讀文章生成服務
 * 
 * 使用 Gemini Flash-Lite 生成五種語言版本的學習文章
 * Generate Once, Validate Once, Prewarm Once, Publish Once, Reuse For All Users
 */

import type { GeminiArticleResponse, LearningLanguageCode, CEFRLevel } from "@/types";
import { generateJsonWithGemini, hasGeminiConfig } from "@/server/gemini";

interface ArticleGenerationOptions {
  topicKey: string;
  topicTitleZhTw: string;
  topicCategory: string;
  languageCode: LearningLanguageCode;
  difficultyLevel: CEFRLevel;
  maxCharacters?: number;
  minSentences?: number;
  maxSentences?: number;
  minQuestions?: number;
  maxQuestions?: number;
}

class ArticleGenerationService {
  private readonly DEFAULT_MAX_CHARACTERS = 1400;
  private readonly DEFAULT_MIN_SENTENCES = 10;
  private readonly DEFAULT_MAX_SENTENCES = 14;
  private readonly DEFAULT_MIN_QUESTIONS = 3;
  private readonly DEFAULT_MAX_QUESTIONS = 5;

  /**
   * 生成單一語言版本的學習文章
   */
  async generateArticle(options: ArticleGenerationOptions): Promise<GeminiArticleResponse> {
    const {
      topicKey,
      topicTitleZhTw,
      topicCategory,
      languageCode,
      difficultyLevel,
      maxCharacters = this.DEFAULT_MAX_CHARACTERS,
      minSentences = this.DEFAULT_MIN_SENTENCES,
      maxSentences = this.DEFAULT_MAX_SENTENCES,
      minQuestions = this.DEFAULT_MIN_QUESTIONS,
      maxQuestions = this.DEFAULT_MAX_QUESTIONS,
    } = options;

    const prompt = this.buildPrompt({
      topicKey,
      topicTitleZhTw,
      topicCategory,
      languageCode,
      difficultyLevel,
      maxCharacters,
      minSentences,
      maxSentences,
      minQuestions,
      maxQuestions,
    });

    if (hasGeminiConfig()) {
      try {
        const response = await this.callGemini(prompt);
        return this.parseResponse(response);
      } catch (error) {
        console.warn("Gemini article generation failed, using mock:", error);
      }
    }

    // 暫時返回 mock 資料
    return this.getMockResponse(options);
  }

  /**
   * 建立 Gemini prompt
   */
  private buildPrompt(options: {
    topicKey: string;
    topicTitleZhTw: string;
    topicCategory: string;
    languageCode: LearningLanguageCode;
    difficultyLevel: CEFRLevel;
    maxCharacters: number;
    minSentences: number;
    maxSentences: number;
    minQuestions: number;
    maxQuestions: number;
  }): string {
    const languageNames: Record<LearningLanguageCode, string> = {
      en: "English",
      ja: "Japanese",
      ko: "Korean",
      it: "Italian",
      es: "Spanish",
    };

    const languageName = languageNames[options.languageCode];

    return `You are an expert language learning content creator. Generate a learning article for ${languageName} learners.

**Topic:**
- Key: ${options.topicKey}
- Title (Chinese): ${options.topicTitleZhTw}
- Category: ${options.topicCategory}

**Requirements:**
1. Difficulty Level: ${options.difficultyLevel} (CEFR)
2. Maximum characters: ${options.maxCharacters} (including spaces)
3. Number of sentences: ${options.minSentences}-${options.maxSentences}
4. Number of questions: ${options.minQuestions}-${options.maxQuestions}
5. English articles should feel like a complete short article, about 180-260 words when the character limit allows it

**Content Guidelines:**
- Use natural, correct ${languageName} appropriate for ${options.difficultyLevel} learners
- Do NOT directly translate Chinese sentence patterns
- Do NOT generate real news claims or factual statements
- Do NOT cite unverified facts
- Do NOT include brand promotion, medical advice, financial advice, political stance, or dangerous content
- Do NOT exceed the character limit
- Sentence length should be suitable for sentence-by-sentence reading
- Use natural sentences that can be used for vocabulary cards and phrase cards
- Content should be evergreen learning material, not time-sensitive news

**Output Format (JSON):**
\`\`\`json
{
  "title": "Article title in ${languageName}",
  "titleZhTw": "Article title in Traditional Chinese",
  "difficultyLevel": "${options.difficultyLevel}",
  "topicCategory": "${options.topicCategory}",
  "articleText": "Full article text in ${languageName}",
  "sentences": [
    {
      "order": 1,
      "text": "First sentence in ${languageName}",
      "zhTw": "First sentence in Traditional Chinese"
    }
  ],
  "keyVocabulary": [
    {
      "surfaceText": "word or phrase as it appears",
      "lemma": "base form of the word",
      "reason": "why this is important for learners"
    }
  ],
  "questions": [
    {
      "type": "multiple_choice | sentence_order | word_match | true_false | fill_in_blank",
      "question": "Question in ${languageName}",
      "options": ["option1", "option2", "option3", "option4"],
      "answer": "correct answer",
      "explanationZhTw": "Explanation in Traditional Chinese"
    }
  ]
}
\`\`\`

**Question Types:**
- multiple_choice: Choose the correct answer from 4 options
- sentence_order: Arrange sentences in correct order
- word_match: Match words with their meanings
- true_false: True or false questions
- fill_in_blank: Fill in the missing word

**Important:**
- Return ONLY valid JSON
- Do NOT include any text outside the JSON
- Ensure all sentences are numbered correctly
- Ensure Traditional Chinese translations are natural and accurate
- Key vocabulary should include the most important words and phrases for learning
- Questions should test comprehension of the article content`;
  }

  /**
   * 呼叫 Gemini API
   */
  private async callGemini(prompt: string): Promise<string> {
    const result = await generateJsonWithGemini<GeminiArticleResponse>({
      prompt,
      temperature: 0.7,
      maxOutputTokens: 4096,
    });
    return JSON.stringify(result);
  }

  /**
   * 解析 Gemini 回應
   */
  private parseResponse(response: string): GeminiArticleResponse {
    try {
      const json = JSON.parse(response);
      return this.validateResponse(json);
    } catch (error) {
      throw new Error(`Failed to parse Gemini response: ${error}`);
    }
  }

  /**
   * 驗證回應格式
   */
  private validateResponse(data: any): GeminiArticleResponse {
    // TODO: 實作完整的驗證邏輯
    return data as GeminiArticleResponse;
  }

  /**
   * Mock 回應（用於測試）
   */
  private getMockResponse(options: ArticleGenerationOptions): GeminiArticleResponse {
    const mockResponses: Record<LearningLanguageCode, any> = {
      en: {
        title: "Ordering Coffee",
        titleZhTw: "在咖啡店點餐",
        difficultyLevel: options.difficultyLevel,
        topicCategory: options.topicCategory,
        articleText: "Welcome to the coffee shop. What would you like to order today? We have many options available. You can choose hot or cold drinks. Our special coffee is very popular. Would you like to try it? We also have delicious pastries. Please take a look at our menu. I'll be happy to help you decide.",
        sentences: [
          { order: 1, text: "Welcome to the coffee shop.", zhTw: "歡迎來到咖啡店。" },
          { order: 2, text: "What would you like to order today?", zhTw: "您今天想點什麼？" },
          { order: 3, text: "We have many options available.", zhTw: "我們有很多選擇。" },
          { order: 4, text: "You can choose hot or cold drinks.", zhTw: "您可以選擇熱飲或冷飲。" },
          { order: 5, text: "Our special coffee is very popular.", zhTw: "我們的特製咖啡很受歡迎。" },
          { order: 6, text: "Would you like to try it?", zhTw: "您想試試看嗎？" },
          { order: 7, text: "We also have delicious pastries.", zhTw: "我們還有美味的糕點。" },
          { order: 8, text: "Please take a look at our menu.", zhTw: "請看看我們的菜單。" },
          { order: 9, text: "I'll be happy to help you decide.", zhTw: "我很樂意幫您決定。" },
        ],
        keyVocabulary: [
          { surfaceText: "order", lemma: "order", reason: "Common verb for requesting food/drinks" },
          { surfaceText: "available", lemma: "available", reason: "Important adjective for options" },
          { surfaceText: "popular", lemma: "popular", reason: "Common adjective for describing preferences" },
          { surfaceText: "delicious", lemma: "delicious", reason: "Essential adjective for food" },
          { surfaceText: "menu", lemma: "menu", reason: "Essential noun for restaurants" },
        ],
        questions: [
          {
            type: "multiple_choice",
            question: "What can you choose at the coffee shop?",
            options: ["Hot or cold drinks", "Only hot drinks", "Only cold drinks", "No drinks"],
            answer: "Hot or cold drinks",
            explanationZhTw: "文中提到您可以選擇熱飲或冷飲。",
          },
          {
            type: "true_false",
            question: "The special coffee is not popular.",
            options: ["True", "False"],
            answer: "False",
            explanationZhTw: "文中說特製咖啡很受歡迎，所以這是錯的。",
          },
          {
            type: "fill_in_blank",
            question: "Please take a look at our ___.",
            options: ["menu", "coffee", "order", "shop"],
            answer: "menu",
            explanationZhTw: "文中說請看看我們的菜單。",
          },
        ],
      },
      ja: {
        title: "コーヒーを注文する",
        titleZhTw: "在咖啡店點餐",
        difficultyLevel: options.difficultyLevel,
        topicCategory: options.topicCategory,
        articleText: "コーヒーショップへようこそ。今日は何をご注文なさいますか。たくさんの種類があります。ホットドリンクかコールドドリンクを選べます。当店のスペシャルコーヒーはとても人気です。いかがですか。美味しいペストリーもあります。メニューをご覧ください。お選びのお手伝いをさせていただきます。",
        sentences: [
          { order: 1, text: "コーヒーショップへようこそ。", zhTw: "歡迎來到咖啡店。" },
          { order: 2, text: "今日は何をご注文なさいますか。", zhTw: "您今天想點什麼？" },
          { order: 3, text: "たくさんの種類があります。", zhTw: "我們有很多選擇。" },
          { order: 4, text: "ホットドリンクかコールドドリンクを選べます。", zhTw: "您可以選擇熱飲或冷飲。" },
          { order: 5, text: "当店のスペシャルコーヒーはとても人気です。", zhTw: "我們的特製咖啡很受歡迎。" },
          { order: 6, text: "いかがですか。", zhTw: "您想試試看嗎？" },
          { order: 7, text: "美味しいペストリーもあります。", zhTw: "我們還有美味的糕點。" },
          { order: 8, text: "メニューをご覧ください。", zhTw: "請看看我們的菜單。" },
          { order: 9, text: "お選びのお手伝いをさせていただきます。", zhTw: "我很樂意幫您決定。" },
        ],
        keyVocabulary: [
          { surfaceText: "注文", lemma: "注文", reason: "Common verb for ordering" },
          { surfaceText: "種類", lemma: "種類", reason: "Important noun for options" },
          { surfaceText: "人気", lemma: "人気", reason: "Common noun for popularity" },
          { surfaceText: "美味しい", lemma: "美味しい", reason: "Essential adjective for food" },
          { surfaceText: "メニュー", lemma: "メニュー", reason: "Essential noun for restaurants" },
        ],
        questions: [
          {
            type: "multiple_choice",
            question: "コーヒーショップで何を選べますか。",
            options: ["ホットかコールドドリンク", "ホットドリンクだけ", "コールドドリンクだけ", "ドリンクなし"],
            answer: "ホットかコールドドリンク",
            explanationZhTw: "文中提到可以選擇熱飲或冷飲。",
          },
          {
            type: "true_false",
            question: "スペシャルコーヒーは人気がありません。",
            options: ["はい", "いいえ"],
            answer: "いいえ",
            explanationZhTw: "文中說特製咖啡很受歡迎，所以這是錯的。",
          },
          {
            type: "fill_in_blank",
            question: "___をご覧ください。",
            options: ["メニュー", "コーヒー", "注文", "ショップ"],
            answer: "メニュー",
            explanationZhTw: "文中說請看看菜單。",
          },
        ],
      },
      ko: {
        title: "커피 주문하기",
        titleZhTw: "在咖啡店點餐",
        difficultyLevel: options.difficultyLevel,
        topicCategory: options.topicCategory,
        articleText: "커피숍에 오신 것을 환영합니다. 오늘은 무엇을 주문하시겠습니까. 많은 옵션이 있습니다. 뜨거운 음료나 차가운 음료를 선택할 수 있습니다. 우리의 특별 커피는 매우 인기가 많습니다. 한번 드셔보시겠습니까. 맛있는 페이스트리도 있습니다. 메뉴를 보세요. 선택하는 것을 도와드리겠습니다.",
        sentences: [
          { order: 1, text: "커피숍에 오신 것을 환영합니다.", zhTw: "歡迎來到咖啡店。" },
          { order: 2, text: "오늘은 무엇을 주문하시겠습니까.", zhTw: "您今天想點什麼？" },
          { order: 3, text: "많은 옵션이 있습니다.", zhTw: "我們有很多選擇。" },
          { order: 4, text: "뜨거운 음료나 차가운 음료를 선택할 수 있습니다.", zhTw: "您可以選擇熱飲或冷飲。" },
          { order: 5, text: "우리의 특별 커피는 매우 인기가 많습니다.", zhTw: "我們的特製咖啡很受歡迎。" },
          { order: 6, text: "한번 드셔보시겠습니까.", zhTw: "您想試試看嗎？" },
          { order: 7, text: "맛있는 페이스트리도 있습니다.", zhTw: "我們還有美味的糕點。" },
          { order: 8, text: "메뉴를 보세요.", zhTw: "請看看我們的菜單。" },
          { order: 9, text: "선택하는 것을 도와드리겠습니다.", zhTw: "我很樂意幫您決定。" },
        ],
        keyVocabulary: [
          { surfaceText: "주문", lemma: "주문", reason: "Common verb for ordering" },
          { surfaceText: "옵션", lemma: "옵션", reason: "Important noun for options" },
          { surfaceText: "인기", lemma: "인기", reason: "Common noun for popularity" },
          { surfaceText: "맛있는", lemma: "맛있는", reason: "Essential adjective for food" },
          { surfaceText: "메뉴", lemma: "메뉴", reason: "Essential noun for restaurants" },
        ],
        questions: [
          {
            type: "multiple_choice",
            question: "커피숍에서 무엇을 선택할 수 있습니까.",
            options: ["뜨거운 음료나 차가운 음료", "뜨거운 음료만", "차가운 음료만", "음료 없음"],
            answer: "뜨거운 음료나 차가운 음료",
            explanationZhTw: "文中提到可以選擇熱飲或冷飲。",
          },
          {
            type: "true_false",
            question: "특별 커피는 인기가 없습니다.",
            options: ["예", "아니오"],
            answer: "아니오",
            explanationZhTw: "文中說特製咖啡很受歡迎，所以這是錯的。",
          },
          {
            type: "fill_in_blank",
            question: "___를 보세요.",
            options: ["메뉴", "커피", "주문", "숍"],
            answer: "메뉴",
            explanationZhTw: "文中說請看看菜單。",
          },
        ],
      },
      it: {
        title: "Ordinare un caffè",
        titleZhTw: "在咖啡店點餐",
        difficultyLevel: options.difficultyLevel,
        topicCategory: options.topicCategory,
        articleText: "Benvenuti al caffè. Cosa vorreste ordinare oggi? Abbiamo molte opzioni disponibili. Potete scegliere bevande calde o fredde. Il nostro caffè speciale è molto popolare. Vorreste provarlo? Abbiamo anche deliziosi pasticcini. Date un'occhiata al nostro menu. Sarò felice di aiutarvi a scegliere.",
        sentences: [
          { order: 1, text: "Benvenuti al caffè.", zhTw: "歡迎來到咖啡店。" },
          { order: 2, text: "Cosa vorreste ordinare oggi?", zhTw: "您今天想點什麼？" },
          { order: 3, text: "Abbiamo molte opzioni disponibili.", zhTw: "我們有很多選擇。" },
          { order: 4, text: "Potete scegliere bevande calde o fredde.", zhTw: "您可以選擇熱飲或冷飲。" },
          { order: 5, text: "Il nostro caffè speciale è molto popolare.", zhTw: "我們的特製咖啡很受歡迎。" },
          { order: 6, text: "Vorreste provarlo?", zhTw: "您想試試看嗎？" },
          { order: 7, text: "Abbiamo anche deliziosi pasticcini.", zhTw: "我們還有美味的糕點。" },
          { order: 8, text: "Date un'occhiata al nostro menu.", zhTw: "請看看我們的菜單。" },
          { order: 9, text: "Sarò felice di aiutarvi a scegliere.", zhTw: "我很樂意幫您決定。" },
        ],
        keyVocabulary: [
          { surfaceText: "ordinare", lemma: "ordinare", reason: "Common verb for ordering" },
          { surfaceText: "disponibili", lemma: "disponibile", reason: "Important adjective for options" },
          { surfaceText: "popolare", lemma: "popolare", reason: "Common adjective for popularity" },
          { surfaceText: "deliziosi", lemma: "delizioso", reason: "Essential adjective for food" },
          { surfaceText: "menu", lemma: "menu", reason: "Essential noun for restaurants" },
        ],
        questions: [
          {
            type: "multiple_choice",
            question: "Cosa potete scegliere al caffè?",
            options: ["Bevande calde o fredde", "Solo bevande calde", "Solo bevande fredde", "Nessuna bevanda"],
            answer: "Bevande calde o fredde",
            explanationZhTw: "文中提到可以選擇熱飲或冷飲。",
          },
          {
            type: "true_false",
            question: "Il caffè speciale non è popolare.",
            options: ["Vero", "Falso"],
            answer: "Falso",
            explanationZhTw: "文中說特製咖啡很受歡迎，所以這是錯的。",
          },
          {
            type: "fill_in_blank",
            question: "Date un'occhiata al nostro ___.",
            options: ["menu", "caffè", "ordine", "caffè"],
            answer: "menu",
            explanationZhTw: "文中說請看看菜單。",
          },
        ],
      },
      es: {
        title: "Pedir café",
        titleZhTw: "在咖啡店點餐",
        difficultyLevel: options.difficultyLevel,
        topicCategory: options.topicCategory,
        articleText: "Bienvenidos a la cafetería. ¿Qué les gustaría pedir hoy? Tenemos muchas opciones disponibles. Pueden elegir bebidas calientes o frías. Nuestro café especial es muy popular. ¿Les gustaría probarlo? También tenemos deliciosos pasteles. Por favor, miren nuestro menú. Estaré feliz de ayudarles a decidir.",
        sentences: [
          { order: 1, text: "Bienvenidos a la cafetería.", zhTw: "歡迎來到咖啡店。" },
          { order: 2, text: "¿Qué les gustaría pedir hoy?", zhTw: "您今天想點什麼？" },
          { order: 3, text: "Tenemos muchas opciones disponibles.", zhTw: "我們有很多選擇。" },
          { order: 4, text: "Pueden elegir bebidas calientes o frías.", zhTw: "您可以選擇熱飲或冷飲。" },
          { order: 5, text: "Nuestro café especial es muy popular.", zhTw: "我們的特製咖啡很受歡迎。" },
          { order: 6, text: "¿Les gustaría probarlo?", zhTw: "您想試試看嗎？" },
          { order: 7, text: "También tenemos deliciosos pasteles.", zhTw: "我們還有美味的糕點。" },
          { order: 8, text: "Por favor, miren nuestro menú.", zhTw: "請看看我們的菜單。" },
          { order: 9, text: "Estaré feliz de ayudarles a decidir.", zhTw: "我很樂意幫您決定。" },
        ],
        keyVocabulary: [
          { surfaceText: "pedir", lemma: "pedir", reason: "Common verb for ordering" },
          { surfaceText: "disponibles", lemma: "disponible", reason: "Important adjective for options" },
          { surfaceText: "popular", lemma: "popular", reason: "Common adjective for popularity" },
          { surfaceText: "deliciosos", lemma: "delicioso", reason: "Essential adjective for food" },
          { surfaceText: "menú", lemma: "menú", reason: "Essential noun for restaurants" },
        ],
        questions: [
          {
            type: "multiple_choice",
            question: "¿Qué pueden elegir en la cafetería?",
            options: ["Bebidas calientes o frías", "Solo bebidas calientes", "Solo bebidas frías", "Ninguna bebida"],
            answer: "Bebidas calientes o frías",
            explanationZhTw: "文中提到可以選擇熱飲或冷飲。",
          },
          {
            type: "true_false",
            question: "El café especial no es popular.",
            options: ["Verdadero", "Falso"],
            answer: "Falso",
            explanationZhTw: "文中說特製咖啡很受歡迎，所以這是錯的。",
          },
          {
            type: "fill_in_blank",
            question: "Por favor, miren nuestro ___.",
            options: ["menú", "café", "pedido", "cafetería"],
            answer: "menú",
            explanationZhTw: "文中說請看看菜單。",
          },
        ],
      },
    };

    return mockResponses[options.languageCode] as GeminiArticleResponse;
  }
}

// 單例
export const articleGenerationService = new ArticleGenerationService();
