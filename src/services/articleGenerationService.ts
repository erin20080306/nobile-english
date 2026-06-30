import type { ArticleQuestionType, CEFRLevel, GeminiArticleResponse, LearningLanguageCode } from "@/types";

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

const NAMES: Record<LearningLanguageCode, string> = {
  en: "English", ja: "Japanese", ko: "Korean", it: "Italian", es: "Spanish",
};
const QUESTION_TYPES = new Set<ArticleQuestionType>([
  "multiple_choice", "sentence_order", "word_match", "true_false", "fill_in_blank",
]);

function stringValue(value: unknown): string {
  return String(value || "").trim();
}

function parseJson(text: string): unknown {
  const source = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Gemini returned invalid JSON");
  return JSON.parse(source.slice(start, end + 1));
}

class ArticleGenerationService {
  async generateArticle(options: ArticleGenerationOptions): Promise<GeminiArticleResponse> {
    const constraints = {
      maxCharacters: options.maxCharacters ?? 800,
      minSentences: options.minSentences ?? 6,
      maxSentences: options.maxSentences ?? 10,
      minQuestions: options.minQuestions ?? 3,
      maxQuestions: options.maxQuestions ?? 5,
    };
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
    const prompt = this.prompt(options, constraints);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.35, responseMimeType: "application/json" },
        }),
      }
    );
    if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);

    const payload = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
    return this.validate(parseJson(text), options, constraints);
  }

  private prompt(options: ArticleGenerationOptions, c: { maxCharacters: number; minSentences: number; maxSentences: number; minQuestions: number; maxQuestions: number }): string {
    const language = NAMES[options.languageCode];
    return `Create an original evergreen ${language} learning article. Topic key: ${options.topicKey}. Topic: ${options.topicTitleZhTw}. Category: ${options.topicCategory}. CEFR: ${options.difficultyLevel}.\nReturn only JSON with title, titleZhTw, articleText, sentences, keyVocabulary, questions.\nUse ${c.minSentences}-${c.maxSentences} short sentences, each with order, text, zhTw. Use ${c.minQuestions}-${c.maxQuestions} questions, each with type, question, options, answer, explanationZhTw. The article must be no more than ${c.maxCharacters} characters. Do not use web search or current news. Do not include text outside JSON.`;
  }

  private validate(raw: unknown, options: ArticleGenerationOptions, c: { maxCharacters: number; minSentences: number; maxSentences: number; minQuestions: number; maxQuestions: number }): GeminiArticleResponse {
    const data = raw as Record<string, unknown>;
    const sentences = Array.isArray(data.sentences) ? data.sentences.map((row) => {
      const value = row as Record<string, unknown>;
      return { order: Number(value.order), text: stringValue(value.text), zhTw: stringValue(value.zhTw) };
    }).filter((row) => Number.isInteger(row.order) && row.order > 0 && row.text && row.zhTw).sort((a, b) => a.order - b.order) : [];

    const questions = Array.isArray(data.questions) ? data.questions.map((row) => {
      const value = row as Record<string, unknown>;
      const optionsList = Array.isArray(value.options) ? value.options.map(stringValue).filter(Boolean) : [];
      return {
        type: stringValue(value.type) as ArticleQuestionType,
        question: stringValue(value.question),
        options: optionsList,
        answer: stringValue(value.answer),
        explanationZhTw: stringValue(value.explanationZhTw),
      };
    }).filter((q) => QUESTION_TYPES.has(q.type) && q.question && q.options.length >= 2 && q.options.includes(q.answer) && q.explanationZhTw) : [];

    const title = stringValue(data.title);
    const titleZhTw = stringValue(data.titleZhTw);
    const articleText = stringValue(data.articleText);
    const expectedOrder = Array.from({ length: sentences.length }, (_, index) => index + 1).join(",");
    if (!title || !titleZhTw || !articleText) throw new Error("Generated article is incomplete");
    if (Array.from(articleText).length > c.maxCharacters) throw new Error("Generated article exceeds character limit");
    if (sentences.length < c.minSentences || sentences.length > c.maxSentences || sentences.map((s) => s.order).join(",") !== expectedOrder) {
      throw new Error("Generated article has invalid sentences");
    }
    if (questions.length < c.minQuestions || questions.length > c.maxQuestions) throw new Error("Generated article has invalid questions");

    const keyVocabulary = Array.isArray(data.keyVocabulary) ? data.keyVocabulary.map((row) => {
      const value = row as Record<string, unknown>;
      return { surfaceText: stringValue(value.surfaceText), lemma: stringValue(value.lemma), reason: stringValue(value.reason) };
    }).filter((word) => word.surfaceText && word.lemma).slice(0, 12) : [];

    return {
      title,
      titleZhTw,
      difficultyLevel: options.difficultyLevel,
      topicCategory: options.topicCategory,
      articleText,
      sentences,
      keyVocabulary,
      questions,
    };
  }
}

export const articleGenerationService = new ArticleGenerationService();
