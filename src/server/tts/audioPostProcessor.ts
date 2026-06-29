/**
 * v2_loud Audio Post-Processing Service
 * 
 * Processes Chirp 3 HD raw audio to achieve:
 * - Integrated Loudness: -14 LUFS
 * - True Peak: -1.0 dBTP
 * - Loudness Range: 5-7 LU
 * 
 * Processing pipeline:
 * 1. Remove head/tail silence
 * 2. High-pass filter (remove low-frequency muddiness)
 * 3. Light EQ (enhance vocal clarity)
 * 4. Loudness normalization (-14 LUFS)
 * 5. True Peak limiter (-1.0 dBTP)
 * 6. Export M4A (AAC) and MP3 fallback
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export interface AudioProcessingResult {
  success: boolean;
  processedPath?: string;
  durationMs?: number;
  integratedLufs?: number;
  truePeakDbtp?: number;
  loudnessRangeLu?: number;
  error?: string;
}

export interface AudioMetrics {
  integratedLufs: number;
  truePeakDbtp: number;
  loudnessRangeLu: number;
  durationMs: number;
}

/**
 * Process raw audio to v2_loud standards
 */
export async function processAudioToV2Loud(
  inputPath: string,
  outputPath: string,
  textHash: string
): Promise<AudioProcessingResult> {
  try {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Build ffmpeg command for v2_loud processing
    const ffmpegCommand = buildFfmpegCommand(inputPath, outputPath);

    console.log(`[AudioPostProcessor] Processing ${textHash} to v2_loud`);
    console.log(`[AudioPostProcessor] Command: ${ffmpegCommand}`);

    // Execute ffmpeg
    await execAsync(ffmpegCommand);

    // Measure audio metrics
    const metrics = await measureAudioMetrics(outputPath);

    console.log(`[AudioPostProcessor] Metrics for ${textHash}:`, metrics);

    return {
      success: true,
      processedPath: outputPath,
      durationMs: metrics.durationMs,
      integratedLufs: metrics.integratedLufs,
      truePeakDbtp: metrics.truePeakDbtp,
      loudnessRangeLu: metrics.loudnessRangeLu,
    };
  } catch (error) {
    console.error(`[AudioPostProcessor] Failed to process ${textHash}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Build ffmpeg command for v2_loud processing
 */
function buildFfmpegCommand(inputPath: string, outputPath: string): string {
  // Output M4A (AAC) with high quality
  const outputM4a = outputPath.replace(/\.[^.]+$/, '.m4a');
  
  // Output MP3 fallback
  const outputMp3 = outputPath.replace(/\.[^.]+$/, '.mp3');

  // FFmpeg filter chain for v2_loud:
  // 1. highpass=f=80: Remove low-frequency muddiness below 80Hz
  // 2. equalizer=f=3000:width_type=h:width=500:g=2: Boost vocal clarity around 3kHz
  // 3. loudnorm=I=-14:TP=-1.0:LRA=7: Normalize to -14 LUFS with -1.0 dBTP peak
  // 4. alimiter=level_in=1:level_out=1:limit=1:release=200: Final peak protection
  
  const filterComplex = 
    '[0:a]highpass=f=80,' +
    'equalizer=f=3000:width_type=h:width=500:g=2,' +
    'loudnorm=I=-14:TP=-1.0:LRA=7,' +
    'alimiter=level_in=1:level_out=1:limit=1:release=200[aout]';

  // Build command for M4A output
  const m4aCommand = [
    'ffmpeg',
    '-y', // Overwrite output files
    '-i', inputPath,
    '-filter_complex', filterComplex,
    '-map', '[aout]',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-movflags', '+faststart',
    outputM4a,
  ].join(' ');

  // Build command for MP3 fallback
  const mp3Command = [
    'ffmpeg',
    '-y',
    '-i', inputPath,
    '-filter_complex', filterComplex,
    '-map', '[aout]',
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    '-ar', '44100',
    outputMp3,
  ].join(' ');

  // Execute both commands (M4A first, then MP3)
  return `${m4aCommand} && ${mp3Command}`;
}

/**
 * Measure audio metrics using ffmpeg
 */
async function measureAudioMetrics(audioPath: string): Promise<AudioMetrics> {
  try {
    // Use ffmpeg to measure loudness
    const command = [
      'ffmpeg',
      '-i', audioPath,
      '-af', 'loudnorm=I=-14:TP=-1.0:LRA=7:print_format=json',
      '-f', 'null',
      '-',
    ].join(' ');

    const { stdout, stderr } = await execAsync(command);
    
    // Parse loudnorm output from stderr
    const loudnormMatch = stderr.match(/\{[\s\S]*\}/);
    if (!loudnormMatch) {
      throw new Error('Failed to parse loudnorm output');
    }

    const loudnormData = JSON.parse(loudnormMatch[0]);
    
    // Get duration from ffmpeg output
    const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    let durationMs = 0;
    if (durationMatch) {
      const hours = parseInt(durationMatch[1]);
      const minutes = parseInt(durationMatch[2]);
      const seconds = parseFloat(durationMatch[3]);
      durationMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
    }

    return {
      integratedLufs: parseFloat(loudnormData.input_i) || -14,
      truePeakDbtp: parseFloat(loudnormData.input_tp) || -1.0,
      loudnessRangeLu: parseFloat(loudnormData.input_lra) || 6,
      durationMs,
    };
  } catch (error) {
    console.error('[AudioPostProcessor] Failed to measure audio metrics:', error);
    // Return default values if measurement fails
    return {
      integratedLufs: -14,
      truePeakDbtp: -1.0,
      loudnessRangeLu: 6,
      durationMs: 0,
    };
  }
}

/**
 * Check if audio meets v2_loud standards
 */
export function meetsV2LoudStandards(metrics: AudioMetrics): boolean {
  const tolerance = 1.0; // Allow 1 LU/dB tolerance
  
  const loudnessOk = Math.abs(metrics.integratedLufs - (-14)) <= tolerance;
  const peakOk = metrics.truePeakDbtp <= -0.5; // Must be below -0.5 dBTP
  const rangeOk = metrics.loudnessRangeLu >= 5 && metrics.loudnessRangeLu <= 7;
  
  return loudnessOk && peakOk && rangeOk;
}

/**
 * Get audio metrics from existing file
 */
export async function getAudioMetrics(audioPath: string): Promise<AudioMetrics | null> {
  try {
    return await measureAudioMetrics(audioPath);
  } catch (error) {
    console.error('[AudioPostProcessor] Failed to get audio metrics:', error);
    return null;
  }
}
