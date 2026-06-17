# Quickstart & Validation: TTS Studio Enhancements

**Feature**: `002-studio-enhancements` | **Date**: 2026-06-17

How to run the studio and validate each user story end-to-end. Details live in
[plan.md](./plan.md), [data-model.md](./data-model.md), and [contracts/](./contracts/) —
this is a run/verify guide, not an implementation spec.

## Prerequisites

- Node **22.22.2** (pinned via mise; ≥ 22.6 required for `taglib-wasm`'s WASI/WASM). The
  bash shell may default to a different Node, so run native-module / install / test commands
  through mise: `mise exec node@22.22.2 -- <cmd>`.
- **No system binaries** — multi-format tagging is the pure-WASM `taglib-wasm` (its `.wasm`
  ships in the npm package; nothing to apt/brew install, in dev or Docker).
- An **OpenAI API key** with TTS access — set in `.env` (`NUXT_OPENAI_API_KEY=sk-…`) **or**
  later via the Settings tab.
- A 32+ char **app secret** `NUXT_APP_SECRET=…` to enable **in-app** key storage. Optional —
  without it the Settings key controls are disabled and the env `NUXT_OPENAI_API_KEY` is used.
- Optional default tags, e.g. `NUXT_DEFAULT_TAG_ARTIST=…`, `NUXT_DEFAULT_TAG_ALBUM=…`.

## Setup & run

```bash
mise exec node@22.22.2 -- pnpm install      # builds better-sqlite3 against pinned Node
cp .env.example .env                         # set NUXT_OPENAI_API_KEY (optional) + NUXT_APP_SECRET
mise exec node@22.22.2 -- pnpm dev           # http://localhost:3102  (Generate / Library / Settings tabs)
```

Quality gates (all must pass):

```bash
mise exec node@22.22.2 -- pnpm test          # core unit + server integration (no network, no system binaries)
mise exec node@22.22.2 -- pnpm test:component # @nuxt/test-utils component tests
mise exec node@22.22.2 -- pnpm lint
mise exec node@22.22.2 -- pnpm typecheck
mise exec node@22.22.2 -- pnpm test:adapters  # OPTIONAL gated suite: taglib-wasm tagger (+ live OpenAI if keyed)
```

Release (FR-047): `mise exec node@22.22.2 -- pnpm bumpp` → bumps `package.json`, commits,
tags; the header version updates with no further edit.

## Validation scenarios (map to user stories & SCs)

### US1 — Batch from list + upload (P1)
1. On **Generate**, type a line, **Add** → one queue row. Type another, Add → two rows.
2. Upload a `.txt` with several lines incl. one blank and one > 4,096 chars.
   **Expect**: one row per valid line in file order, **appended** after the two typed rows;
   a summary "added X / skipped 1 blank / rejected 1 too-long". A ≥ 5 MB file is rejected.
3. Click the single **Generate**. **Expect**: audio for every row using its own settings;
   each result plays inline + downloads; all appear in the **Library**; a **Download all
   (.zip)** offers the batch. (SC-001/002/003)
4. Force one item to fail (e.g. bad key for one row's run): that row shows a reason and is
   **not** saved; the others still complete.

### US2 — Rich ID3v2.4.0 metadata (P1)
1. Fill Title/Artist/Album/Genre/Comment/Recording date (try year-only **and** full)/Track/
   Language(s)/custom text+URL; generate an **MP3**. **Expect** values embedded as ID3v2.4.0
   (verify in any audio player, or `mediainfo`/`ffprobe` if installed).
2. Generate **FLAC**/**Opus**: mapped fields written as Vorbis comments; custom URL **skipped
   with a notice**. Generate **AAC**/**PCM**: tagging skipped with a notice, generation still
   succeeds.
3. Restart the app; reopen the item → all metadata (incl. custom/multi-value) still present.
   (SC-005)

### US3 — Per-row editing (P2)
Edit one row's text/voice/model/format/instructions/metadata → only that row changes,
immediately. Empty/over-length text edit is rejected, previous value kept. Switch model off
`gpt-4o-mini-tts` → instructions retained but not applied. Switch to AAC/PCM → "metadata will
be skipped" warning, entered values retained.

### US4 — Title-derived names + dated folders (P2)
Generate two items titled "My Great Clip!". **Expect** `my-great-clip.<ext>` and a
suffixed second file, neither overwriting the other, both under `data/audio/YYYY/MM/DD/`
matching today's UTC date. Empty/emoji-only title → UUID fallback. (SC-004/006)

### US5 — Library rename / retag / delete (P2)
Select an item → editor shows filename + full metadata. Change the filename → re-slugged,
file renamed, **final name reported**; extension not editable; a colliding name gets a
suffix; empty name rejected (original kept). Edit the **title** tag → file is **not**
auto-renamed. Edit metadata → save → preview/download still work and reflect new tags. Delete
another item (confirm) → gone after refresh. (SC-008)

### US6 — Search / sort / filter / paginate / bulk-clean (P2)
With many items: search a word in title/text/tag → matches returned; sort by title; filter by
voice; page through; each composes. Bulk-clean a date/voice range (confirm) → matching
records + files removed. Locate and play a specific item within ~10s. (SC-007)

### US7 — Theme & language (P3)
Settings → dark mode + English; reload → both persist app-wide (no theme flash). Confirm
generated audio/text/tags/filenames are **never** translated. Default locale is Hungarian.
(SC-009)

### US8 — In-app OpenAI key (P3)
Settings → set a key → only a masked status shows. With both UI + env keys, generation uses
the **UI** key; clear it → reverts to env. **Test key** reports whether the active key works.
With **no** key anywhere → generate fails with a clear "no key configured" message, nothing
saved. With `NUXT_APP_SECRET` **unset** → the Settings key controls are disabled with a clear
notice and the env key is used (saving a key returns 409 `KEY_STORAGE_DISABLED`). Confirm the
key never appears in any response, log, or error. (SC-010)

### US9 — Version + release (P3)
Header shows the version near the title. Run `pnpm bumpp patch` → header reflects the new
version with no manual edit. If version can't be determined, the app still loads (omitted/
placeholder), no remote check. (SC-011)

### US10 — Default tag values (P3)
With `NUXT_DEFAULT_TAG_*` set, open Generate / add a row → non-title fields pre-filled,
**Title blank**; overriding/clearing a field uses the user's value. Invalid/missing config →
blank fields, app still starts. (SC-012)

### Migration (back-compat)
Start against a pre-002 `data/` (UUID `audio/<id>.mp3` files + old schema). **Expect** the DB
migrates in place (new columns added, old rows backfilled `path='audio/<id>.mp3'`,
`format='mp3'`), and legacy items still list, play, and download.

## Done = green gates + every scenario above observed
Each scenario states an **observable** outcome (a played clip, a file on disk, a masked
status, a persisted value after restart) — not "a file contains X".
