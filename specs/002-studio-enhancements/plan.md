# Implementation Plan: TTS Studio Enhancements — Batch Generation, Rich Tagging, Managed Library & Settings

**Branch**: `002-studio-enhancements` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-studio-enhancements/spec.md` (source decisions in [`specs/specs-plan.md`](../specs-plan.md))

## Summary

Evolve EchoRecall's single-shot generator into a batch **studio** organised across three
tabs — **Generate**, **Library**, **Settings**. Users build one generation list (typing
and/or a `.txt` upload), edit each row, attach a full ID3v2.4.0-class metadata set, and
produce audio for the whole list with one action; every result is saved with a
title-derived filename under a `YYYY/MM/DD` folder and offered as a batch `.zip`. The
Library gains server-side search / sort / filter / pagination plus rename, retag, delete,
and bulk-clean. Settings adds theme (light/dark/system), language (English/Hungarian,
Hungarian default), and an in-app, encrypted, server-only OpenAI key that takes precedence
over the environment variable. A single authoritative version (package.json, bumped by
**Bumpp**) is shown in the header.

**Technical approach**: extend the existing framework-agnostic `src/core/` (new `batch`,
`tagging`, `naming`, `settings` modules; extended `tts` + `library`) consumed by the
thin Nuxt 4 adapter (Nuxt UI components, `@nuxtjs/i18n`, color-mode, new Nitro routes).
OpenAI TTS already returns MP3/WAV/FLAC/Opus/AAC/PCM natively (no transcode). Multi-format
tagging is done through an `AudioTagger` **port** whose concrete implementation uses
**`taglib-wasm`** (TagLib compiled to WebAssembly — a pure-WASM, zero-dependency, **no
system binary** library) to write ID3v2.4.0 (MP3/WAV) *and* Vorbis comments (FLAC/Opus)
in-memory. SQLite is migrated in place (new `path`, synthesis, and tag columns +
`tags_extra` JSON; existing 001 rows backfilled). Theme/i18n stay web-only (Principle IV);
key resolution lives in the core/server so a future CLI honours the same precedence.

## Technical Context

**Language/Version**: TypeScript (latest stable, `strict`) on Node.js 22.22.2 (pinned via mise) / Node LTS in Docker

**Primary Dependencies**: Nuxt 4 (Vue 3, Nitro, Vite); `@nuxt/ui` v4 (UI kit + `@nuxtjs/color-mode`); `@nuxtjs/i18n` (en/hu); `openai` SDK (TTS, all `response_format`s); `better-sqlite3`; **`taglib-wasm`** (pure-WASM, zero-dep multi-format tagging — MP3/WAV/FLAC/Opus); `archiver` (batch ZIP); `@sindresorhus/slugify` (filename slug); Node built-in `node:crypto` (AES-256-GCM key encryption); `bumpp` (version release, dev/tooling). Requires Node ≥ 22.6.0 (taglib-wasm WASI/WASM) — satisfied by the pinned 22.22.2.

**Storage**: SQLite (`better-sqlite3`) for generation metadata + tags + an `app_config` table (encrypted OpenAI key); local filesystem for audio under `data/audio/YYYY/MM/DD/<slug>.<ext>`. Both under the mounted `data/` Docker volume. Theme/language persist client-side (cookie); default tag values come from environment config. In-app key storage requires `NUXT_APP_SECRET`; **if it is unset, in-app key storage is disabled** (the Settings key controls are shown disabled) and generation falls back to the `OPENAI_API_KEY` env var — env-only deployments keep working untouched.

**Testing**: Vitest (core unit tests, incl. an `AudioTagger` fake at the port boundary); `@nuxt/test-utils` (component/integration); the `taglib-wasm` and OpenAI adapters covered by small, separately-gated adapter tests (no live network in the default suite; the WASM tagger runs in-process — no system binary)

**Target Platform**: Dockerized Node.js (≥ 22.6.0) server (Nitro) serving an SSR/SPA browser client via Docker Compose; the WASM tagger ships in the npm package (no extra runtime packages). Modern evergreen browsers (HTML5 `<audio>`).

**Project Type**: Web application — Nuxt full-stack (Vue + Nitro) over a shared framework-agnostic core. CLI surface still deferred; core capabilities (generation, tagging, naming, library query, key resolution) stay CLI-reachable.

**Performance Goals**: Library list/search/sort/filter renders in <1s and a user can locate and start playing an item within 10s even with a large library (SC-007); replay/download make zero provider requests; batch generation is bounded by the provider, with per-item progress and independent failures.

**Constraints**: Strict TS, no unjustified `any`. Core has no Nuxt/Vue/Nitro/CLI dependency. Max input 4,096 chars/item; uploaded `.txt` < 5 MB, UTF-8. OpenAI key server-only — encrypted at rest, never sent to client, logged, or echoed in errors. Slug ≤ 64 chars; never overwrite an existing file. i18n/theme web-surface only. No authentication (single-user, operator-secured).

**Scale/Scope**: Single-user, self-hosted. ~14 server routes, 4 new core modules + 2 extended, three tabbed screens (Generate / Library / Settings). Library expected to grow to low-thousands of entries; server-side pagination keeps it responsive.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against EchoRecall Constitution **v2.4.0**:

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All new code strict TS incl. Vue `<script setup lang="ts">`; core exports fully typed. The one tolerated `any`-ish cast (provider `voiceId`→SDK union) already documented; WASM tagger adapter typed at its boundary. |
| II. Test-First (NON-NEGOTIABLE) | ✅ PASS | TDD. Slug, filename allocation, upload parsing, tag mapping, library query, key resolution, encryption round-trip are pure/unit-testable in core. `AudioTagger` mocked at the port; WASM tagger + OpenAI adapters gated adapter tests. Web behaviour via `@nuxt/test-utils`. |
| III. Modular Architecture | ✅ PASS | New self-contained `core/batch`, `core/tagging`, `core/naming`, `core/settings`; extended `core/tts`, `core/library`. No presentation→presentation imports; i18n/theme live only in the Nuxt adapter. |
| IV. Shared Core, Multiple Interfaces | ✅ PASS | Domain logic (generation, tagging, naming, library search/sort/filter/pagination, key resolution) is framework-agnostic in `src/core/` and CLI-reachable. Theme/i18n/Settings UI are explicitly web-scoped per spec; the key *resolution* rule lives in core so the CLI honours UI→env precedence. |
| V. Simplicity & YAGNI | ✅ PASS w/ noted additions | No ORM, no FTS (SQLite `LIKE` until proven insufficient), no per-item re-generate. New deps each map to one explicit spec requirement (see Complexity Tracking). **All additions are ordinary npm libraries within the Node/Vue/Nuxt umbrella — no system binary** (`taglib-wasm` is pure WASM, chosen over ffmpeg precisely to avoid one). |

**Result**: The five core principles PASS. **Governance note (Technology Stack clause):**
the constitution states *"Technology choices outside this list MUST be approved as a
constitution amendment."* This feature adds libraries not enumerated in the v2.4.0
Technology Stack — all recorded in **Complexity Tracking** with justification. `@nuxt/ui`
and `bumpp` were **explicitly user-required** in the source plan; `@nuxtjs/i18n`,
color-mode, `archiver`, `@sindresorhus/slugify`, and `taglib-wasm` are all **pure npm
packages within the already-approved Nuxt/Vue/Node stack**. After reconsidering ffmpeg, the
tagging dependency is `taglib-wasm` (WASM) — **there is no longer any system-level/new-runtime
dependency**, so this is a routine additive-library set, not a paradigm change.

**→ Recommended governance action before implementation**: at most a lightweight (PATCH/MINOR)
constitution note enumerating these additive libraries for the record. This plan does not
assume that approval; it surfaces the (now minor) decision for the user (Human Oversight).

Constitution Follow-up TODOs status:
- `TODO(openai-key-handling)` → **resolved** by v2.4.0 + this plan (encrypted `app_config`, server-only, UI→env precedence, resolved per request).
- `TODO(test-http-mocking)` → unchanged: provider and tagger mocked at their **ports**; no fetch interception needed in the default suite.

## Project Structure

### Documentation (this feature)

```text
specs/002-studio-enhancements/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── rest-api.md      # Nitro HTTP routes (web surface)
│   └── core-api.md      # Framework-agnostic core public API additions
├── checklists/
│   └── requirements.md  # Spec quality checklist (already created)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/core/                          # framework-agnostic domain — NO Nuxt/Vue/Nitro/CLI deps
├── tts/
│   ├── provider.ts                # TtsProvider port (extended: model/format/speed/instructions); VOICES (widened), MODELS, FORMATS catalogs
│   ├── openai-provider.ts         # OpenAI adapter (passes model/format/speed/instructions; constructed per request from resolved key)
│   └── generate.ts                # generate use-case (extended validation: format/model/instructions rules)
├── tagging/                       # NEW
│   ├── tagger.ts                  # AudioTagger port + Metadata type + per-format applicability map
│   ├── taglib-tagger.ts           # taglib-wasm adapter (in-memory: ID3v2.4.0 for MP3/WAV, Vorbis for FLAC/Opus, skip AAC/PCM)
│   └── tag-audio.ts               # tagAudio use-case: maps Metadata→PropertyMap per format, returns tagged bytes + skipped-notice
├── naming/                        # NEW
│   ├── slug.ts                    # slugify (ASCII transliterate, lowercase, normalise, cap 64) + UUID fallback
│   └── filename.ts                # dated YYYY/MM/DD folder + collision-safe filename allocation
├── batch/                         # NEW (client-safe)
│   └── parse-upload.ts            # .txt → items + {added, skippedBlank, rejectedTooLong} summary (pure)
├── library/
│   ├── repository.ts              # GenerationRepository port (extended: query, update, bulkDelete)
│   ├── sqlite-repository.ts       # better-sqlite3 impl + in-place migration/backfill
│   ├── audio-store.ts             # filesystem store by explicit path (dated dirs); rename; read/write/delete
│   └── library-service.ts         # save / list(query) / get / rename / updateMetadata / delete / bulkClean / archive
├── settings/                      # NEW
│   ├── crypto.ts                  # AES-256-GCM encrypt/decrypt with server secret
│   ├── app-config-repository.ts   # app_config key/value store (SQLite)
│   └── api-key.ts                 # resolveApiKey(): UI (decrypted) → env fallback
├── shared/
│   ├── errors.ts                  # + new codes (INVALID_FORMAT, INVALID_MODEL, NO_API_KEY, INVALID_FILENAME, UPLOAD_TOO_LARGE …)
│   ├── ids.ts
│   └── types.ts                   # extended Generation, Metadata, ListItem, query/result types
├── client.ts                     # client-safe subset (+ MODELS, FORMATS, slug rules, parse-upload, MAX_INPUT_LENGTH)
└── index.ts                      # full server-side public API

app/                               # Nuxt 4 web adapter (thin)
├── app.config.ts                  # Nuxt UI theme tokens
├── components/
│   ├── generate/ (GenerateForm, QueueList, QueueItemEditor, MetadataFields, UploadDropzone)
│   ├── library/  (LibrarySearchBar, LibraryTable, LibraryItemEditor, BulkCleanDialog)
│   ├── settings/ (AppearanceSettings, LanguageSettings, OpenAiKeySettings)
│   └── common/   (AppHeader+version, AudioPlayer, ConfirmDialog)
├── composables/                   # useQueue, useGeneration, useLibrary, useSettings, useAppVersion
├── pages/                         # index.vue (Generate), library.vue, settings.vue  (UTabs shell in layout)
└── i18n/locales/                  # en.json, hu.json (Hungarian default)

server/                            # Nitro adapter (thin → core)
├── api/
│   ├── voices.get.ts
│   ├── generations.post.ts                 # single item (text/voice/model/format/speed/instructions/metadata)
│   ├── generations.get.ts                  # query: q, sort, order, voiceId, format, from, to, page, pageSize
│   ├── generations/[id].patch.ts           # rename + retag
│   ├── generations/[id].delete.ts
│   ├── generations/[id]/audio.get.ts       # stream by real path; ?download=1 → attachment (real filename)
│   ├── generations/archive.post.ts         # { ids } → .zip
│   ├── library/bulk-clean.post.ts          # { from?, to?, voiceId? } → { deleted }
│   └── settings/
│       ├── openai-key.get.ts / put.ts / delete.ts
│       ├── openai-key/test.post.ts
│       └── defaults.get.ts                  # non-secret default tag values
└── utils/
    ├── container.ts               # wires core (repo, audio store, tagger, settings, per-request provider)
    ├── audio-response.ts
    └── errors.ts                  # maps new ErrorCodes → HTTP

tests/
├── unit/                          # slug, filename, parse-upload, tag mapping, query, crypto, key resolution
├── integration/                   # routes ↔ core; SQLite migration/backfill; fs dated-dir round-trips; archive
└── component/                     # @nuxt/test-utils: tabs, queue editor, library table, settings, i18n, theme

data/                              # runtime, git-ignored, Docker volume
├── echorecall.db
└── audio/ (legacy <id>.mp3 in place) + YYYY/MM/DD/<slug>.<ext>

Dockerfile                         # no extra system packages (WASM tagger in npm); env: NUXT_APP_SECRET, default-tag envs
docker-compose.yml                 # + NUXT_APP_SECRET, default-tag env passthrough
package.json                       # engines.node ">=22.6" (taglib-wasm WASI/WASM)
```

**Structure Decision**: Keep the 001 web-application layout with an explicit
framework-agnostic core; **extend** it rather than restructure. All new domain logic
(batch parsing, tagging, naming, library querying, key handling) lands in `src/core/`
new modules; the Nuxt `app/` and Nitro `server/` stay thin adapters. i18n/theming/Settings
chrome live only in `app/` (Principle IV). Audio moves to dated, slug-named paths for
**new** files; legacy `data/audio/<id>.mp3` files remain readable in place via the stored
`path` column (no migration of files). Tagging runs through the `AudioTagger` port; the
`taglib-wasm` adapter loads the WASM module in-process (server-side), keeping the core
testable (fake tagger in unit tests) with no system binary to install.

## Complexity Tracking

> Constitution **core principles** pass. The entries below justify **Technology Stack
> additions** noted in the Constitution Check (governance clause), per Principle V's
> "complexity must be justified in writing." All are pure npm packages — no system binary.

| Addition | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|--------------------------------------|
| **`taglib-wasm`** (pure WASM, zero deps) behind `AudioTagger` port | One library that writes ID3v2.4.0 (MP3/WAV, incl. TXXX/TLAN) **and** Vorbis comments (FLAC/**Opus**) in-memory; spec requires the full format catalog incl. Opus | **ffmpeg** would add a *system binary* + governance amendment and can't write WXXX (rejected after reconsideration). Pure-JS is fragmented: `node-id3` (MP3) + `flac-tagger` (FLAC) + **no Opus writer** → 3+ libs with an Opus gap. taglib-wasm = single, in-process, testable, no binary. (Small WXXX/version spike tracked in research.) |
| `@nuxt/ui` v4 (+`@nuxtjs/color-mode`) | **User-required**; supplies Tabs, accessible form controls, and the light/dark/system theme (FR-038, FR-049) | Hand-rolled components + bespoke color-mode = more code, weaker a11y, reinvents a mandated tool |
| `@nuxtjs/i18n` | English/Hungarian UI with persisted choice (FR-039/040) | Hand-rolled message catalog + locale switch = re-implements SSR-safe i18n the user expects to be standard |
| `archiver` | Stream a single `.zip` of a batch (FR-008) — Node has no built-in zip | `jszip` buffers entire archive in memory; manual zip format = needless risk |
| `@sindresorhus/slugify` | Robust ASCII transliteration for title→filename (FR-025) | Hand-rolled NFKD strip mishandles many scripts; slug correctness underpins naming + collisions |
| `bumpp` | **User-required** single-command version bump+commit+tag against package.json (FR-047) | Manual version edits drift from tag/commit; reinventing the release step |
| `node:crypto` AES-256-GCM | Encrypt in-app OpenAI key at rest (FR-043, constitution v2.4.0) | Built-in — no new dependency; named only for completeness |
