import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processAudioToV2Loud, getAudioMetrics } from '@/server/tts/audioPostProcessor';

/**
 * Admin Audio Reprocess API
 * 
 * POST /api/admin/audio/reprocess
 * 
 * Body:
 * {
 *   assetId?: string
 *   sceneId?: string
 *   reprocessAll?: boolean
 *   dryRun?: boolean
 * }
 * 
 * Reprocess existing TTS audio assets to v2_loud standards
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
    const { assetId, sceneId, reprocessAll, dryRun = false } = body;

    if (!assetId && !sceneId && !reprocessAll) {
      return NextResponse.json(
        { error: 'Must provide assetId, sceneId, or reprocessAll=true' },
        { status: 400 }
      );
    }

    if (reprocessAll && !dryRun) {
      return NextResponse.json(
        { error: 'reprocessAll=true requires dryRun=true for safety' },
        { status: 400 }
      );
    }

    let assets: any[] = [];

    if (assetId) {
      const { data: asset, error } = await supabase
        .from('tts_audio_assets')
        .select('*')
        .eq('id', assetId)
        .single();

      if (error || !asset) {
        return NextResponse.json(
          { error: 'Asset not found' },
          { status: 404 }
        );
      }
      assets = [asset];
    } else if (sceneId) {
      const { data: sceneAssets, error } = await supabase
        .from('tts_audio_assets')
        .select('*')
        .eq('scene_id', sceneId);

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch scene assets' },
          { status: 500 }
        );
      }
      assets = sceneAssets || [];
    } else if (reprocessAll) {
      const { data: allAssets, error } = await supabase
        .from('tts_audio_assets')
        .select('*')
        .eq('audio_version_string', 'v1')
        .eq('status', 'ready')
        .limit(100); // Limit for dry run

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch assets' },
          { status: 500 }
        );
      }
      assets = allAssets || [];
    }

    const results: any[] = [];

    for (const asset of assets) {
      const result = await reprocessAsset(supabase, asset, dryRun);
      results.push(result);
    }

    return NextResponse.json({
      success: true,
      dryRun,
      totalAssets: assets.length,
      results,
    });
  } catch (error) {
    console.error('Audio reprocess error:', error);
    return NextResponse.json(
      { error: 'Failed to reprocess audio' },
      { status: 500 }
    );
  }
}

async function reprocessAsset(
  supabase: any,
  asset: any,
  dryRun: boolean
): Promise<any> {
  try {
    // Check if already processed
    if (asset.audio_version_string === 'v2_loud' && asset.processing_status === 'ready') {
      return {
        assetId: asset.id,
        status: 'skipped',
        reason: 'Already v2_loud',
      };
    }

    // Check if raw audio exists
    if (!asset.raw_audio_path && !asset.audio_path) {
      return {
        assetId: asset.id,
        status: 'failed',
        reason: 'No raw audio path',
      };
    }

    const rawPath = asset.raw_audio_path || asset.audio_path;

    if (dryRun) {
      // Just check current metrics
      const metrics = await getAudioMetrics(rawPath);
      return {
        assetId: asset.id,
        status: 'dry_run',
        currentMetrics: metrics,
        wouldProcess: true,
      };
    }

    // Mark as processing
    await supabase
      .from('tts_audio_assets')
      .update({
        processing_status: 'processing',
        processing_error: null,
      })
      .eq('id', asset.id);

    // Process audio
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
        assetId: asset.id,
        status: 'failed',
        error: result.error,
      };
    }

    // Update asset with processed audio
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
      assetId: asset.id,
      status: 'success',
      processedPath: result.processedPath,
      metrics: {
        integratedLufs: result.integratedLufs,
        truePeakDbtp: result.truePeakDbtp,
        loudnessRangeLu: result.loudnessRangeLu,
      },
    };
  } catch (error) {
    console.error(`Failed to reprocess asset ${asset.id}:`, error);
    return {
      assetId: asset.id,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
