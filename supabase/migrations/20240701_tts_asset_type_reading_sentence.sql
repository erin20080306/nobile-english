-- Adds 'reading_sentence' to the tts_asset_type enum so daily reading article
-- sentence audio can be cached in the shared TTS asset table (same as tutor replies).

alter type tts_asset_type add value if not exists 'reading_sentence';
