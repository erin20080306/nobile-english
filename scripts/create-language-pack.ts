#!/usr/bin/env node
/**
 * Language Content Pack 建立方式
 * 
 * 將場景相關的單字卡、片語卡、音檔等打包成語言內容包
 * 供 App SQLite 預先下載
 * 
 * 使用方式：
 * pnpm create:pack --scene=<sceneId> --language=en
 * pnpm create:pack --all
 */

import { createClient } from '@supabase/supabase-js';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdir } from 'fs/promises';

interface ContentPack {
  id: string;
  language_code: string;
  pack_version: number;
  pack_type: 'basic' | 'intermediate' | 'advanced' | 'premium';
  scene_ids: string[];
  dictionary_entry_count: number;
  audio_manifest: any;
  download_url: string;
  file_size_bytes: number;
  is_required: boolean;
  released_at: string;
  created_at: string;
  updated_at: string;
}

class LanguagePackCreator {
  private supabase: any;
  private outputDir: string;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    this.outputDir = join(process.cwd(), 'data', 'language-packs');
  }

  async createPack(
    sceneId: string,
    language: string
  ): Promise<ContentPack> {
    console.log(`\n=== Creating language pack for ${sceneId} (${language}) ===\n`);

    // 1. 獲取場景相關資料
    const vocabularyData = await this.getSceneVocabulary(sceneId, language);
    const lexemeLinks = await this.getSceneLexemeLinks(sceneId, language);
    const audioManifest = await this.getAudioManifest(sceneId, language);

    // 2. 建立內容包
    const pack: ContentPack = {
      id: `pack_${sceneId}_${language}`,
      language_code: language,
      pack_version: 1,
      pack_type: 'basic',
      scene_ids: [sceneId],
      dictionary_entry_count: vocabularyData.length,
      audio_manifest: audioManifest,
      download_url: '', // 稍後設定
      file_size_bytes: 0, // 稍後計算
      is_required: false,
      released_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 3. 寫入本地檔案
    await this.writePackFile(pack, vocabularyData, lexemeLinks);

    // 4. 上傳到 Supabase
    await this.uploadPackToSupabase(pack);

    console.log(`✓ Language pack created: ${pack.id}`);
    return pack;
  }

  async createAllPacks(): Promise<ContentPack[]> {
    const languages = ['en', 'ja', 'ko', 'it', 'es'];
    const packs: ContentPack[] = [];

    // 獲取所有已發布場景
    const { data: scenes } = await this.supabase
      .from('scenes')
      .select('id')
      .eq('status', 'published');

    for (const scene of scenes || []) {
      for (const language of languages) {
        try {
          const pack = await this.createPack(scene.id, language);
          packs.push(pack);
        } catch (error) {
          console.error(`Failed to create pack for ${scene.id} (${language}):`, error);
        }
      }
    }

    return packs;
  }

  private async getSceneVocabulary(sceneId: string, language: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('scene_lexeme_links')
      .select('dictionary_entry_id')
      .eq('scene_id', sceneId)
      .eq('language_code', language);

    if (error) {
      throw new Error(`Failed to fetch vocabulary: ${error.message}`);
    }

    const entryIdSet = new Set((data || []).map((item: any) => item.dictionary_entry_id).filter(Boolean));
    const entryIds = Array.from(entryIdSet);

    if (entryIds.length === 0) {
      return [];
    }

    const { data: entries } = await this.supabase
      .from('dictionary_entries')
      .select('*')
      .in('id', entryIds);

    return entries || [];
  }

  private async getSceneLexemeLinks(sceneId: string, language: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('scene_lexeme_links')
      .select('*')
      .eq('scene_id', sceneId)
      .eq('language_code', language);

    if (error) {
      throw new Error(`Failed to fetch lexeme links: ${error.message}`);
    }

    return data || [];
  }

  private async getAudioManifest(sceneId: string, language: string): Promise<any> {
    // 獲取場景相關音檔 manifest
    // 暫時返回空物件
    return {
      tutor_audio: [],
      word_audio: [],
      phrase_audio: [],
    };
  }

  private async writePackFile(
    pack: ContentPack,
    vocabularyData: any[],
    lexemeLinks: any[]
  ): Promise<void> {
    await mkdir(this.outputDir, { recursive: true });

    const packData = {
      metadata: pack,
      vocabulary: vocabularyData,
      lexeme_links: lexemeLinks,
    };

    const filePath = join(this.outputDir, `${pack.id}.json`);
    await writeFile(filePath, JSON.stringify(packData, null, 2));

    console.log(`✓ Pack file written: ${filePath}`);
  }

  private async uploadPackToSupabase(pack: ContentPack): Promise<void> {
    const { error } = await this.supabase
      .from('language_content_packs')
      .insert(pack);

    if (error) {
      throw new Error(`Failed to upload pack to Supabase: ${error.message}`);
    }

    console.log(`✓ Pack uploaded to Supabase: ${pack.id}`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const sceneFlag = args.find(arg => arg.startsWith('--scene='));
  const languageFlag = args.find(arg => arg.startsWith('--language='));
  const allFlag = args.includes('--all');

  const creator = new LanguagePackCreator();

  if (allFlag) {
    const packs = await creator.createAllPacks();
    console.log(`\n=== Created ${packs.length} language packs ===`);
  } else if (sceneFlag && languageFlag) {
    const sceneId = sceneFlag.split('=')[1];
    const language = languageFlag.split('=')[1];
    const pack = await creator.createPack(sceneId, language);
    console.log(`\n=== Created pack: ${pack.id} ===`);
  } else {
    console.log('Usage:');
    console.log('  pnpm create:pack --scene=<sceneId> --language=en');
    console.log('  pnpm create:pack --all');
  }
}

main().catch(console.error);
