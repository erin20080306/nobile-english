# Implementation Status

Last updated: 2026-07-01

## Database word-review vocabulary targets

Status: implemented in app/API/import tooling. Supabase production import still needs to be run with real Supabase service-role credentials.

### Target counts

- English: 16,000 total review words, interpreted as the existing 8,000 plus 8,000 more.
- Italian: 10,000 review words.
- Spanish: 10,000 review words.
- Japanese: 10,000 review words.
- Korean: 10,000 review words.

### Completed in code

- `src/app/api/vocabulary/review-pool/route.ts`
  - Added a server route for word-review vocabulary pools.
  - Reads from Supabase `dictionary_entries`.
  - Uses `frequency_rank` and learner level to return a bounded review pool instead of shipping the full database to the client.
  - Supports English Advanced target 16,000 and Japanese/Korean/Italian/Spanish Advanced target 10,000.
  - Returns `source: "local"` with a reason when Supabase env vars are missing or the DB query fails.

- `src/services/wordReviewService.ts`
  - Added `buildDatabaseSession()` for database-first word review sessions.
  - Keeps the existing local word-review memory and learning-record behavior.
  - Falls back to existing local vocabulary if the database pool is unavailable.
  - Allows answer choices to use the database pool from the current session.

- `src/app/word-review/page.tsx`
  - The existing UI now reads the database pool when the learner starts a review.
  - Added a compact loading/status message showing database vs local fallback.
  - Did not redesign the page.

- `scripts/dictionary-import.ts`
  - During import, assigns `frequency_rank` by source order.
  - Assigns CEFR buckets by rank:
    - A1: 1-1,500
    - A2: 1,501-2,500
    - B1: 2,501-4,000
    - B2: 4,001-6,000
    - C1: 6,001+

- `scripts/dictionary-review-targets.ts`
  - Added one command to download/import the review targets.
  - Does not call OpenAI, Gemini, TTS, or paid AI APIs.

- `package.json`
  - Added `dictionary:seed-review-targets`.

- `supabase/migrations/20260701_dictionary_review_pool_indexes.sql`
  - Added review-pool indexes for `language_code + frequency_rank`, `language_code + cefr_level + frequency_rank`, and `language_code + display_word`.

### How to seed production Supabase

After Supabase env vars are available locally or in the deployment shell:

```bash
npm run dictionary:seed-review-targets -- --confirm --report-json
```

For a single language:

```bash
npm run dictionary:seed-review-targets -- --language=en --confirm --report-json
```

### Verified locally

- TypeScript:
  - `npx tsc --noEmit` passed.
- Production build:
  - `npm run build` passed.
- Lint:
  - `CI=1 npm run lint` still opens Next.js' interactive ESLint setup prompt because the project has no ESLint config. No lint rules were executed.
- Review-target script dry-run:
  - `npm run dictionary:seed-review-targets -- --language=en` passed after adding `tsx` as a dev dependency.
  - The dry-run listed the English 16,000 target and skipped Supabase import without downloading the large source file.
- External source checks:
  - `wiktextract-en` / kaikki.org English: HTTP 200 OK.
  - `wiktextract-it` / kaikki.org Italian: HTTP 200 OK.
  - `wiktextract-es` / kaikki.org Spanish: HTTP 200 OK.
  - `wiktextract-ko` / kaikki.org Korean: HTTP 200 OK.
  - `jmdict`: HTTP 200 OK.
- API fallback smoke test:
  - Local dev server returned HTTP 200 for `/api/vocabulary/review-pool?language=en&level=Advanced&limit=30&seed=smoke`.
  - Response was `source: "local"` with reason `Supabase vocabulary environment variables are not configured.`
  - Response target count was `16000`.
- Supabase import was not executed because this working copy does not contain real Supabase service-role credentials.

### Not yet verified

- Production Supabase row counts after confirmed import.
- Vercel production word-review page reading `source: "database"` after import.
- Full end-to-end mobile performance with 10,000+ rows per non-English language.

## AI tutor follow-up voice autoplay fix

Status: implemented. Desktop browser/service smoke tests completed for mock fallback; mobile microphone and valid OpenAI-key testing still require a real device/key environment.

### Root cause fixed

- The opening tutor line played because `ConversationPractice` explicitly passed `ttsCandidate: firstTutor.en`.
- Follow-up tutor feedback was displayed after the learner replied, but `tutorVoiceService.playTutorReply()` returned early whenever `feedback.ttsCandidate` was missing.
- The English branch inside `multilingualFeedback()` returned `reply` and `replyZh` but did not include `ttsCandidate`.
- When OpenAI was not configured, failed, or fell back to local mock feedback, visible tutor text could exist while follow-up tutor audio was skipped.

### Completed in code

- `src/services/mockAiTutorService.ts`
  - Added `ttsCandidate: next.en` to the `multilingualFeedback()` English branch.

- `src/services/aiTutorService.ts`
  - Added client-side `normalizeTutorFeedback()`.
  - Ensures every returned `TutorFeedback` has string `reply`, `replyZh`, and a trimmed `ttsCandidate`.
  - If `reply` exists and `ttsCandidate` is missing, `ttsCandidate` falls back to `reply`.

- `src/app/api/tutor/route.ts`
  - Added server-side `normalizeTutorFeedback()` for OpenAI and local fallback responses.
  - Keeps future fallback sources on the same TutorFeedback contract.

- `src/services/tutorVoiceService.ts`
  - Resolves `ttsText` from `feedback.ttsCandidate?.trim() || feedback.reply?.trim() || ""`.
  - Uses `ttsText` for `/api/tts/get-or-create`, Audio Queue text, and Web Speech fallback.
  - Does not read `replyZh`, `grammarTip`, `zhExplain`, or Chinese encouragement as TTS text.
  - Adds explicit `[AI_TTS]` logs for feedback receipt, reply presence, ttsCandidate presence, resolved text, cache hit/miss, audio URL, fallback, queue enqueue, playback started/ended, and skip reasons.
  - Skips playback without false errors when both `reply` and `ttsCandidate` are blank.

- `src/services/audioQueueService.ts`
  - Logs recording-blocked playback as `[AI_TTS] playback skipped reason`.
  - Logs signed URL load errors and `audio.play()` rejection reasons.
  - Moves item `onStart` until after `audio.play()` succeeds, avoiding false "playback started" state.

- `src/components/ConversationPractice.tsx`
  - Added `waitForTutorPlaybackReady()` for voice-input submissions only.
  - Stops speech recognition, clears listening state, stops known microphone tracks when present, clears recording state, waits 300 ms, then confirms queue recording state before follow-up tutor playback.
  - Text-input submissions still reset stale recording state without adding the 300 ms voice delay.
  - Auto-play-off submissions now log `[AI_TTS] playback skipped reason` while leaving manual playback buttons visible.

### Verified locally

- TypeScript:
  - `npx tsc --noEmit` passed.

- Production build:
  - `npm run build` passed.

- Lint:
  - `npm run lint` and `CI=1 npm run lint` still open Next.js' interactive ESLint setup prompt because the project has no ESLint config. No lint rules were executed.

- API mock fallback, five languages:
  - Local dev server `/api/tutor` returned `source: "local"` for English, Japanese, Korean, Italian, and Spanish.
  - All five returned non-empty `reply`.
  - All five returned non-empty `ttsCandidate`.
  - All five had `ttsCandidate === reply`.

- English browser smoke test:
  - Opened `/scenes/cafe/cafe-1`.
  - Started ConversationPractice.
  - Opening tutor line logged `tutor feedback received`, `reply exists`, `ttsCandidate exists`, `resolved ttsText`, `cache miss`, `fallback used`, and `playback ended`.
  - Submitted `I would like a medium latte, please.`
  - AI feedback and the follow-up tutor reply appeared.
  - Follow-up tutor reply logged the same playback path through resolved `ttsText` and fallback playback.
  - In this automation browser, audio unlock failed and TTS returned no playable signed URL, so Web Speech fallback was used. Physical audible output was not independently verified.

- Auto-play disabled browser smoke test:
  - Turned `自動朗讀` off.
  - Submitted another text reply.
  - User text and AI feedback remained visible.
  - Console logged `[AI_TTS] playback skipped reason` from `ConversationPractice`.
  - Manual speaker buttons remained on the message UI.

### Not yet verified

- Valid OpenAI API response autoplay was not verified in this pass because the local API test environment returned `source: "local"` rather than `source: "openai"`.
- Real mobile speech-recognition behavior was not verified on a physical phone. The voice-input readiness helper is implemented, but confirming that the device does not capture tutor audio requires real mobile microphone testing.
- Browser UI smoke for Japanese, Korean, Italian, and Spanish autoplay was not completed through settings-page interaction because `/settings` required login in this local session. Their API feedback/TTS contract was verified as described above.

## Phase 1 - Five-language dictionary import

Status: implemented and smoke-tested for Phase 1 dry-run/import tooling.

### Completed in code

- `scripts/dictionary-download.ts`
  - Added `--dry-run`, `--check-sources`, and `--source` / `--sources` filtering.
  - Fixed downloaded output extensions:
    - CMUdict -> `cmudict.txt`
    - JMdict -> `jmdict.xml`
    - KANJIDIC2 -> `kanjidic2.xml`
    - Wiktextract -> `*.jsonl`
  - Switched downloads to streaming instead of buffering the full response in memory.
  - Updated Japanese dictionary URLs to verified EDRDG sources.

- `scripts/dictionary-import.ts`
  - Added parsers for:
    - CMUdict TXT
    - KANJIDIC2 XML
    - JMdict XML
    - Wiktextract JSON/JSONL
    - WordNet JSON
    - Existing local core dictionaries
  - Added Unicode-safe normalization for English, Japanese, Korean, Italian, and Spanish.
  - Added explicit source-to-language mapping.
  - Added batch-oriented dictionary entry writes and surface-form creation.
  - Added `--dry-run`, `--confirm`, `--limit`, `--batch-size`, `--resume`, `--retry`, `--source`, and `--report-json`.
  - Dry-run works without Supabase credentials.
  - Writes only target `dictionary_entries`, `dictionary_surface_forms`, and `dictionary_sources`; user saved words/reviews are not overwritten.

- `supabase/migrations/20240630_dictionary_import_metadata.sql`
  - Adds `source_version` and `imported_at` metadata columns to `dictionary_entries`.
  - Adds import/source lookup indexes.

- `.gitignore`
  - Ignores downloaded dictionary files and generated import progress/report files.

### Verified locally

- TypeScript:
  - `npx tsc --noEmit` passed after the importer update.

- Lint:
  - `env CI=1 npm run lint` did not run project lint rules because `next lint` opened the interactive ESLint setup prompt. No ESLint config was added in this Phase 1 pass.

- Production build:
  - `npm run build` passed.

- Source checks:
  - `cmudict` source check: HTTP 200 OK.
  - `kanjidic2` source check: HTTP 200 OK.
  - `jmdict` source check: HTTP 200 OK.

- Download dry-run:
  - `npm run dictionary:download -- --language=en --source=cmudict --dry-run` passed.
  - `npm run dictionary:download -- --language=ja --source=kanjidic2 --dry-run` passed.

- Actual smoke downloads:
  - `cmudict.txt`: about 3.5 MB, 135,166 lines.
  - `kanjidic2.xml`: about 15 MB, 538,388 lines.
  - `jmdict.xml`: about 60 MB, 3,704,005 lines.

- Parser dry-run:
  - English CMUdict:
    - Command: `npm run dictionary:import -- --language=en --source=cmudict --dry-run --limit=20 --report-json`
    - Original rows: 21
    - Parsed entries: 21
    - Valid entries: 20
    - New entries estimated: 20
    - Skipped entries: 1
    - Failed entries: 0
  - Japanese KANJIDIC2:
    - Command: `npm run dictionary:import -- --language=ja --source=kanjidic2 --dry-run --limit=20 --report-json`
    - Original rows: 20
    - Parsed entries: 20
    - Valid entries: 20
    - New entries estimated: 20
    - Skipped entries: 0
    - Failed entries: 0
  - Japanese JMdict:
    - Command: `npm run dictionary:import -- --language=ja --source=jmdict --dry-run --limit=20 --report-json`
    - Original rows: 21
    - Parsed entries: 21
    - Valid entries: 20
    - New entries estimated: 20
    - Skipped entries: 1
    - Failed entries: 0
    - Surface forms: 45
  - Local five-language seed:
    - Command: `npm run dictionary:import -- --all --seed-local --dry-run --limit=3 --report-json`
    - English, Japanese, Korean, Italian, Spanish each parsed 3 valid entries with 0 failures.

### Not yet verified

- Supabase confirmed import was not executed locally because the required Supabase service-role environment variables were not available in `.env.local`.
- Full Wiktextract imports were not downloaded or parsed end-to-end in this pass because those files can be large; the importer is streaming JSONL-ready.

### Next required manual step

Before running a confirmed import against Supabase:

1. Apply `supabase/migrations/20240630_dictionary_import_metadata.sql`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`.
3. Set `SUPABASE_SERVICE_ROLE_KEY`.
4. Run a small confirmed smoke import first:

```bash
npm run dictionary:import -- --language=en --source=cmudict --limit=20 --confirm --report-json
npm run dictionary:import -- --language=ja --source=kanjidic2 --limit=20 --confirm --report-json
```

Only after those pass should the full five-language import be run.
