---
description: "Task list for 002-studio-enhancements implementation"
---

# Tasks: TTS Studio Enhancements — Batch Generation, Rich Tagging, Managed Library & Settings

**Input**: Design documents from `/specs/002-studio-enhancements/`

**Prerequisites**: plan.md, spec.md (10 user stories), research.md, data-model.md, contracts/rest-api.md, contracts/core-api.md, quickstart.md

**Tests**: INCLUDED — Test-First (Principle II) is **NON-NEGOTIABLE** in the constitution (v2.4.0) and the plan mandates TDD. Test tasks precede their implementation tasks in every phase.

**Organization**: Tasks are grouped by user story (US1–US10, priority order) so each story is an independently testable increment.

**Commands**: Run native/install/test commands through the pinned Node — `mise exec node@22.22.2 -- pnpm <script>` (see quickstart.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US10 (user-story phases only; Setup/Foundational/Polish carry no story label)
- Exact file paths are included in each description

## Path Conventions

Web full-stack over a shared framework-agnostic core (per plan.md):
- Core domain: `src/core/` — NO Nuxt/Vue/Nitro deps
- Nuxt web adapter: `app/`
- Nitro server adapter: `server/`
- Tests: `tests/unit/`, `tests/integration/`, `tests/component/`, `tests/adapters/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the 002 dependencies and wire the Nuxt modules so all later work has a foundation.

- [X] T001 Add runtime + dev dependencies and engine pin in `package.json`: install `@nuxt/ui`, `@nuxtjs/i18n`, `taglib-wasm`, `archiver`, `@sindresorhus/slugify`, and dev `bumpp` (`mise exec node@22.22.2 -- pnpm add …`); set `engines.node` to `">=22.6"`; add scripts `bumpp`, `test:component`, `test:adapters`
- [X] T002 [P] Register modules and config in `nuxt.config.ts`: add `@nuxt/ui` (+ bundled `@nuxtjs/color-mode`, default `system`) and `@nuxtjs/i18n` (locales `en`/`hu`, `defaultLocale: 'hu'`, `strategy: 'no_prefix'`, cookie-persisted); set `runtimeConfig.public.appVersion` by reading `version` from `package.json`; keep dev port 3102
- [X] T003 [P] Create `app/app.config.ts` with Nuxt UI theme tokens (primary/neutral color aliases)
- [X] T004 [P] Add new keys to `.env.example`: `NUXT_APP_SECRET`, `NUXT_DEFAULT_TAG_ARTIST`, `NUXT_DEFAULT_TAG_ALBUM`, `NUXT_DEFAULT_TAG_GENRE`, `NUXT_DEFAULT_TAG_COMMENT`, `NUXT_DEFAULT_TAG_LANGUAGES` (with explanatory comments)
- [X] T005 [P] Create i18n catalog skeletons `i18n/locales/en.json` and `i18n/locales/hu.json` (empty namespaced structure: `generate`, `library`, `settings`, `common`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared core types, catalogs, error codes, database migration, path-based storage, naming, DI wiring, and the tabbed app shell that every user story depends on.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [X] T006 [P] Extend `src/core/shared/types.ts`: add `Metadata` (title/artist/album/genre/comment/recordedAt/track/languages[]/customText[]/customUrl[]), `Format`, `Model`, `FormatInfo`, `ListItem`, `LibraryQuery`, `NewGenerationRecord`; extend `Generation` (add `model`, `format`, `speed`, `path`, `metadata`, derived `filename`/`audioUrl`)
- [X] T007 [P] Add new `ErrorCode`s in `src/core/shared/errors.ts`: `INVALID_FORMAT`, `INVALID_MODEL`, `NO_API_KEY`, `INVALID_FILENAME`, `UPLOAD_TOO_LARGE`, `KEY_STORAGE_DISABLED`, `TAGGING_FAILED`, `PROVIDER_UNAVAILABLE`
- [X] T008 [P] Widen catalogs and add limits/guards in `src/core/client.ts`: `VOICES` (alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, shimmer, verse, marin, cedar), `MODELS` (tts-1, tts-1-hd, gpt-4o-mini-tts), `FORMATS` (`{id, ext, taggable: 'id3'|'vorbis'|'none'}` for mp3/wav/flac/opus/aac/pcm), `MAX_INPUT_LENGTH=4096`, `MAX_UPLOAD_BYTES`, `isKnownVoice/Model/Format`
- [X] T009 Map the new `ErrorCode`s → HTTP status in `server/utils/errors.ts` (400 validation; 409 `KEY_STORAGE_DISABLED`; 413 `UPLOAD_TOO_LARGE`; 502 `PROVIDER_UNAVAILABLE`/`TAGGING_FAILED`; 404 `NOT_FOUND`) — depends on T007
- [X] T010 [P] Unit tests for naming in `tests/unit/naming.test.ts`: `slugify` (ASCII transliterate, lowercase, separators normalized, cap 64, empty→`''`), `datedDir` (UTC `YYYY/MM/DD`), `allocateFilename` (collision suffix `_2`/`_3`, never returns an existing name)
- [X] T011 Implement `src/core/naming/slug.ts` (`slugify` via `@sindresorhus/slugify`, 64-cap) and `src/core/naming/filename.ts` (`datedDir`, `allocateFilename`); re-export `slugify` from `src/core/client.ts` — depends on T010
- [X] T012 [P] Migration test in `tests/unit/sqlite-migration.test.ts`: guarded `ALTER TABLE` adds 002 columns idempotently; pre-002 rows backfilled `path='audio/<id>.mp3'`, `format='mp3'`; `app_config` table created; `insert(NewGenerationRecord)` round-trips incl. `tags_extra` JSON
- [X] T013 Extend repository in `src/core/library/repository.ts` (port: `insert(NewGenerationRecord)`) and `src/core/library/sqlite-repository.ts` (idempotent `migrate()`+backfill in ctor, create `app_config`, insert across new `tag_*` columns + `tags_extra`) — depends on T006, T012
- [X] T014 [P] Extend `tests/unit/audio-store.test.ts`: path-based `saveAt`/`readAt`/`existsAt`/`rename`/`deleteAt` round-trips under dated relative paths
- [X] T015 Refactor `src/core/library/audio-store.ts` to the path-based API (`saveAt`/`readAt`/`existsAt`/`rename`/`deleteAt`, all relative to `data/`) — depends on T014
- [X] T016 Update `server/utils/container.ts`: construct the migrated repository and path-based audio store as singletons; leave wiring seams for the tagger, app-config/settings, and a per-request provider — depends on T013, T015
- [X] T017 Create the tabbed app shell: `app/layouts/default.vue` with `UTabs` navigation (Generate / Library / Settings) and an `AppHeader` placeholder; move the existing generator UI into `app/pages/index.vue`; add placeholder `app/pages/library.vue` and `app/pages/settings.vue` — depends on T002

**Checkpoint**: Core types, catalogs, migrated DB, path storage, naming, DI, and the three-tab shell are ready — user stories can begin.

---

## Phase 3: User Story 1 - Generate a batch of clips from a list (Priority: P1) 🎯 MVP

**Goal**: Build one generation list by typing and/or uploading a `.txt`, then produce, play, download, save, and zip audio for every item in a single action, with isolated per-item failures.

**Independent Test**: Type two items, upload a file containing a blank line and an over-length line; confirm one item per valid line in order with an accurate added/skipped/rejected summary, then a single Generate produces playable+downloadable audio for every item, saves each to the library, and offers a batch `.zip`.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T018 [P] [US1] Unit test `tests/unit/parse-upload.test.ts`: `parseUploadText` yields one item per trimmed non-blank line in file order; blank lines skipped; >4,096-char lines rejected; returns `{ added, skippedBlank, rejectedTooLong }`
- [X] T019 [P] [US1] Extend `tests/unit/generate.test.ts`: `generateSpeech` validates voice/model/format/length and the instructions rule; throws (no provider call) on invalid input
- [X] T020 [P] [US1] Extend `tests/integration/generations-post.test.ts`: valid `POST` → 201 `Generation` with `format`/`filename`/`audioUrl`, saved under `YYYY/MM/DD/<slug>.<ext>` and listed; empty / >4,096 / bad voice|model|format → 400, nothing saved; provider failure → 502 with no orphan file
- [X] T021 [P] [US1] Integration test `tests/integration/generations-archive.test.ts`: `POST /api/generations/archive { ids }` → `application/zip`, entries named by each item's filename, duplicate names disambiguated
- [X] T022 [P] [US1] Component test `tests/component/Generate.test.ts`: typing+Add appends a row; `.txt` upload appends one row per valid line after existing rows and shows the added/skipped/rejected summary; a ≥5 MB file is rejected; a single Generate shows per-item progress and isolates one failure

### Implementation for User Story 1

- [X] T023 [P] [US1] Create `src/core/batch/parse-upload.ts` (pure `parseUploadText`) and export it from `src/core/client.ts`
- [X] T024 [US1] Extend the `TtsProvider` port in `src/core/tts/provider.ts` to accept `model`, `format`, `speed`, `instructions?`
- [X] T025 [US1] Extend `src/core/tts/openai-provider.ts`: forward `model`/`format`/`speed`, send `instructions` only for `gpt-4o-mini-tts`, construct the client per request from the resolved `apiKey`
- [X] T026 [US1] Extend validation in `src/core/tts/generate.ts` (voice/model/format/length + instructions rule; no network on invalid input) — depends on T024
- [X] T027 [US1] Extend `LibraryService.save` in `src/core/library/library-service.ts` to allocate a dated slug path (naming module), write-then-insert atomically with orphan cleanup on failure; add `archive(ids)` via `archiver` — depends on T011, T013, T015
- [X] T028 [US1] Extend `server/api/generations.post.ts`: accept `text/voice/model/format/speed/instructions`, resolve a per-request provider, map provider failure → 502, return the saved `Generation` — depends on T026, T027
- [X] T029 [US1] Create `server/api/generations/archive.post.ts` streaming the zip — depends on T027
- [X] T030 [US1] Update `server/api/generations/[id]/audio.get.ts` to set `Content-Type` per format (audio/mpeg, audio/wav, audio/flac, audio/opus, audio/aac, audio/L16)
- [X] T031 [P] [US1] Create `app/composables/useQueue.ts`: ephemeral queue (add/remove rows, upload→`parseUploadText`, form-level voice/model/format/speed); never persisted
- [X] T032 [US1] Update `app/composables/useGeneration.ts`: per-item generate loop with progress + isolated failures, then batch zip download — depends on T031
- [X] T033 [P] [US1] Create `app/components/generate/UploadDropzone.vue` (.txt upload, 5 MB guard, calls `parseUploadText`, renders the summary)
- [X] T034 [US1] Build the Generate page in `app/pages/index.vue` with `app/components/generate/GenerateForm.vue` (voice/model/format/speed) + `app/components/generate/QueueList.vue` (row status) + single Generate + Download-all (.zip) — depends on T031, T032, T033
- [X] T035 [US1] Add `generate` i18n keys to `i18n/locales/en.json` and `hu.json`

**Checkpoint**: US1 is independently demoable — the batch studio works end-to-end (untagged audio, slug-named, saved, zipped).

---

## Phase 4: User Story 2 - Attach rich, standards-based metadata (Priority: P1)

**Goal**: Carry the full metadata set into generated files via the `AudioTagger` port (ID3v2.4.0 for MP3/WAV, Vorbis for FLAC/Opus, skipped-with-notice for AAC/PCM and non-mappable fields), persisted and re-editable across restarts.

**Independent Test**: Fill the full metadata set, generate an MP3, confirm the file carries ID3v2.4.0 tags; generate FLAC/Opus (customUrl skipped with notice) and AAC/PCM (all tags skipped, still completes); restart and confirm values persist.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T036 [P] [US2] Unit test `tests/unit/tag-audio.test.ts` with a **fake** `AudioTagger`: AAC/PCM → `skipped=['*']`; FLAC/Opus → `customUrl` in `skipped`; MP3/WAV → full set mapped; `tagAudio` returns `{ bytes, skipped }`
- [X] T037 [P] [US2] Gated adapter test `tests/adapters/taglib-tagger.test.ts`: real `taglib-wasm` writes ID3v2.4 for MP3 (title/artist/TXXX/TLAN), Vorbis for FLAC/Opus; confirms the research spike — ID3v2 save version is 2.4, WAV written as an ID3v2.4 chunk (not only RIFF INFO), customUrl round-trips as WXXX (or documented TXXX fallback)
- [X] T038 [P] [US2] Integration test `tests/integration/generations-metadata.test.ts`: `POST` with full metadata → MP3 carries tags; `recordedAt` accepts year-only and full timestamp; FLAC/Opus → `skippedTags` includes customUrl; AAC/PCM → still 201 with all tags skipped; values persist and reopen after a fresh repository instance
- [X] T039 [P] [US2] Component test `tests/component/MetadataFields.test.ts`: full set incl. multi-value `languages` and repeatable `customText`/`customUrl`

### Implementation for User Story 2

- [X] T040 [P] [US2] Create `src/core/tagging/tagger.ts`: `AudioTagger` port, `TagResult` type, and the per-format applicability map
- [X] T041 [US2] Create `src/core/tagging/taglib-tagger.ts`: `TagLibAudioTagger.create()` (load WASM once) and `tag()` (openFile → map Metadata→PropertyMap → save → getFileBuffer → dispose) — depends on T040
- [X] T042 [US2] Create `src/core/tagging/tag-audio.ts` (`tagAudio` use-case mapping `Metadata` → properties per format, collecting `skipped`) — depends on T040
- [X] T043 [US2] Insert the tagging step into `LibraryService.save` (tag before write; tagging failure fails only that item; surface `skippedTags`) in `src/core/library/library-service.ts` — depends on T027, T042
- [X] T044 [US2] Wire metadata serialize/deserialize (single `tag_*` columns + `tags_extra` JSON for languages/customText/customUrl) in `src/core/library/sqlite-repository.ts` — depends on T013
- [X] T045 [US2] Extend `server/api/generations.post.ts` to accept `metadata` and return `skippedTags` — depends on T043
- [X] T046 [US2] Initialize `TagLibAudioTagger` once and inject it into `LibraryService` in `server/utils/container.ts` — depends on T041, T043
- [X] T047 [US2] Create `app/components/generate/MetadataFields.vue` (title/artist/album/genre/comment/recordedAt/track/languages multi + repeatable customText/customUrl) and wire it into the form/queue; show the `skippedTags` notice — depends on T034
- [X] T048 [US2] Add metadata i18n keys to `i18n/locales/en.json` and `hu.json`

**Checkpoint**: US1 + US2 work — batches generate with full, standards-based, persisted tags.

---

## Phase 5: User Story 3 - Edit each queued item before generating (Priority: P2)

**Goal**: Edit one queue row's text/voice/model/format/instructions/metadata in place, affecting only that row, with revalidation, instruction retention, and an untaggable-format warning.

**Independent Test**: Add several rows, edit one row's fields; only that row changes; empty/over-length text is rejected (previous value kept); switching off `gpt-4o-mini-tts` retains instructions unapplied; switching to AAC/PCM warns metadata will be skipped without discarding values.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [X] T049 [P] [US3] Component test `tests/component/QueueItemEditor.test.ts`: per-row edit isolates changes; empty/>4,096 text rejected with previous kept; model change off `gpt-4o-mini-tts` retains instructions; switching to AAC/PCM shows the skip warning and retains entered metadata

### Implementation for User Story 3

- [X] T050 [US3] Add `updateItem(clientId, patch)` to `app/composables/useQueue.ts` with per-row text revalidation, instruction retention across model changes, and untaggable-format detection — depends on T031
- [X] T051 [US3] Create `app/components/generate/QueueItemEditor.vue` (edit text/voice/model/format/instructions/metadata for a single row, immediate reflection, skip warning) — depends on T047, T050
- [X] T052 [US3] Wire the editor into `app/components/generate/QueueList.vue` (open/close per row) — depends on T051
- [X] T053 [US3] Add per-item-edit i18n keys to `i18n/locales/en.json` and `hu.json`

**Checkpoint**: Queue rows are individually editable before generation.

---

## Phase 6: User Story 4 - Recognizable filenames and dated organization (Priority: P2)

**Goal**: Newly generated files are named from their title slug under `YYYY/MM/DD`, unique within the day (numeric suffix on collision), with a UUID fallback; downloads use the real filename; legacy files stay accessible.

**Independent Test**: Generate two items with the same title → first is the title slug, second gets a suffix, neither overwrites, both under today's UTC date folder; an empty/emoji-only title falls back to a UUID; a download uses the real human-readable filename.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [ ] T054 [P] [US4] Integration test `tests/integration/naming-storage.test.ts`: two same-title generations → `<slug>.<ext>` and `<slug>_2.<ext>`, neither overwritten, both under today's UTC `YYYY/MM/DD`; empty/emoji-only title → UUID fallback; a legacy `audio/<id>.mp3` row still lists/plays/downloads
- [ ] T055 [P] [US4] Extend `tests/integration/audio-download.test.ts`: `?download=1` sets `Content-Disposition: attachment; filename="<real filename>"`

### Implementation for User Story 4

- [ ] T056 [US4] Confirm/complete dated-slug allocation + UUID fallback path in `LibraryService.save` (`src/core/library/library-service.ts`) against the US4 tests — depends on T027, T054
- [ ] T057 [US4] Add `?download=1` real-filename `Content-Disposition` to `server/api/generations/[id]/audio.get.ts` — depends on T030
- [ ] T058 [US4] Show a live slug-based filename preview in the form/queue using `slugify` from `#core/client` (`app/components/generate/MetadataFields.vue` or `QueueList.vue`) — depends on T047
- [ ] T059 [US4] Add filename/preview i18n keys to `i18n/locales/en.json` and `hu.json`

**Checkpoint**: Generated files are human-readable, dated, collision-safe, and downloadable by real name.

---

## Phase 7: User Story 5 - Manage saved items in the library (Priority: P2)

**Goal**: From the library, rename a saved file (same slug rules, collision suffix, reject empty, extension fixed, title edit never renames) and edit its full metadata (retag + persist), or delete it (with confirmation), without re-synthesis.

**Independent Test**: Select an item, change filename + several metadata fields, save → file renamed, metadata updated, preview/download still resolve; editing the title does not rename; delete another item (confirm) → gone after refresh.

### Tests for User Story 5 ⚠️ (write first, must fail)

- [ ] T060 [P] [US5] Integration test `tests/integration/generations-patch.test.ts`: `PATCH` filename → re-slugged, file renamed, final name reported; empty/un-sluggable → 400 `INVALID_FILENAME` (original kept); collision → suffix; `metadata.title` edit does NOT rename; metadata retag persisted and survives a fresh repository instance; tagging failure → 502 with the original file untouched
- [ ] T061 [P] [US5] Extend `tests/integration/generations-delete.test.ts`: `DELETE` removes both the row and its stored file (incl. dated path)
- [ ] T062 [P] [US5] Component test `tests/component/LibraryItemEditor.test.ts`: editor shows current filename + full metadata; save; delete requires confirmation

### Implementation for User Story 5

- [ ] T063 [US5] Add `update(id, { path?, metadata? })` to `src/core/library/repository.ts` (port) and `src/core/library/sqlite-repository.ts` — depends on T013
- [ ] T064 [US5] Add `rename(id, newName)` (re-slug, collision suffix in the dated folder, reject empty, move file, update `path`) and `updateMetadata(id, metadata)` (retag via tagger + persist) to `LibraryService` (`src/core/library/library-service.ts`) — depends on T043, T063
- [ ] T065 [US5] Create `server/api/generations/[id].patch.ts` (rename and/or retag; returns final filename + `skippedTags`) — depends on T064
- [ ] T066 [US5] Create `app/components/library/LibraryItemEditor.vue` (filename field + `MetadataFields`; extension shown non-editable) — depends on T047
- [ ] T067 [US5] Add `rename`/`updateMetadata`/`delete` (with `ConfirmDialog`) to `app/composables/useLibrary.ts` — depends on T065
- [ ] T068 [US5] Build the Library page in `app/pages/library.vue` to list items, open the editor, and delete with confirmation — depends on T066, T067
- [ ] T069 [US5] Add library-management i18n keys to `i18n/locales/en.json` and `hu.json`

**Checkpoint**: Saved items are renamable, retaggable, and deletable from the library.

---

## Phase 8: User Story 6 - Find and organize the library (Priority: P2)

**Goal**: Server-side search (LIKE over title/text/tags/filename), sort (createdAt default desc / title / voice / format), filter (date/voice), pagination — all composable — plus bulk-clean by date/voice and graceful empty/missing states.

**Independent Test**: With many items, search a word in a title/text/tag, sort by title, filter by voice, page through (each composes), and bulk-clean a date range (confirm) → matching records and files removed; locate and play a specific item within ~10s.

### Tests for User Story 6 ⚠️ (write first, must fail)

- [ ] T070 [P] [US6] Unit test `tests/unit/library-query.test.ts`: `list(query)` builds composable WHERE (q LIKE over title/text/tags/filename; voiceId/format equality; from/to range), ORDER BY (createdAt/title/voice/format, asc/desc), LIMIT/OFFSET; returns accurate `total`
- [ ] T071 [P] [US6] Extend `tests/integration/generations-get.test.ts`: `GET /api/generations` with `q/voiceId/format/from/to/sort/order/page/pageSize` composes; empty result returns an empty array + correct `total`
- [ ] T072 [P] [US6] Integration test `tests/integration/bulk-clean.test.ts`: `POST /api/library/bulk-clean` removes matching rows + files and returns `{ deleted }`
- [ ] T073 [P] [US6] Component test `tests/component/LibraryTable.test.ts`: search bar + sortable/filterable table + pagination drive the query; empty-state message renders

### Implementation for User Story 6

- [ ] T074 [US6] Add `list(query)` (composable filter/sort/page + `total`) and `bulkDelete(filter)` (returns removed rows) to `src/core/library/repository.ts` and `src/core/library/sqlite-repository.ts` — depends on T013
- [ ] T075 [US6] Add `list(query)` and `bulkClean(filter)` (delete files for removed rows) to `LibraryService` (`src/core/library/library-service.ts`) — depends on T074
- [ ] T076 [US6] Update `server/api/generations.get.ts` to parse the query params and return `{ generations, total, page, pageSize }` — depends on T075
- [ ] T077 [US6] Create `server/api/library/bulk-clean.post.ts` (requires ≥1 filter) — depends on T075
- [ ] T078 [US6] Build `app/components/library/LibrarySearchBar.vue`, `LibraryTable.vue` (sort/filter/paginate), and `BulkCleanDialog.vue`; add query state to `app/composables/useLibrary.ts` and wire into `app/pages/library.vue` — depends on T068, T076, T077
- [ ] T079 [US6] Render an "unavailable" state for a row whose stored file is missing (edge case) in `app/components/library/LibraryTable.vue` — depends on T078
- [ ] T080 [US6] Add discovery/bulk-clean i18n keys to `i18n/locales/en.json` and `hu.json`

**Checkpoint**: A growing library stays searchable, sortable, filterable, paginated, and cleanable.

---

## Phase 9: User Story 7 - Personalize appearance and language (Priority: P3)

**Goal**: Light/dark/system theme (default system) and English/Hungarian language (default Hungarian), both persisted app-wide; domain values are never translated.

**Independent Test**: Switch to dark + English, reload → both persist app-wide with no theme flash; default locale is Hungarian; generated audio/text/tags/filenames are never translated.

### Tests for User Story 7 ⚠️ (write first, must fail)

- [ ] T081 [P] [US7] Component test `tests/component/Settings.appearance-language.test.ts`: theme toggle (light/dark/system) and language switch (en/hu) update the UI and persist; default locale is `hu`; rendered domain data (text/tags/filenames) is not translated

### Implementation for User Story 7

- [ ] T082 [P] [US7] Create `app/components/settings/AppearanceSettings.vue` (color-mode light/dark/system)
- [ ] T083 [US7] Create `app/components/settings/LanguageSettings.vue` (i18n locale switch) and wire both into `app/pages/settings.vue` — depends on T082
- [ ] T084 [US7] Complete the `en`/`hu` catalogs in `i18n/locales/` for all shipped UI strings (consolidating keys added per story)

**Checkpoint**: Appearance and language are user-selectable and persisted, with no effect on content.

---

## Phase 10: User Story 8 - Configure the OpenAI key in the app (Priority: P3)

**Goal**: Set/replace/clear an encrypted, server-only OpenAI key from Settings (masked status only), with UI→env precedence resolved per request, a test action, clear NO_API_KEY failure, and graceful disablement when `NUXT_APP_SECRET` is unset.

**Independent Test**: Set a key (masked status only), confirm it overrides the env key for generation, clear it (reverts to env), test the active key; with no key anywhere generation fails with a clear message saving nothing; with `NUXT_APP_SECRET` unset the controls disable and `PUT` returns 409.

### Tests for User Story 8 ⚠️ (write first, must fail)

- [ ] T085 [P] [US8] Unit test `tests/unit/crypto.test.ts`: AES-256-GCM `encryptSecret`/`decryptSecret` round-trip; tampered payload fails to decrypt
- [ ] T086 [P] [US8] Unit test `tests/unit/api-key.test.ts`: `resolveApiKey` precedence UI(decrypted)→env→undefined; with `appSecret` unset, UI key is ignored and env is used
- [ ] T087 [P] [US8] Integration test `tests/integration/settings-key.test.ts`: `PUT` then `GET` shows masked only (`source:'ui'`); `DELETE` reverts to env; `test` reports the active key; key never appears in any response/error; no `NUXT_APP_SECRET` → `GET secretConfigured:false` and `PUT` → 409 `KEY_STORAGE_DISABLED`; no key anywhere → generation 400 `NO_API_KEY`, nothing saved

### Implementation for User Story 8

- [ ] T088 [P] [US8] Create `src/core/settings/crypto.ts` (`encryptSecret`/`decryptSecret`, AES-256-GCM, scrypt-derived key)
- [ ] T089 [P] [US8] Create `src/core/settings/app-config-repository.ts` (`AppConfigRepository` over `app_config`: get/set/delete)
- [ ] T090 [US8] Create `src/core/settings/api-key.ts` (`resolveApiKey({ config, appSecret?, envKey? })`) — depends on T088, T089
- [ ] T091 [US8] Create `server/api/settings/openai-key.get.ts`, `openai-key.put.ts`, `openai-key.delete.ts`, and `openai-key/test.post.ts` (masked status; 409 when secret unset; active-key test) — depends on T090
- [ ] T092 [US8] Wire `resolveApiKey` into the per-request `OpenAiTtsProvider` in `server/utils/container.ts` and raise `NO_API_KEY` (nothing saved) in the generate path — depends on T090, T028
- [ ] T093 [US8] Create `app/components/settings/OpenAiKeySettings.vue` and `app/composables/useSettings.ts` (masked status, set/clear/test, disabled state when `secretConfigured:false`); wire into `app/pages/settings.vue` — depends on T091, T083
- [ ] T094 [US8] Add OpenAI-key i18n keys to `i18n/locales/en.json` and `hu.json`

**Checkpoint**: The OpenAI key is fully manageable in-app, encrypted, server-only, with env fallback.

---

## Phase 11: User Story 9 - See and release the app version (Priority: P3)

**Goal**: Show the authoritative `package.json` version near the title (graceful omission if absent, no remote check) and release with one `bumpp` command.

**Independent Test**: The header shows the version; running `pnpm bumpp patch` updates the displayed version with no further edit; if the version is unavailable the app still loads.

### Tests for User Story 9 ⚠️ (write first, must fail)

- [ ] T095 [P] [US9] Component test `tests/component/AppHeader.test.ts`: header renders the version from `runtimeConfig.public.appVersion`; when absent, it is omitted/placeholder and no remote request is made

### Implementation for User Story 9

- [ ] T096 [US9] Create `app/components/common/AppHeader.vue` (+ `app/composables/useAppVersion.ts`) reading `useRuntimeConfig().public.appVersion`, degrading gracefully; mount it in `app/layouts/default.vue` — depends on T017
- [ ] T097 [US9] Verify the `bumpp` script + `runtimeConfig.public.appVersion` end-to-end (bump → header reflects new version) and document it in quickstart usage — depends on T001, T002, T096

**Checkpoint**: The running version is visible and releasable with one command.

---

## Phase 12: User Story 10 - Pre-filled default tag values (Priority: P3)

**Goal**: Pre-fill non-title metadata fields from deployment defaults on the form and new rows (Title never defaulted), overridable, with invalid config falling back to blank without failing startup.

**Independent Test**: With `NUXT_DEFAULT_TAG_*` set, open Generate / add a row → non-title fields pre-filled, Title blank, overridable; invalid/missing config leaves fields blank and the app still starts.

### Tests for User Story 10 ⚠️ (write first, must fail)

- [ ] T098 [P] [US10] Integration test `tests/integration/settings-defaults.test.ts`: `GET /api/settings/defaults` returns env-provided default tags, never defaults Title, and returns blank (never 500) on invalid/missing config
- [ ] T099 [P] [US10] Component test `tests/component/DefaultTags.test.ts`: a new queue row pre-fills non-title defaults (Title blank) and the user can override/clear them

### Implementation for User Story 10

- [ ] T100 [US10] Create `server/api/settings/defaults.get.ts` reading `NUXT_DEFAULT_TAG_*` safely (omit/blank on invalid config) — depends on T009
- [ ] T101 [US10] Apply defaults on form load and new-row creation in `app/composables/useQueue.ts` / `app/components/generate/MetadataFields.vue` (Title never defaulted) — depends on T047, T100
- [ ] T102 [US10] Add default-tags i18n keys to `i18n/locales/en.json` and `hu.json`

**Checkpoint**: All ten user stories are independently functional.

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, deployment config, a11y, edge cases, and full-suite validation across all stories.

- [ ] T103 [P] Update `README.md` and cross-check `specs/002-studio-enhancements/quickstart.md` for the new run/test/release commands and env vars
- [ ] T104 Update `Dockerfile` and `docker-compose.yml` to pass through `NUXT_APP_SECRET` and `NUXT_DEFAULT_TAG_*` and confirm no extra system packages are required (WASM tagger via npm)
- [ ] T105 [P] Accessibility pass on new components (labels, focus, keyboard) across `app/components/generate/`, `library/`, `settings/`, `common/`
- [ ] T106 Configure the gated adapter suite (`test:adapters`) in `vitest.config.ts` (taglib-wasm tagger; optional live OpenAI) so the default suite stays network-/binary-free
- [ ] T107 Handle the "deleting/bulk-cleaning a currently-playing item" edge case in `app/components/common/AudioPlayer.vue` (stop playback gracefully) and the missing-file tolerance end-to-end
- [ ] T108 Run all quality gates: `pnpm test`, `pnpm test:component`, `pnpm lint`, `pnpm typecheck` (all green)
- [ ] T109 Walk through every `quickstart.md` validation scenario (US1–US10 + migration) and confirm each observable outcome

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **User Stories (Phases 3–12)**: All depend on Foundational; then proceed in priority order (P1 → P2 → P3) or in parallel where staffed
- **Polish (Phase 13)**: Depends on the targeted user stories being complete

### User Story Dependencies

- **US1 (P1)**: Foundational only — the MVP
- **US2 (P1)**: Builds on US1's save path (adds the tagging step); independently testable for metadata behavior
- **US3 (P2)**: Builds on the US1 queue + US2 metadata fields (per-row editing)
- **US4 (P2)**: Validates/extends US1's naming + download (naming module is foundational)
- **US5 (P2)**: Builds on US2 (retag) + US4 (rename slug rules)
- **US6 (P2)**: Extends the repository/library listing (independent of US3–US5)
- **US7 (P3)**: Settings UI — depends only on Foundational shell + i18n setup
- **US8 (P3)**: Settings UI + per-request provider (touches the US1 generate path for `NO_API_KEY`)
- **US9 (P3)**: Header version — depends only on Setup/Foundational shell
- **US10 (P3)**: Default tags — depends on US2 metadata fields

### Within Each User Story

- Tests are written first and must FAIL before implementation (Principle II)
- Core port/use-case before adapters; server routes before UI; UI before i18n keys

### Parallel Opportunities

- All Setup `[P]` tasks (T002–T005) run in parallel after T001
- Foundational `[P]` tasks (T006, T007, T008; test tasks T010/T012/T014) run in parallel
- Each story's `[P]` test tasks run in parallel before its implementation
- After Foundational, **US6, US7, US9** are largely independent of US1–US5 and can be staffed in parallel
- New `[P]` Vue components in different files within a story run in parallel

---

## Parallel Example: User Story 1

```bash
# Tests first (different files — run together, expect failures):
Task: "Unit test parseUploadText in tests/unit/parse-upload.test.ts"           # T018
Task: "Extend generate validation test in tests/unit/generate.test.ts"          # T019
Task: "Extend POST integration test in tests/integration/generations-post.test.ts"  # T020
Task: "Archive integration test in tests/integration/generations-archive.test.ts"   # T021
Task: "Generate component test in tests/component/Generate.test.ts"             # T022

# Then independent implementation pieces:
Task: "Create src/core/batch/parse-upload.ts"                                   # T023
Task: "Create app/composables/useQueue.ts"                                      # T031
Task: "Create app/components/generate/UploadDropzone.vue"                       # T033
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational — blocks everything)
2. Complete Phase 3 (US1)
3. **STOP and VALIDATE**: run the US1 independent test — batch generate, play, download, zip, save
4. Demo the studio MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 (P1) → batch studio (MVP) → demo
3. US2 (P1) → rich metadata → demo
4. US3–US6 (P2) → editing, naming, library management, discovery → demo each
5. US7–US10 (P3) → theme/language, in-app key, version, default tags
6. Polish → docs, Docker, a11y, gates, quickstart validation

### Parallel Team Strategy

After Foundational: one developer drives the P1 spine (US1 → US2 → US3/US5), while others take the independent tracks (US6 library discovery, US7 appearance/language, US9 version). Integrate at each checkpoint.

---

## Notes

- `[P]` = different files, no dependency on an incomplete task
- `[Story]` label maps each task to its user story for traceability
- Tests precede implementation in every phase (Principle II, NON-NEGOTIABLE)
- The ephemeral queue and uploaded `.txt` are never persisted (FR-010)
- The OpenAI key is never returned, logged, or echoed (FR-043) — verify in every key-touching task
- Run native/install/test via `mise exec node@22.22.2 -- pnpm …` (Node pinned 22.22.2)
- Commit after each task or logical group; stop at any checkpoint to validate a story independently
