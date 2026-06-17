# Phase 0 Research: TTS Studio Enhancements

**Feature**: `002-studio-enhancements` | **Date**: 2026-06-17

The source plan (`specs/specs-plan.md`) and spec are decision-complete on **behaviour**;
this document resolves the **technology** choices deferred to the plan, plus the one
genuinely open area (multi-format audio tagging). No `NEEDS CLARIFICATION` markers remain.

## 1. Multi-format audio tagging — the key decision

- **Decision**: Define an `AudioTagger` **port** in `core/tagging`; implement it with
  **`taglib-wasm`** — TagLib (the de-facto C++ audio-metadata standard since 2002) compiled
  to **WebAssembly**, a pure-WASM npm package with **zero dependencies and no system
  binary**. Flow is fully in-memory: `taglib.openFile(bytes)` → map our `Metadata` to its
  PropertyMap (`setProperties`) → `file.save()` → `file.getFileBuffer()` → write to disk.
  ID3v2.4.0 for MP3/WAV, Vorbis comments for FLAC/**Opus**, are handled by TagLib's
  automatic per-format mapping. **AAC/PCM are skipped** with a notice (spec: untaggable).
  Library retag reads the stored bytes and runs the same in-memory flow → atomic replace.
- **Rationale**: TagLib is a **single, mature** library that natively writes **both**
  ID3v2.4.0 (MP3/WAV, incl. `TXXX` custom text and `TLAN`/multi-value via PropertyMap) **and**
  Vorbis comments (FLAC **and Opus/Ogg** — the gap that sank the pure-JS route). Being pure
  WASM, it needs **no system binary** (resolving the governance/deployment concern), runs
  **in-process** (no subprocess → simpler, faster, fully testable under Vitest), and ships
  the `.wasm` in the npm package. OpenAI TTS returns each `response_format` natively, so the
  tagger only embeds metadata, never transcodes. The `AudioTagger` **port** keeps the core
  testable (inject a fake) and the WASM module isolated (Constitution III/IV). Node ≥ 22.6.0
  is required for WASI/WASM exception handling — satisfied by the pinned **22.22.2**.
  TagLib's `PROPERTIES[*].supportedFormats` / `getPropertiesByFormat()` drive the
  "skipped with a notice" set per format directly.
- **Alternatives considered**:
  - ***ffmpeg subprocess*** — covers all formats but adds a **system binary** (Docker apt
    install, governance amendment) and **cannot write `WXXX`** (custom URL) frames; ID3
    custom keys land as TXXX only. Rejected in favour of the dependency-free, higher-fidelity
    WASM library after explicit reconsideration.
  - *Pure-JS per format* — `node-id3` (MP3 only; ID3v2.4 + WAV unclear) + `flac-tagger`
    (FLAC only) + **no maintained Ogg/Opus comment writer** → 3+ libraries with a hard Opus
    gap. Rejected (incomplete, more surface).
  - *`music-metadata`* — read-only; cannot write. Rejected.
  - *BLOB tags in DB only* — would not embed metadata in the file, defeating "well-organized
    in any audio player" (US2). Rejected.
- **Residual risk (tracked, small — resolve in a brief implementation spike)**: confirm in
  the bundled TagLib version that (a) custom **URL** entries round-trip as `WXXX` via the
  PropertyMap (TagLib supports WXXX; if the binding surfaces only PropertyMap, custom URLs
  fall back to `TXXX` — acceptable, and they are ID3-only per spec, skipped for FLAC/Opus);
  (b) the ID3v2 save version is **2.4** (TagLib 2.x default); and (c) **WAV is written as an
  ID3v2.4 chunk, not only a RIFF `INFO` chunk** — FR-019 requires ID3v2.4.0 for WAV, and
  TagLib's WAV file can carry either an ID3v2 tag or an INFO tag, so this must be verified
  (and forced to ID3v2 if the binding defaults to INFO). These are far narrower than the
  ffmpeg WXXX gap. Documented in `contracts/core-api.md`.

## 2. UI component library, tabs, theming (color-mode)

- **Decision**: `@nuxt/ui` v4 (user-required) for all controls — `UTabs` for the
  Generate/Library/Settings shell, accessible form inputs, tables, modals. Theme via the
  bundled `@nuxtjs/color-mode`: light / dark / **system** (default system), cookie-persisted
  for SSR-correct, flash-free rendering. App-wide tokens in `app/app.config.ts`.
- **Rationale**: Mandated by the source plan; ships accessible primitives (FR-049, FR-038)
  and color-mode out of the box, avoiding hand-rolled a11y.
- **Alternatives considered**: raw HTML controls (current 001 state) — weaker a11y, more
  code; headless-only (Reka UI) — more wiring than the chosen kit provides.

## 3. Internationalisation (i18n)

- **Decision**: `@nuxtjs/i18n` with lazy `en`/`hu` JSON catalogs, **Hungarian default**,
  cookie-persisted locale, `no_prefix` strategy (single-user app, no localized routing).
  Only UI chrome is translated; generated audio, user text, tag values, and filenames are
  never passed through translation (FR-040).
- **Rationale**: Standard SSR-safe Nuxt i18n; cookie persistence matches theme; keeps
  domain data untouched. Web-surface only (Principle IV) — lives entirely in `app/`.
- **Alternatives considered**: hand-rolled `useState` message map (re-implements SSR i18n,
  no pluralization/lazy loading); `vue-i18n` directly (the Nuxt module wraps it correctly
  for SSR).

## 4. Application version display + release tooling

- **Decision**: Single source of truth = `package.json` `version`. Expose at build/config
  time via `runtimeConfig.public.appVersion` (read `package.json` in `nuxt.config.ts`); the
  header reads `useRuntimeConfig().public.appVersion` and **degrades gracefully** (omit /
  placeholder) if absent — no remote version check (FR-046). Release with **Bumpp**
  (user-required): one command bumps major/minor/patch, commits, and tags (FR-047).
- **Rationale**: One authoritative value, no drift; `public` runtimeConfig is the documented
  Nuxt way to surface a non-secret build constant. Bumpp is the TS analogue of echoquize's
  `bump-my-version`.
- **Alternatives considered**: reading `package.json` at runtime in the browser (not
  bundled/available client-side); a separate VERSION file (a second source to drift);
  `npm version` only (no unified bump-of-choice UX Bumpp gives).

## 5. In-app OpenAI key — storage, encryption, precedence

- **Decision**: Store the UI-set key in a new SQLite `app_config(key, value)` table, value =
  **AES-256-GCM** ciphertext (`node:crypto`) using a 32-byte key derived (scrypt) from a
  server secret env `NUXT_APP_SECRET`. Resolution order **per request**: decrypt UI key →
  else `OPENAI_API_KEY` env → else `NO_API_KEY` error (FR-042/045). The provider is
  constructed per request from the resolved key (it can change at runtime). The key is
  **write-only** from the UI: endpoints return only `{ configured, masked: "●●●●1234",
  source, secretConfigured }`, never the plaintext; never logged or echoed in errors
  (FR-041/043, constitution v2.4.0). **If `NUXT_APP_SECRET` is unset**, in-app key storage
  is disabled (nothing can be encrypted): `GET` reports `secretConfigured: false`, the
  Settings key controls render disabled with a clear message, `PUT` is rejected
  (`KEY_STORAGE_DISABLED`, nothing stored), `resolveApiKey` skips the UI key, and generation
  falls back to the env key — so env-only deployments keep working untouched.
- **Rationale**: Encrypted-at-rest, server-only secret handling exactly as v2.4.0 permits;
  per-request resolution is the simplest correct way to honour runtime changes; the rule
  lives in `core/settings` so a CLI honours the same precedence (Principle IV).
- **Alternatives considered**: plaintext in DB (forbidden); env-only (loses the in-app
  feature); OS keychain (not portable to a headless container); binding the key once at
  startup (would ignore in-app changes until restart).

## 6. Filenames, slugs, and dated storage

- **Decision**: `@sindresorhus/slugify` for ASCII transliteration → lowercase → separator
  normalisation, then cap at **64 chars**; empty/un-sluggable titles fall back to a UUID
  (FR-025/027). Files stored under `data/audio/YYYY/MM/DD/<slug>.<ext>` from the **UTC**
  creation date; collisions get a numeric suffix (`…_2`) scoped to the day folder; existing
  files are never overwritten (FR-026/028). The real path is persisted (FR-029).
- **Rationale**: A maintained slug library handles transliteration corner cases correctly;
  dated folders + per-folder collision scope keep names human-readable and unique.
- **Alternatives considered**: hand-rolled `normalize('NFKD')` strip (mishandles many
  scripts); global uniqueness scan (O(n) per save vs. per-folder check); keeping UUID
  filenames (fails the "recognizable on disk" requirement).

## 7. Library search / sort / filter / pagination

- **Decision**: Evaluate **server-side over SQLite** in the repository: `list(query)` builds
  parameterised `WHERE` (free-text `LIKE` over title/text/tags/filename; equality on
  voice/format; range on `created_at`), `ORDER BY` (created/title/voice/format, asc/desc),
  `LIMIT/OFFSET`, returning `{ rows, total }`. Search/sort/filter/pagination **compose**
  (FR-034–036).
- **Rationale**: Scales and composes as the library grows (SC-007); a core capability
  reachable by the CLI (Principle IV). `LIKE` is sufficient for low-thousands of rows.
- **Alternatives considered**: client-side filtering (doesn't scale, breaks pagination);
  SQLite FTS5 (extra complexity not justified yet — YAGNI; revisit if `LIKE` proves slow).

## 8. Batch generation orchestration + ZIP

- **Decision**: The queue is **ephemeral client state**; the `.txt` is parsed **client-side**
  using a pure, client-safe core function (`core/batch/parse-upload.ts`) so rules (trim,
  skip blank, reject >4,096, 5 MB cap) are tested once and reused. Generation is **per-item**
  (`POST /api/generations` per row) so a single failure reports a reason and doesn't block
  others (FR-006); the client shows per-item progress. After success, the client requests
  `POST /api/generations/archive { ids }` → a streamed `.zip` via `archiver` (FR-008).
- **Rationale**: Per-item endpoints give independent failures + progress for free and keep
  the server stateless; client-side parsing avoids persisting the upload (FR-010). `archiver`
  streams without buffering the whole archive.
- **Alternatives considered**: one batch endpoint that loops (harder partial-failure
  reporting, long-held request); server-side upload endpoint (would need to not persist the
  file anyway); `jszip` (in-memory buffering).

## 9. SQLite migration & backfill

- **Decision**: On repository init, idempotently `ALTER TABLE generations ADD COLUMN` for
  the new fields (guarded by `PRAGMA table_info`): `path`, `model`, `format`, `speed`, the
  single-value `tag_*` columns, and `tags_extra` (JSON for languages + custom text/URL).
  Backfill 001 rows: `path = 'audio/<id>.mp3'`, `format = 'mp3'`, tags null. No file moves.
- **Rationale**: better-sqlite3 + guarded `ALTER` keeps a no-ORM, no-migration-framework
  setup (YAGNI) while letting old rows keep working (FR-024/028).
- **Alternatives considered**: a migration framework (overkill for additive columns); a new
  table + copy (risky, unnecessary); recompute paths from id at read time (breaks once files
  move to dated folders).

## 10. Models, formats, voices, synthesis params

- **Decision**: Catalogs as client-safe core constants — MODELS `tts-1`, `tts-1-hd`,
  `gpt-4o-mini-tts` (instructions sent **only** for `gpt-4o-mini-tts`); FORMATS MP3, WAV,
  FLAC, Opus, AAC, PCM (all native OpenAI `response_format`s); VOICES widened to `alloy, ash,
  ballad, coral, echo, fable, onyx, nova, sage, shimmer, verse, marin, cedar`. `speed`
  (0.25–4.0) is form-level, forwarded to the provider. `generateSpeech` validates
  voice/model/format and the instructions rule before any network call.
- **Rationale**: Mirrors the OpenAI TTS API surface and the source plan's confirmed scope;
  keeps validation in the core. *Implementation note:* verify at build whether
  `gpt-4o-mini-tts` honours `speed` (echoquize forwarded it for all models).
- **Alternatives considered**: per-item speed (spec excludes it, FR-014); a `/api/models`
  endpoint (constants are static — expose via `#core/client`, no round-trip).

## Resolved unknowns summary

| Topic | Resolution |
|-------|-----------|
| Multi-format tagging | `AudioTagger` port + **`taglib-wasm`** (pure WASM, zero deps, in-memory); ID3v2.4.0 (MP3/WAV), Vorbis (FLAC/Opus), skip AAC/PCM; small WXXX/version spike tracked |
| UI / tabs / theme | `@nuxt/ui` v4 + `@nuxtjs/color-mode` (light/dark/system, cookie) |
| i18n | `@nuxtjs/i18n`, en/hu, Hungarian default, cookie, UI-only |
| Version / release | package.json + `runtimeConfig.public.appVersion`; **Bumpp** |
| OpenAI key | `app_config` + AES-256-GCM (`NUXT_APP_SECRET`); per-request UI→env resolution; write-only/masked |
| Filenames | `@sindresorhus/slugify`, cap 64, UUID fallback, `YYYY/MM/DD`, collision suffix |
| Library query | Server-side SQLite `LIKE`/ORDER/LIMIT; compose; FTS deferred |
| Batch + ZIP | Ephemeral queue, client-side `.txt` parse (core fn), per-item generate, `archiver` zip |
| Migration | Guarded `ALTER TABLE` + backfill; no file moves |
| Models/formats/voices/speed | Core constants; instructions only for `gpt-4o-mini-tts`; speed form-level |
