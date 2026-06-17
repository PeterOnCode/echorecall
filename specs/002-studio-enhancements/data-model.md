# Phase 1 Data Model: TTS Studio Enhancements

**Feature**: `002-studio-enhancements` | **Date**: 2026-06-17

Extends the 001 model. **Generation** becomes richer and **mutable in two narrow ways**
(filename + metadata); audio content and source text stay immutable (no re-synthesis,
FR-033). New: a **Metadata** value object, an ephemeral **ListItem**, and an **AppConfig**
store for the encrypted key. **Voice/Model/Format** are read-only catalogs. Theme/language
and default tags are **not** persisted server-side (cookie / env).

## Entity: Generation (library entry)

One saved text-to-speech result. Created on successful generation; filename + metadata
editable afterwards.

| Field | Type | Rules |
|-------|------|-------|
| `id` | string (UUID v4) | Primary key. No longer the audio filename. |
| `text` | string | Required, trimmed non-empty, ≤ 4,096 chars (FR-009). Immutable source text. |
| `voiceId` | string | Member of the Voice catalog (FR-011). |
| `model` | string | Member of the Model catalog. |
| `format` | string | Member of the Format catalog (mp3/wav/flac/opus/aac/pcm). Drives extension + tag path. |
| `speed` | number | 0.25–4.0; the form-level speed used at generation (recorded; not per-item). |
| `createdAt` | string (ISO 8601 UTC) | Set at save; default sort key (newest-first). |
| `path` | string | Stored audio path **relative to `data/`**. New files: `audio/YYYY/MM/DD/<slug>.<ext>`. Legacy 001 rows: `audio/<id>.mp3`. Authoritative locator (FR-029). |
| `metadata` | Metadata | Embedded tag set (see below). Persisted across `tag_*` columns + `tags_extra`. Mutable. |

- **Derived (not stored)**: `filename` = basename of `path`; `audioUrl` =
  `/api/generations/<id>/audio`.
- **Mutability**: `path`/`filename` change only via explicit Library rename (FR-031);
  `metadata` via Library editor (FR-030). `text`, audio bytes, `voiceId`, `model`, `format`,
  `speed`, `createdAt` are immutable after creation.
- **Lifecycle**: `created` → (rename / retag)* → (optionally) `deleted` (removes row + file,
  FR-032).

### SQLite schema (after in-place migration)

```sql
CREATE TABLE IF NOT EXISTS generations (
  id          TEXT PRIMARY KEY,
  text        TEXT NOT NULL,
  voice_id    TEXT NOT NULL,
  created_at  TEXT NOT NULL,           -- ISO 8601 UTC
  -- added in 002 (guarded ALTER TABLE ... ADD COLUMN; backfilled for 001 rows):
  path        TEXT,                    -- relative to data/; legacy backfill 'audio/<id>.mp3'
  model       TEXT,                    -- backfill NULL (treated as default)
  format      TEXT,                    -- backfill 'mp3'
  speed       REAL,                    -- backfill NULL (treated as 1.0)
  tag_title   TEXT,
  tag_artist  TEXT,
  tag_album   TEXT,
  tag_genre   TEXT,
  tag_comment TEXT,
  tag_recorded_at TEXT,                -- full timestamp OR year-only (FR-020)
  tag_track   TEXT,                    -- 'n' or 'n/total'
  tags_extra  TEXT                     -- JSON: { languages: string[], customText: [...], customUrl: [...] }
);

CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations (created_at DESC);
-- search/sort filter columns are low-cardinality / LIKE-scanned; add targeted
-- indexes (voice_id, format) only if profiling shows a need (YAGNI).
```

Migration is idempotent: each `ADD COLUMN` runs only if `PRAGMA table_info(generations)`
lacks it; a one-time backfill sets `path`/`format` for pre-002 rows.

## Value object: Metadata (tag set)

Embedded in a Generation and edited on the form, queue rows, and Library editor (FR-018).
Saving **replaces the whole set** — clearing a field removes it (FR-023).

| Field | Type | Notes |
|-------|------|-------|
| `title` | string? | Also the filename source (US4). Never auto-renames on edit (FR-031). |
| `artist` | string? | |
| `album` | string? | |
| `genre` | string? | |
| `comment` | string? | |
| `recordedAt` | string? | Full timestamp or year-only (FR-020). |
| `track` | string? | `n` or `n/total`. |
| `languages` | string[] | ISO 639-2 codes, multi-value (TLAN). Stored in `tags_extra`. |
| `customText` | `{ description: string; value: string }[]` | Description-keyed, repeatable → TXXX. `tags_extra`. |
| `customUrl` | `{ description: string; url: string }[]` | Description-keyed, repeatable → WXXX (ID3 only). `tags_extra`. |

**Per-format applicability** (drives the "skipped with a notice" behaviour, FR-021):

| Format | Tag path | Custom URL |
|--------|----------|-----------|
| MP3, WAV | ID3v2.4.0 (full set) | written (WXXX; see core-api WXXX risk) |
| FLAC, Opus | Vorbis comments (fields with a native equivalent) | **skipped** with notice |
| AAC, PCM | **untaggable** — all tagging skipped, generation still completes | n/a |

## Entity (ephemeral): ListItem (batch queue row)

Per-session generation request. **Never persisted** (FR-010); lives in client state.

| Field | Type | Notes |
|-------|------|-------|
| `clientId` | string | Local key for the row. |
| `text` | string | Trimmed; 1–4,096 chars (FR-016). |
| `voiceId`, `model`, `format` | string | Editable per row (FR-015). Inherit form selection when added. |
| `instructions` | string? | Retained across model changes; **sent only** for `gpt-4o-mini-tts` (FR-013). |
| `metadata` | Metadata | Per-row; pre-filled from defaults except Title (FR-048). |

`speed` is **not** on ListItem — it is a single form-level value applied to all rows
(FR-014).

## Catalogs (read-only, core constants — not stored)

- **Voice**: `{ id, label }`, widened set (alloy, ash, ballad, coral, echo, fable, onyx,
  nova, sage, shimmer, verse, marin, cedar). Served via `GET /api/voices` + `#core/client`.
- **Model**: `tts-1`, `tts-1-hd`, `gpt-4o-mini-tts`. `#core/client` constant.
- **Format**: mp3, wav, flac, opus, aac, pcm (+ extension + tag capability). `#core/client`.

## Entity: AppConfig (server-side settings store)

Single key/value table for server-side app configuration; currently the encrypted key.

```sql
CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

| Key | Value | Notes |
|-----|-------|-------|
| `openai_api_key` | AES-256-GCM payload (`iv:authTag:ciphertext`, base64) | Decrypted server-side only with `NUXT_APP_SECRET`; never returned to client (FR-041/043). Absent ⇒ fall back to env (FR-042). **If `NUXT_APP_SECRET` is unset, this row cannot be written** (in-app storage disabled); resolution uses env only. |

**Not stored here**: theme + language (client cookie, FR-038/039); default tag values
(env config, FR-048); app version (package.json, FR-046).

## Query model: library listing

`list(query)` parameters (all optional; compose — FR-034–036):

```ts
type LibraryQuery = {
  q?: string                                  // free-text LIKE over title, text, tags, filename
  voiceId?: string
  format?: string
  from?: string; to?: string                  // created_at range (inclusive)
  sort?: 'createdAt' | 'title' | 'voice' | 'format'   // default 'createdAt'
  order?: 'asc' | 'desc'                       // default 'desc'
  page?: number; pageSize?: number            // default page 1
}
// → { rows: Generation[]; total: number; page: number; pageSize: number }
```

`bulkClean({ from?, to?, voiceId? })` → deletes matching rows **and** their audio files,
returns `{ deleted: number }` (FR-037; confirmation handled in UI).

## Integrity rules (extends 001)

- **Atomic save**: write the (tagged) audio to its dated, collision-safe path first, then
  insert the row referencing that `path`; on row-insert failure, delete the orphan file.
- **Tagging before save**: bytes are tagged (or skip-noticed for AAC/PCM/unsupported fields)
  *before* being written; a tagging failure fails that item only — nothing is saved (FR-006).
- **Rename**: re-slug the new name (cap 64, collision suffix in the same dated folder), move
  the file, update `path`; reject empty/un-sluggable names keeping the original; extension
  immutable (FR-031).
- **Retag**: rewrite embedded tags on the stored file (taglib-wasm in-memory → atomic replace)
  and replace the persisted Metadata set together; AAC/PCM keep filename editable, tags
  skipped (FR-030/033).
- **Cascade delete / bulk-clean**: remove row(s) and the referenced file(s) together
  (FR-032/037).
- **Secret hygiene**: the OpenAI key is never a Generation field, never logged, never echoed
  (FR-043).
- **Missing-file tolerance**: a row whose `path` is absent surfaces an "unavailable" state
  rather than breaking the library (edge case).

## Transient (non-persisted) UI state

- **Queue**: the ListItem array + the form-level voice/model/format/speed and the shared
  metadata defaults. Per-item generation status: `queued → generating → (done | failed:reason)`.
- **Settings**: theme + language (cookie); a masked key status fetched from the server.
