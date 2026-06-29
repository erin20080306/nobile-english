import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 場景發布時自動預熱單字卡 API
 * 
 * 當場景發布時，自動觸發單字卡預熱流程
 * POST /api/scenes/prewarm
 * 
 * Body:
 * {
 *   sceneId: string
 * }
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sceneId } = body;

    if (!sceneId) {
      return NextResponse.json(
        { error: 'sceneId is required' },
        { status: 400 }
      );
    }

    // 1. 驗證場景存在
    const { data: scene, error: sceneError } = await supabase
      .from('scenes')
      .select('*')
      .eq('id', sceneId)
      .single();

    if (sceneError || !scene) {
      return NextResponse.json(
        { error: 'Scene not found' },
        { status: 404 }
      );
    }

    // 2. 檢查場景狀態
    if (scene.status !== 'published') {
      return NextResponse.json(
        { error: 'Scene must be published to prewarm vocabulary' },
        { status: 400 }
      );
    }

    // 3. 觸發預熱流程
    const prewarmResult = await triggerPrewarm(sceneId);

    return NextResponse.json({
      success: true,
      sceneId,
      prewarmResult,
    });
  } catch (error) {
    console.error('Prewarm error:', error);
    return NextResponse.json(
      { error: 'Failed to prewarm vocabulary' },
      { status: 500 }
    );
  }
}

async function triggerPrewarm(sceneId: string): Promise<any> {
  // 這裡可以呼叫預熱 script 或直接實作預熱邏輯
  // 為了簡化，這裡提供基本實作

  const languages = ['en', 'ja', 'ko', 'it', 'es'];
  const results: any[] = [];

  for (const language of languages) {
    const result = await prewarmSceneLanguage(sceneId, language);
    results.push(result);
  }

  return {
    languages: results,
    totalWords: results.reduce((sum, r) => sum + r.wordCount, 0),
    totalPhrases: results.reduce((sum, r) => sum + r.phraseCount, 0),
  };
}

async function prewarmSceneLanguage(sceneId: string, language: string): Promise<any> {
  // 1. 獲取場景句子
  const { data: sentences, error: sentencesError } = await supabase
    .from('scene_sentences')
    .select('id, text')
    .eq('scene_id', sceneId)
    .eq('language_code', language);

  if (sentencesError) {
    throw new Error(`Failed to fetch sentences for ${language}`);
  }

  // 2. 提取單字和片語
  const words = extractWordsAndPhrases(sentences || [], language);

  // 3. 建立詞形索引
  const lexemeLinks = buildLexemeLinks(sceneId, language, sentences || [], words);

  // 4. 寫入 scene_lexeme_links
  const { error: insertError } = await supabase
    .from('scene_lexeme_links')
    .insert(lexemeLinks);

  if (insertError) {
    console.error(`Failed to insert lexeme links for ${language}:`, insertError);
  }

  return {
    language,
    wordCount: words.length,
    phraseCount: words.filter(w => w.isPhrase).length,
    sentenceCount: sentences?.length || 0,
  };
}

function extractWordsAndPhrases(sentences: any[], language: string): any[] {
  const words: any[] = [];

  for (const sentence of sentences) {
    const text = sentence.text;
    const tokens = text.split(/\s+/);

    for (const token of tokens) {
      words.push({
        word: token,
        lemma: token.toLowerCase(),
        isPhrase: false,
      });
    }
  }

  return words;
}

function buildLexemeLinks(sceneId: string, language: string, sentences: any[], words: any[]): any[] {
  const links: any[] = [];
  let sentenceIndex = 0;

  for (const sentence of sentences) {
    const text = sentence.text;
    let currentIndex = 0;

    for (const word of words) {
      const startIndex = text.indexOf(word.word, currentIndex);
      if (startIndex !== -1) {
        const endIndex = startIndex + word.word.length;

        links.push({
          id: `lexeme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          scene_id: sceneId,
          scene_version: 1,
          language_code: language,
          sentence_id: sentence.id,
          start_index: startIndex,
          end_index: endIndex,
          display_text: word.word,
          dictionary_entry_id: null,
          phrase_priority: word.isPhrase ? 10 : 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        currentIndex = endIndex;
      }
    }

    sentenceIndex++;
  }

  return links;
}
