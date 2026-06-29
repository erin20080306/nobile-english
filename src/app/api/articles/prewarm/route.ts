import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 文章預存流程 API
 * 
 * POST /api/articles/prewarm
 * 
 * Body:
 * {
 *   articleId: string
 * }
 * 
 * 預存流程：
 * 1. 提取片語與單字
 * 2. 建立 reading_article_lexeme_links
 * 3. 預熱單字卡與片語卡
 * 4. 預生成文章句子語音
 */

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase environment variables not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await request.json();
    const { articleId } = body;

    if (!articleId) {
      return NextResponse.json(
        { error: 'articleId is required' },
        { status: 400 }
      );
    }

    // 1. 取得文章資訊
    const { data: article, error: articleError } = await supabase
      .from('reading_articles')
      .select('*')
      .eq('id', articleId)
      .single();

    if (articleError || !article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    // 2. 取得文章句子
    const { data: sentences, error: sentencesError } = await supabase
      .from('reading_article_sentences')
      .select('*')
      .eq('article_id', articleId)
      .order('sentence_order');

    if (sentencesError || !sentences) {
      return NextResponse.json(
        { error: 'Failed to fetch sentences' },
        { status: 500 }
      );
    }

    // 3. 建立詞形連結
    const lexemeLinks = await buildLexemeLinks(
      supabase,
      articleId,
      article.language_code,
      sentences
    );

    // 4. 預熱單字卡與片語卡
    const prewarmResult = await prewarmVocabularyCards(
      supabase,
      articleId,
      article.language_code,
      lexemeLinks
    );

    // 5. 預生成文章句子語音
    const audioResult = await prewarmArticleAudio(
      supabase,
      articleId,
      article.language_code,
      sentences
    );

    return NextResponse.json({
      success: true,
      articleId,
      lexemeLinksCount: lexemeLinks.length,
      prewarmResult,
      audioResult,
    });
  } catch (error) {
    console.error('Article prewarm error:', error);
    return NextResponse.json(
      { error: 'Failed to prewarm article' },
      { status: 500 }
    );
  }
}

async function buildLexemeLinks(
  supabase: any,
  articleId: string,
  languageCode: string,
  sentences: any[]
): Promise<any[]> {
  const links: any[] = [];

  for (const sentence of sentences) {
    const text = sentence.sentence_text;
    const wordsAndPhrases = extractWordsAndPhrases(text, languageCode);

    for (const item of wordsAndPhrases) {
      // 查詢字典條目
      const { data: dictionaryEntry } = await supabase
        .from('dictionary_entries')
        .select('id')
        .eq('lemma', item.lemma)
        .eq('language_code', languageCode)
        .limit(1)
        .maybeSingle();

      const link = {
        id: `lexeme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        article_id: articleId,
        sentence_id: sentence.id,
        language_code: languageCode,
        start_index: item.startIndex,
        end_index: item.endIndex,
        display_text: item.text,
        dictionary_entry_id: dictionaryEntry?.id || null,
        phrase_priority: item.isPhrase ? 10 : 0,
      };

      const { error: insertError } = await supabase
        .from('reading_article_lexeme_links')
        .insert(link);

      if (!insertError) {
        links.push(link);
      }
    }
  }

  return links;
}

function extractWordsAndPhrases(text: string, languageCode: string): any[] {
  const items: any[] = [];
  const words = text.split(/\s+/);
  let currentIndex = 0;

  // 簡單實作：先提取單字，片語需要更複雜的 NLP
  for (const word of words) {
    const startIndex = text.indexOf(word, currentIndex);
    if (startIndex !== -1) {
      items.push({
        text: word,
        lemma: word.toLowerCase(),
        isPhrase: false,
        startIndex,
        endIndex: startIndex + word.length,
      });
      currentIndex = startIndex + word.length;
    }
  }

  // TODO: 實作片語提取（需要更複雜的 NLP）
  // 可以使用既有片語庫進行匹配

  return items;
}

async function prewarmVocabularyCards(
  supabase: any,
  articleId: string,
  languageCode: string,
  lexemeLinks: any[]
): Promise<any> {
  let cardsCreated = 0;
  let cardsCached = 0;

  for (const link of lexemeLinks) {
    if (!link.dictionary_entry_id) {
      // 如果沒有對應的字典條目，可以選擇建立新的
      continue;
    }

    // 檢查是否已有快取
    const { data: existingCard } = await supabase
      .from('cached_dictionary_entries')
      .select('id')
      .eq('id', link.dictionary_entry_id)
      .maybeSingle();

    if (existingCard) {
      cardsCached++;
      continue;
    }

    // 從字典條目建立快取
    const { data: dictionaryEntry } = await supabase
      .from('dictionary_entries')
      .select('*')
      .eq('id', link.dictionary_entry_id)
      .single();

    if (dictionaryEntry) {
      const { error: insertError } = await supabase
        .from('cached_dictionary_entries')
        .insert({
          id: dictionaryEntry.id,
          lemma: dictionaryEntry.lemma,
          language_code: dictionaryEntry.language_code,
          part_of_speech: dictionaryEntry.part_of_speech,
          phonetic: dictionaryEntry.phonetic,
          definition_zh_tw: dictionaryEntry.definition_zh_tw,
          example_sentence: dictionaryEntry.example_sentence,
          example_zh_tw: dictionaryEntry.example_zh_tw,
          cached_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 天
        });

      if (!insertError) {
        cardsCreated++;
      }
    }
  }

  return {
    cardsCreated,
    cardsCached,
  };
}

async function prewarmArticleAudio(
  supabase: any,
  articleId: string,
  languageCode: string,
  sentences: any[]
): Promise<any> {
  let audioCreated = 0;
  let audioCached = 0;
  let audioFailed = 0;

  for (const sentence of sentences) {
    // 檢查是否已有音檔
    const { data: existingAudio } = await supabase
      .from('reading_article_audio_assets')
      .select('*')
      .eq('article_id', articleId)
      .eq('sentence_id', sentence.id)
      .eq('language_code', languageCode)
      .maybeSingle();

    if (existingAudio && existingAudio.status === 'ready') {
      audioCached++;
      continue;
    }

    // 呼叫 TTS get-or-create API
    try {
      const ttsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/tts/get-or-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sentence.sentence_text,
          languageCode: languageCode,
          assetType: 'reading_sentence',
        }),
      });

      if (ttsResponse.ok) {
        const ttsData = await ttsResponse.json();

        // 建立或更新音檔記錄
        const audioData = {
          article_id: articleId,
          sentence_id: sentence.id,
          language_code: languageCode,
          tts_asset_id: ttsData.id,
          audio_path: ttsData.signedUrl,
          duration_ms: sentence.estimated_duration_ms,
          audio_version: 1,
          status: 'ready',
        };

        if (existingAudio) {
          await supabase
            .from('reading_article_audio_assets')
            .update(audioData)
            .eq('id', existingAudio.id);
        } else {
          await supabase
            .from('reading_article_audio_assets')
            .insert(audioData);
        }

        audioCreated++;
      } else {
        audioFailed++;
      }
    } catch (error) {
      console.error('Failed to generate TTS for sentence:', error);
      audioFailed++;
    }
  }

  return {
    audioCreated,
    audioCached,
    audioFailed,
  };
}
