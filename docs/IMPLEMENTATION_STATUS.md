# Implementation Status

Last updated: 2026-06-30

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
