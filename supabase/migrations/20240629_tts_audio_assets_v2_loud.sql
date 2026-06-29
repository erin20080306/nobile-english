-- Add v2_loud audio processing fields to tts_audio_assets
-- This enables loudness normalization to -14 LUFS with True Peak limiting

-- Add new columns for v2_loud processing
ALTER TABLE tts_audio_assets
ADD COLUMN IF NOT EXISTS raw_audio_path text,
ADD COLUMN IF NOT EXISTS processed_audio_path text,
ADD COLUMN IF NOT EXISTS audio_version_string text DEFAULT 'v1',
ADD COLUMN IF NOT EXISTS integrated_lufs numeric,
ADD COLUMN IF NOT EXISTS true_peak_dbtp numeric,
ADD COLUMN IF NOT EXISTS loudness_range_lu numeric,
ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'none',
ADD COLUMN IF NOT EXISTS processing_error text,
ADD COLUMN IF NOT EXISTS processed_at timestamptz;

-- Create enum for processing status
do $$ begin
  create type tts_processing_status as enum (
    'none',
    'pending',
    'processing',
    'ready',
    'failed'
  );
exception when duplicate_object then null; end $$;

-- Update processing_status to use the enum
ALTER TABLE tts_audio_assets
ALTER COLUMN processing_status TYPE tts_processing_status
USING processing_status::tts_processing_status;

-- Add index for processing status
CREATE INDEX IF NOT EXISTS tts_audio_assets_processing_status_idx
ON tts_audio_assets(processing_status);

-- Add index for audio version string
CREATE INDEX IF NOT EXISTS tts_audio_assets_audio_version_string_idx
ON tts_audio_assets(audio_version_string);

-- Update unique index to include audio_version_string
DROP INDEX IF EXISTS tts_audio_assets_uidx;
CREATE UNIQUE INDEX tts_audio_assets_uidx
ON tts_audio_assets (
  provider,
  provider_model,
  language_code,
  voice_profile_id,
  text_hash,
  audio_format,
  audio_version_string
);

-- Add comment explaining the new fields
COMMENT ON COLUMN tts_audio_assets.raw_audio_path IS 'Path to original Chirp 3 HD output (LINEAR16/PCM) before any post-processing';
COMMENT ON COLUMN tts_audio_assets.processed_audio_path IS 'Path to post-processed audio file (v2_loud: -14 LUFS, -1.0 dBTP)';
COMMENT ON COLUMN tts_audio_assets.audio_version_string IS 'Audio processing version: v1 (original -16 LUFS), v2_loud (-14 LUFS, -1.0 dBTP)';
COMMENT ON COLUMN tts_audio_assets.integrated_lufs IS 'Integrated Loudness in LUFS (target: -14 for v2_loud)';
COMMENT ON COLUMN tts_audio_assets.true_peak_dbtp IS 'True Peak in dBTP (target: -1.0 for v2_loud)';
COMMENT ON COLUMN tts_audio_assets.loudness_range_lu IS 'Loudness Range in LU (target: 5-7 for v2_loud)';
COMMENT ON COLUMN tts_audio_assets.processing_status IS 'Status of v2_loud post-processing: none, pending, processing, ready, failed';
COMMENT ON COLUMN tts_audio_assets.processing_error IS 'Error message if processing failed';
COMMENT ON COLUMN tts_audio_assets.processed_at IS 'Timestamp when v2_loud processing completed';
