import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrCreateTtsAsset } from "@/server/tts/service";
import type { LearningLanguageCode } from "@/types";
import { getTaipeiDateString } from "./dates";

interface ReadingArticleRow {
  id: string;
  topic_id: string;
  language_code: LearningLanguageCode;
  status: string;
}

interface ReadingSentenceRow {
  id: string;
  sentence_order: number;
  sentence_text: string;
  estimated_duration_ms: number;
}

interface ExtractedTerm {
  text: string;
  lemma: string;
  startIndex: number;
  endIndex: number;
}

export interface ArticlePrewarmResult {
  articleId: string;
  languageCode: string;
  lexemeLinksCreated: number;
  audioCreated: number;
  audioCached: number;
  audioFailed: number;
  statusUpdated: boolean;
}

export interface ArticlesPrewarmSummary {
  success: boolean;
  publishDate: string;
  articleCount: number;
  results: ArticlePrewarmResult[];
}

const LANGUAGE_LOCALES: Record<string, string> = {
  en: "en",
  ja: "ja",
  ko: "ko",
  it: "it",
  es: "es",
};

function cleanToken(token: string): string {
  const chars = token.trim().split("");
  let start = 0;
  let end = chars.length - 1;
  while (start <= end && !isWordChar(chars[start])) start += 1;
  while (end >= start && !isWordChar(chars[end])) end -= 1;
  return chars.slice(start, end + 1).join("");
}

function normalizeLemma(token: string, languageCode: string): string {
  const cleaned = cleanToken(token);
  return languageCode === "ja" || languageCode === "ko" ? cleaned : cleaned.toLowerCase();
}

function extractWordsAndPhrases(text: string, languageCode: string): ExtractedTerm[] {
  const terms: ExtractedTerm[] = [];
  const seen = new Set<string>();
  const locale = LANGUAGE_LOCALES[languageCode] || "en";
  const segmenter =
    "Segmenter" in Intl
      ? new Intl.Segmenter(locale, { granularity: "word" })
      : null;

  if (segmenter) {
    const segments = Array.from(segmenter.segment(text));
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (!segment.isWordLike) continue;
      const cleaned = cleanToken(segment.segment);
      if (!cleaned) continue;
      const lemma = normalizeLemma(cleaned, languageCode);
      const key = `${lemma}:${segment.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      terms.push({
        text: cleaned,
        lemma,
        startIndex: segment.index,
        endIndex: segment.index + segment.segment.length,
      });
    }
    return terms.slice(0, 28);
  }

  let tokenStart = -1;
  for (let index = 0; index <= text.length; index += 1) {
    const char = text.charAt(index);
    const wordChar = Boolean(char) && isWordChar(char);
    const connector = Boolean(char) && isConnectorChar(char) && tokenStart >= 0;

    if (wordChar || connector) {
      if (tokenStart < 0) tokenStart = index;
      continue;
    }

    if (tokenStart < 0) continue;

    const rawToken = text.slice(tokenStart, index);
    const cleaned = cleanToken(rawToken);
    if (!cleaned) {
      tokenStart = -1;
      continue;
    }
    const lemma = normalizeLemma(cleaned, languageCode);
    const key = `${lemma}:${tokenStart}`;
    if (seen.has(key)) {
      tokenStart = -1;
      continue;
    }
    seen.add(key);
    terms.push({
      text: cleaned,
      lemma,
      startIndex: tokenStart,
      endIndex: tokenStart + rawToken.length,
    });
    tokenStart = -1;
  }

  return terms.slice(0, 28);
}

function isConnectorChar(char: string): boolean {
  return char === "'" || char === "’" || char === "-";
}

function isWordChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code >= 0x00c0 && code <= 0x024f) ||
    (code >= 0x3040 && code <= 0x30ff) ||
    (code >= 0x3400 && code <= 0x9fff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0x1100 && code <= 0x11ff) ||
    (code >= 0xff10 && code <= 0xff19) ||
    (code >= 0xff21 && code <= 0xff3a) ||
    (code >= 0xff41 && code <= 0xff5a)
  );
}

async function findDictionaryEntryId(
  supabase: SupabaseClient,
  languageCode: string,
  term: ExtractedTerm
): Promise<string | null> {
  const { data: byLemma } = await supabase
    .from("dictionary_entries")
    .select("id")
    .eq("language_code", languageCode)
    .eq("lemma", term.lemma)
    .order("frequency_rank", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (byLemma?.id) return byLemma.id as string;

  const { data: byDisplayWord } = await supabase
    .from("dictionary_entries")
    .select("id")
    .eq("language_code", languageCode)
    .eq("display_word", term.text)
    .order("frequency_rank", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  return (byDisplayWord?.id as string | undefined) || null;
}

async function buildLexemeLinks(
  supabase: SupabaseClient,
  article: ReadingArticleRow,
  sentences: ReadingSentenceRow[]
): Promise<number> {
  const links: Array<Record<string, unknown>> = [];

  await supabase
    .from("reading_article_lexeme_links")
    .delete()
    .eq("article_id", article.id);

  for (const sentence of sentences) {
    const terms = extractWordsAndPhrases(sentence.sentence_text, article.language_code);
    for (const term of terms) {
      const dictionaryEntryId = await findDictionaryEntryId(
        supabase,
        article.language_code,
        term
      );
      if (!dictionaryEntryId) continue;
      links.push({
        article_id: article.id,
        sentence_id: sentence.id,
        language_code: article.language_code,
        start_index: term.startIndex,
        end_index: term.endIndex,
        display_text: term.text,
        dictionary_entry_id: dictionaryEntryId,
        phrase_priority: 0,
      });
    }
  }

  if (links.length === 0) return 0;

  const { error } = await supabase.from("reading_article_lexeme_links").insert(links);
  if (error) throw new Error(`Failed to insert article lexeme links: ${error.message}`);
  return links.length;
}

async function prewarmArticleAudio(
  supabase: SupabaseClient,
  article: ReadingArticleRow,
  sentences: ReadingSentenceRow[],
  includeAudio: boolean
): Promise<{ audioCreated: number; audioCached: number; audioFailed: number }> {
  if (!includeAudio) return { audioCreated: 0, audioCached: 0, audioFailed: 0 };

  let audioCreated = 0;
  let audioCached = 0;
  let audioFailed = 0;

  for (const sentence of sentences) {
    const { data: existingAudio } = await supabase
      .from("reading_article_audio_assets")
      .select("id, status")
      .eq("article_id", article.id)
      .eq("sentence_id", sentence.id)
      .eq("language_code", article.language_code)
      .maybeSingle();

    if (existingAudio?.status === "ready") {
      audioCached += 1;
      continue;
    }

    try {
      const tts = await getOrCreateTtsAsset({
        text: sentence.sentence_text,
        languageCode: article.language_code,
        assetType: "reading_sentence",
      });
      const signedUrl = tts.signedUrl && !tts.signedUrl.startsWith("stub://") ? tts.signedUrl : null;

      const audioData = {
        article_id: article.id,
        sentence_id: sentence.id,
        language_code: article.language_code,
        tts_asset_id: null,
        audio_path: signedUrl,
        duration_ms: tts.asset.durationMs || sentence.estimated_duration_ms,
        audio_version: 1,
        status: signedUrl ? "ready" : "failed",
      };

      const { error } = await supabase
        .from("reading_article_audio_assets")
        .upsert(audioData, { onConflict: "article_id,sentence_id,language_code" });

      if (error || !signedUrl) audioFailed += 1;
      else audioCreated += 1;
    } catch {
      audioFailed += 1;
    }
  }

  return { audioCreated, audioCached, audioFailed };
}

export async function prewarmReadingArticle(
  supabase: SupabaseClient,
  articleId: string,
  options: { includeAudio?: boolean } = {}
): Promise<ArticlePrewarmResult> {
  const { data: article, error: articleError } = await supabase
    .from("reading_articles")
    .select("id, topic_id, language_code, status")
    .eq("id", articleId)
    .single();

  if (articleError || !article) {
    throw new Error(`Article not found: ${articleId}`);
  }

  const typedArticle = article as ReadingArticleRow;
  const { data: sentences, error: sentencesError } = await supabase
    .from("reading_article_sentences")
    .select("id, sentence_order, sentence_text, estimated_duration_ms")
    .eq("article_id", articleId)
    .order("sentence_order");

  if (sentencesError || !sentences) {
    throw new Error(`Failed to fetch article sentences: ${articleId}`);
  }

  const typedSentences = sentences as ReadingSentenceRow[];
  const lexemeLinksCreated = await buildLexemeLinks(supabase, typedArticle, typedSentences);
  const audio = await prewarmArticleAudio(
    supabase,
    typedArticle,
    typedSentences,
    options.includeAudio ?? true
  );

  let statusUpdated = false;
  if (typedArticle.status !== "published") {
    const { error: updateError } = await supabase
      .from("reading_articles")
      .update({ status: "ready" })
      .eq("id", articleId);
    statusUpdated = !updateError;
  }

  return {
    articleId,
    languageCode: typedArticle.language_code,
    lexemeLinksCreated,
    ...audio,
    statusUpdated,
  };
}

export async function prewarmReadingArticlesForDate(
  supabase: SupabaseClient,
  options: { publishDate?: string; includeAudio?: boolean } = {}
): Promise<ArticlesPrewarmSummary> {
  const publishDate = options.publishDate || getTaipeiDateString();
  const { data: topic, error: topicError } = await supabase
    .from("reading_article_topics")
    .select("id")
    .eq("publish_date", publishDate)
    .in("status", ["ready", "published"])
    .maybeSingle();

  if (topicError || !topic) {
    throw new Error(`No ready or published reading topic found for ${publishDate}`);
  }

  const { data: articles, error: articlesError } = await supabase
    .from("reading_articles")
    .select("id, topic_id, language_code, status")
    .eq("topic_id", topic.id);

  if (articlesError || !articles) {
    throw new Error(`Failed to fetch articles for ${publishDate}`);
  }

  const results: ArticlePrewarmResult[] = [];
  for (const article of articles as ReadingArticleRow[]) {
    results.push(
      await prewarmReadingArticle(supabase, article.id, {
        includeAudio: options.includeAudio ?? true,
      })
    );
  }

  return {
    success: true,
    publishDate,
    articleCount: results.length,
    results,
  };
}
