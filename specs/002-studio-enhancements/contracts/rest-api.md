# API Contract: TTS Studio Enhancements

**Feature**: `002-studio-enhancements` | **Surface**: Nitro HTTP routes (web)

Extends the 001 contract. All JSON is UTF-8; timestamps ISO 8601 UTC. No authentication
(operator-secured). The OpenAI key is never returned, logged, or echoed in any message.

## Shared types

```ts
type Voice  = { id: string; label: string }
type Model  = 'tts-1' | 'tts-1-hd' | 'gpt-4o-mini-tts'
type Format = 'mp3' | 'wav' | 'flac' | 'opus' | 'aac' | 'pcm'

type Metadata = {
  title?: string; artist?: string; album?: string; genre?: string; comment?: string
  recordedAt?: string                 // full timestamp OR year-only
  track?: string                      // 'n' or 'n/total'
  languages?: string[]                // ISO 639-2
  customText?: { description: string; value: string }[]
  customUrl?:  { description: string; url: string }[]
}

type Generation = {
  id: string
  text: string
  voiceId: string
  model: Model
  format: Format
  speed: number
  createdAt: string
  filename: string                    // basename of the stored path
  metadata: Metadata
  audioUrl: string                    // "/api/generations/<id>/audio"
  skippedTags?: string[]              // fields/paths skipped for this format (notice; FR-021)
}
```

## Error envelope

```ts
type ApiError = { error: { code: ErrorCode; message: string } }
```

| `code` | HTTP | Meaning |
|--------|------|---------|
| `EMPTY_INPUT` | 400 | Text empty/whitespace (FR-016) |
| `INPUT_TOO_LONG` | 400 | Text > 4,096 chars (FR-009) |
| `INVALID_VOICE` | 400 | `voiceId` not in catalog |
| `INVALID_MODEL` | 400 | `model` not in catalog |
| `INVALID_FORMAT` | 400 | `format` not in catalog |
| `INVALID_FILENAME` | 400 | Library rename empty/un-sluggable (FR-031) |
| `UPLOAD_TOO_LARGE` | 413 | `.txt` ≥ 5 MB (FR-004) — if server-side upload is used |
| `NO_API_KEY` | 400 | No UI key and no env key (FR-045); nothing saved |
| `KEY_STORAGE_DISABLED` | 409 | In-app key storage disabled — no `NUXT_APP_SECRET` (FR-042/043); env key still used, nothing stored |
| `PROVIDER_UNAVAILABLE` | 502 | TTS provider failed (FR-006); nothing saved |
| `TAGGING_FAILED` | 502 | Tagging step failed for a taggable format; that item not saved |
| `NOT_FOUND` | 404 | Unknown id (or row exists but file missing → "unavailable") |

---

## Generation & catalogs

### GET /api/voices
List the (widened) voice catalog. **200** → `{ voices: Voice[] }`.
*(Models/Formats are static `#core/client` constants — no endpoint.)*

### POST /api/generations
Generate one item and save it (FR-006/007). The batch is the client looping this per row,
so a single failure is isolated.
- **Body**: `{ text, voiceId, model, format, speed, instructions?, metadata }`
  (`instructions` ignored unless `model === 'gpt-4o-mini-tts'`, FR-013).
- **201** → `Generation` (includes `skippedTags` when the format dropped fields).
- **Errors**: `EMPTY_INPUT`, `INPUT_TOO_LONG`, `INVALID_VOICE|MODEL|FORMAT` (400);
  `NO_API_KEY` (400); `PROVIDER_UNAVAILABLE` / `TAGGING_FAILED` (502) — nothing saved, no
  orphan file. Validation runs before any provider call; the active key is resolved per
  request (UI → env).

### GET /api/generations
List saved generations with composable query (FR-034–036).
- **Query**: `q, voiceId, format, from, to, sort(createdAt|title|voice|format),
  order(asc|desc), page, pageSize`. Defaults: newest-first, page 1.
- **200** → `{ generations: Generation[]; total: number; page: number; pageSize: number }`
  (empty array drives empty-state UI).

### GET /api/generations/:id/audio
Stream the stored file for playback/download — **no provider request** (SC).
- **Query**: `?download=1` → `Content-Disposition: attachment; filename="<real filename>"`.
- **200** → binary, `Content-Type` per format (e.g. `audio/mpeg`, `audio/wav`, `audio/flac`,
  `audio/opus`, `audio/aac`, `audio/L16`). Resolves via the stored `path`.
- **Errors**: `NOT_FOUND` (unknown id, or row exists but file missing/unreadable).

### PATCH /api/generations/:id
Rename and/or retag a saved item (FR-030/031).
- **Body**: `{ filename?: string; metadata?: Metadata }` (partial).
- **200** → updated `Generation` (reports the **final** filename after slug+collision rules;
  `skippedTags` when the format dropped fields). Editing `metadata.title` does **not** rename.
- **Errors**: `INVALID_FILENAME` (400, original kept); `NOT_FOUND` (404);
  `TAGGING_FAILED` (502, original file untouched).

### DELETE /api/generations/:id
Permanently delete the entry + its audio (FR-032; UI confirms first). **204** / `NOT_FOUND`.

### POST /api/generations/archive
Bundle a batch as one `.zip` (FR-008).
- **Body**: `{ ids: string[] }`.
- **200** → `application/zip` stream (entries named by each item's filename; duplicate
  names disambiguated). Unknown ids are skipped (or `NOT_FOUND` if none resolve).

### POST /api/library/bulk-clean
Bulk-delete by date/voice (FR-037; UI confirms first).
- **Body**: `{ from?: string; to?: string; voiceId?: string }` (at least one filter).
- **200** → `{ deleted: number }` (rows + files removed).

---

## Settings

### GET /api/settings/openai-key
- **200** → `{ configured: boolean; masked?: string; source: 'ui' | 'env' | 'none';
  secretConfigured: boolean }` (plaintext never returned — FR-041). `secretConfigured:false`
  ⇒ no `NUXT_APP_SECRET`; the UI disables the key controls and shows a "set NUXT_APP_SECRET to
  enable in-app key storage" notice (env key, if any, is still used).

### PUT /api/settings/openai-key
- **Body**: `{ key: string }` → store **encrypted at rest** (FR-043).
- **200** → `{ configured: true; masked: string; source: 'ui'; secretConfigured: true }`.
- **Errors**: `KEY_STORAGE_DISABLED` (409) when `NUXT_APP_SECRET` is unset — nothing stored;
  the env key remains in use.

### DELETE /api/settings/openai-key
Clear the UI key → revert to env (FR-042). **200** →
`{ configured, masked?, source: 'env' | 'none' }`.

### POST /api/settings/openai-key/test
Test the **active** resolved key (FR-044). **200** → `{ ok: boolean }` (no key details on
failure).

### GET /api/settings/defaults
Non-secret default tag values for pre-filling the form (FR-048; Title never defaulted).
- **200** → `{ defaultTags: Metadata }` (omits/blank on invalid config — never 500s).

*(App version is exposed via `runtimeConfig.public.appVersion`, not an endpoint — FR-046.)*

---

## Contract test checklist (Phase 2 → tests)

- [ ] `GET /api/voices` returns the widened catalog.
- [ ] `POST /api/generations` valid → 201 with `format`, `filename`, `metadata`, `audioUrl`; entry appears in `GET`.
- [ ] `POST` empty / >4096 / bad voice|model|format → correct 400, nothing saved.
- [ ] `POST` with no UI key and no env key → 400 `NO_API_KEY`, nothing saved.
- [ ] `POST` provider failure → 502, nothing saved, no orphan file.
- [ ] FLAC/Opus drop custom-URL → `skippedTags` set; AAC/PCM → all tags skipped, still 201.
- [ ] Two same-title items → distinct filenames (`_2`), neither overwrites; both under `YYYY/MM/DD`.
- [ ] `GET /api/generations?q=&sort=&order=&voiceId=&format=&from=&to=&page=&pageSize=` composes; `total` accurate.
- [ ] `PATCH` filename → re-slugged, file renamed, final name reported; empty name → 400, original kept; title edit does not rename.
- [ ] `PATCH` metadata → file retagged + persisted; reopening shows the same values after restart.
- [ ] `DELETE` removes row+file → 204; `archive` returns a zip of the given ids; `bulk-clean` returns `deleted` count and removes files.
- [ ] `GET .../audio` sets the right `Content-Type`, makes no provider call; `?download=1` uses the real filename.
- [ ] Settings key: `PUT` then `GET` shows masked only; `DELETE` reverts to env; `test` reports active key; key never appears in any response/log.
- [ ] No `NUXT_APP_SECRET`: `GET` → `secretConfigured:false`; `PUT` → 409 `KEY_STORAGE_DISABLED` (nothing stored); generation still uses the env key.
- [ ] Legacy 001 rows (UUID filename, flat path) still list, play, and download after migration.
