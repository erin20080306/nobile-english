-- Gemini 3.1 TTS returns WAV/PCM audio. Allow those files in the private
-- TTS cache bucket so generated tutor/reading audio can be persisted.

update storage.buckets
set allowed_mime_types = array[
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/wave'
]::text[]
where id = 'tts-audio-assets';

