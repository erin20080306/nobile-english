#!/usr/bin/env tsx
/**
 * Audio Reprocess CLI Tool
 * 
 * Usage:
 * pnpm audio:reprocess --asset=<assetId>
 * pnpm audio:reprocess --scene=<sceneId>
 * pnpm audio:reprocess --all --dry-run
 * pnpm audio:reprocess --all --confirm
 * pnpm audio:quality-report
 */

import { createClient } from '@supabase/supabase-js';
import { processAudioToV2Loud, getAudioMetrics } from '../src/server/tts/audioPostProcessor';

const args = process.argv.slice(2);
const flags: Record<string, string> = {};

args.forEach(arg => {
  const [key, value] = arg.split('=');
  flags[key.replace('--', '')] = value;
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase environment variables not configured');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  if (flags['quality-report']) {
    await generateQualityReport();
  } else {
    await reprocessAudio();
  }
}

async function reprocessAudio() {
  const { assetId, sceneId, all, dryRun, confirm } = flags;
  const dryRunBool = dryRun === 'true';
  const confirmBool = confirm === 'true';

  if (!assetId && !sceneId && !all) {
    console.error('Must provide --asset, --scene, or --all');
    console.log('Usage: pnpm audio:reprocess --asset=<id> | --scene=<id> | --all [--dry-run] [--confirm]');
    process.exit(1);
  }

  if (all && !dryRunBool && !confirmBool) {
    console.error('--all requires --dry-run or --confirm for safety');
    process.exit(1);
  }

  let assets: any[] = [];

  if (assetId) {
    const { data: asset, error } = await supabase
      .from('tts_audio_assets')
      .select('*')
      .eq('id', assetId)
      .single();

    if (error || !asset) {
      console.error('Asset not found');
      process.exit(1);
    }
    assets = [asset];
  } else if (sceneId) {
    const { data: sceneAssets, error } = await supabase
      .from('tts_audio_assets')
      .select('*')
      .eq('scene_id', sceneId);

    if (error) {
      console.error('Failed to fetch scene assets');
      process.exit(1);
    }
    assets = sceneAssets || [];
  } else if (all) {
    const { data: allAssets, error } = await supabase
      .from('tts_audio_assets')
      .select('*')
      .eq('audio_version_string', 'v1')
      .eq('status', 'ready');

    if (error) {
      console.error('Failed to fetch assets');
      process.exit(1);
    }
    assets = allAssets || [];
  }

  console.log(`Found ${assets.length} assets to ${dryRunBool ? 'check' : 'reprocess'}`);

  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const asset of assets) {
    const result = await reprocessAsset(asset, dryRunBool);
    
    if (result.status === 'success') {
      successCount++;
      console.log(`✅ ${asset.id}: ${result.status}`);
    } else if (result.status === 'skipped') {
      skippedCount++;
      console.log(`⏭️  ${asset.id}: ${result.reason}`);
    } else if (result.status === 'dry_run') {
      console.log(`🔍 ${asset.id}: ${JSON.stringify(result.currentMetrics)}`);
    } else {
      failedCount++;
      console.log(`❌ ${asset.id}: ${result.error || result.reason}`);
    }
  }

  console.log(`\nSummary: ${successCount} success, ${skippedCount} skipped, ${failedCount} failed`);
}

async function reprocessAsset(asset: any, dryRun: boolean): Promise<any> {
  try {
    if (asset.audio_version_string === 'v2_loud' && asset.processing_status === 'ready') {
      return {
        status: 'skipped',
        reason: 'Already v2_loud',
      };
    }

    if (!asset.raw_audio_path && !asset.audio_path) {
      return {
        status: 'failed',
        reason: 'No raw audio path',
      };
    }

    const rawPath = asset.raw_audio_path || asset.audio_path;

    if (dryRun) {
      const metrics = await getAudioMetrics(rawPath);
      return {
        status: 'dry_run',
        currentMetrics: metrics,
        wouldProcess: true,
      };
    }

    await supabase
      .from('tts_audio_assets')
      .update({
        processing_status: 'processing',
        processing_error: null,
      })
      .eq('id', asset.id);

    const processedPath = rawPath.replace(/\.[^.]+$/, '_v2_loud.m4a');
    const result = await processAudioToV2Loud(rawPath, processedPath, asset.text_hash);

    if (!result.success) {
      await supabase
        .from('tts_audio_assets')
        .update({
          processing_status: 'failed',
          processing_error: result.error,
        })
        .eq('id', asset.id);

      return {
        status: 'failed',
        error: result.error,
      };
    }

    await supabase
      .from('tts_audio_assets')
      .update({
        raw_audio_path: rawPath,
        processed_audio_path: result.processedPath,
        audio_version_string: 'v2_loud',
        integrated_lufs: result.integratedLufs,
        true_peak_dbtp: result.truePeakDbtp,
        loudness_range_lu: result.loudnessRangeLu,
        processing_status: 'ready',
        processed_at: new Date().toISOString(),
      })
      .eq('id', asset.id);

    return {
      status: 'success',
      processedPath: result.processedPath,
      metrics: {
        integratedLufs: result.integratedLufs,
        truePeakDbtp: result.truePeakDbtp,
        loudnessRangeLu: result.loudnessRangeLu,
      },
    };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function generateQualityReport() {
  const { data: assets, error } = await supabase
    .from('tts_audio_assets')
    .select('*')
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Failed to fetch assets');
    process.exit(1);
  }

  console.log('Audio Quality Report');
  console.log('====================');
  console.log(`Total assets: ${assets?.length || 0}\n`);

  const byLanguage: Record<string, any[]> = {};
  const byVersion: Record<string, any[]> = {};

  for (const asset of assets || []) {
    if (!byLanguage[asset.language_code]) {
      byLanguage[asset.language_code] = [];
    }
    byLanguage[asset.language_code].push(asset);

    if (!byVersion[asset.audio_version_string]) {
      byVersion[asset.audio_version_string] = [];
    }
    byVersion[asset.audio_version_string].push(asset);
  }

  console.log('By Language:');
  for (const [lang, langAssets] of Object.entries(byLanguage)) {
    const v2LoudCount = langAssets.filter((a: any) => a.audio_version_string === 'v2_loud').length;
    console.log(`  ${lang}: ${langAssets.length} total (${v2LoudCount} v2_loud)`);
  }

  console.log('\nBy Version:');
  for (const [version, versionAssets] of Object.entries(byVersion)) {
    const avgLufs = versionAssets.reduce((sum: number, a: any) => sum + (a.integrated_lufs || 0), 0) / versionAssets.length;
    const avgPeak = versionAssets.reduce((sum: number, a: any) => sum + (a.true_peak_dbtp || 0), 0) / versionAssets.length;
    console.log(`  ${version}: ${versionAssets.length} assets (avg LUFS: ${avgLufs.toFixed(1)}, avg Peak: ${avgPeak.toFixed(1)})`);
  }

  console.log('\nSample Assets:');
  for (const asset of (assets || []).slice(0, 10)) {
    console.log(`  ${asset.id.substring(0, 8)}... ${asset.language_code} ${asset.audio_version_string} LUFS: ${asset.integrated_lufs || 'N/A'} Peak: ${asset.true_peak_dbtp || 'N/A'}`);
  }
}

main().catch(console.error);
