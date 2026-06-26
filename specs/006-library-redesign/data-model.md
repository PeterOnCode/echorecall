# Phase 1 Data Model: Library Tab Redesign (Waveform Tag-Editor)

**Feature**: 006-library-redesign · **Date**: 2026-06-24 · **Source of truth**: [spec.md](./spec.md),
005 [data-model.md](../005-dashboard-redesign/data-model.md) (unchanged baseline).

This feature requires **no SQL schema migration**. It introduces three migration-free core
extensions — (1) **R-FILTER** additive read-only `LibraryQuery` params, (2) **R-TAGS** extra
editable `Metadata` fields persisted in the existing `tags_extra` JSON column, (3) **R-AUDIOPROPS**
read-only `AudioProperties` computed on read — plus new **client-side** shapes in `app/` for view
preferences, the inspector field set, the staged-edit (dirty) buffer, and the table selection.

---

## 1. Entities

### `Metadata` (`src/core/shared/types.ts`) — extended for R-TAGS
Existing dedicated fields (unchanged): `title?`, `artist?`, `album?`, `genre?`, `comment?`,
`recordedAt?`, `track?`, `languages?: string[]`, `customText?`, `customUrl?`. **NEW (R-TAGS,
serialized into the existing `tags_extra` JSON — no SQL column):** `notes?` (Text/notes, via a
`customText` value), `encodedBy?`, `albumArtist?`, `composer?`, `bpm?` (integer), `rating?` (0–5
stars → ID3 POPM). The inspector edits this shape via the existing rename+retag PATCH; the taglib
mapping writes each as its native ID3 frame (TENC/TPE2/TCOM/TBPM/POPM; notes via `customText`) **and**
mirrors it in the SQLite `tags_extra` JSON — no new SQL column.

### `AudioProperties` (NEW, R-AUDIOPROPS) — read-only, computed on read
`{ codec?: string; bitrate?: number; sampleRate?: number; duration?: number }` — read server-side
from the audio file (taglib `audioProperties`); never persisted, never edited.

### `LibraryItem` (`app/composables/useLibrary.ts`) = `Omit<Generation,'path'>` + `filename` + `audioUrl` + `skippedTags?` + `audioProperties?`
Carries `id`, `text`, `voiceId`, `model`, `format`, `speed`, `createdAt`, `metadata` (extended),
`filename` (backs **Name**), `audioUrl` (waveform source), and **NEW** `audioProperties?`
(R-AUDIOPROPS) for the status bar + Duration/Bitrate columns.

**Inspector field → backing map** (R-FIELDS / FR-018; **all editable**):

| Field | Backing |
|---|---|
| Name | `filename` (base, rename) |
| Title / Artist / Album / Comment / Genre | `metadata.{title,artist,album,comment,genre}` |
| Date | `metadata.recordedAt` |
| Track Number | `metadata.track` |
| Language | `metadata.languages` (multi) |
| Text/notes | `metadata.notes` → `tags_extra` (R-TAGS) |
| Encoded-By | `metadata.encodedBy` → `tags_extra` (R-TAGS) |
| Album Artist | `metadata.albumArtist` → `tags_extra` (R-TAGS) |
| Composer | `metadata.composer` → `tags_extra` (R-TAGS) |
| BPM | `metadata.bpm` → `tags_extra` (R-TAGS) |
| Rating | `metadata.rating` → `tags_extra` (R-TAGS) |

---

## 2. Extended entity — `LibraryQuery` (R-FILTER, additive & optional)

Lives in `src/core/shared/types.ts` (its existing home). **All new fields optional** → existing
callers, the list route, and a future CLI are unaffected.

```ts
export interface LibraryQuery {
  // --- existing (unchanged) ---
  q?: string
  voiceId?: string
  format?: Format
  from?: string          // createdAt range (generation time)
  to?: string
  sort?: 'createdAt' | 'title' | 'voice' | 'format'
        | 'filename' | 'artist' | 'album' | 'recordedAt' | 'track' | 'genre' | 'comment'   // ← NEW sort keys
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number

  // --- NEW (R-FILTER), read-only over already-existing columns ---
  genre?: string         // exact/like over tag_genre
  language?: string      // single ISO 639-2 matched within tags_extra.languages (multi-value)
  recordedFrom?: string  // ISO bound over tag_recorded_at (recording date, distinct from createdAt)
  recordedTo?: string    // ISO bound over tag_recorded_at
}
```

**Validation / behavior**:
- Empty/absent params → no constraint (current behavior preserved).
- `genre`: matches `tag_genre`. `language`: matches one code inside the JSON `tags_extra.languages`.
- `recordedFrom`/`recordedTo`: inclusive bounds over `tag_recorded_at`; rows with null `recordedAt`
  are excluded when either bound is set. The filter bar's **recording-date range picker** maps its
  start day → `recordedFrom` and end day → `recordedTo` as timezone-naive `YYYY-MM-DD` strings
  (compared as `>=`/`<=` against the date-only tag); either bound alone is a valid open-ended range.
- New sort keys map to existing columns: `filename`→the stored name/path, `tag_artist`, `tag_album`,
  `tag_recorded_at` (both **Year** and **Date**), `tag_track`, `tag_genre`, `tag_comment`.
  Composer / Duration / Bitrate are **display-only (not sortable)**. Stable secondary sort on
  `createdAt` retained.
- **No schema change, no migration** — every referenced column already exists in the
  `generations` table (`tag_genre`, `tag_recorded_at`, `tag_track`, `tag_album`, `tag_artist`,
  `tags_extra`).

Repository (`sqlite-repository.ts`): additive `WHERE` predicates + `ORDER BY` branches. Service /
route: pass-through validation of the optional params.

---

## 3. New client-side shapes (`app/` only — not persisted server-side)

### 3.1 Library view preferences (extends `useViewPreferences`, R-COLUMNS)

```ts
// Toggleable file-table columns (Filename is always-on, NOT in this set) — per the design.
type LibraryColumnId = 'title' | 'artist' | 'album' | 'year' | 'track' | 'genre'
                     | 'comment' | 'date' | 'composer' | 'duration' | 'bitrate'

interface LibraryColumnPref { id: LibraryColumnId; visible: boolean }   // ORDER = array order

// Inspector fields — ordered + toggleable (Name is always-on, NOT in this set). All 14 toggleable.
type InspectorFieldId = 'text' | 'title' | 'artist' | 'album' | 'comment' | 'date'
                      | 'track' | 'genre' | 'encodedBy' | 'language'
                      | 'albumArtist' | 'composer' | 'bpm' | 'rating'
interface InspectorFieldPref { id: InspectorFieldId; visible: boolean }  // ORDER = array order
```

- Persisted in `localStorage`: `echorecall:viewprefs:libraryColumns` (ordered array),
  `echorecall:viewprefs:inspectorFields` (visibility map). SSR-safe (localStorage-guarded).
- **Guards**: Filename column always present (FR-017); **not-all-hidden** on both the column set and
  the inspector field set (FR-017/FR-020) — reuse the existing `setColumn` guard pattern.
- Merge stored over defaults so newly-added ids default visible. Split size stays in
  `DashboardWorkspace`'s `@nuxt/ui` storage (unchanged).

### 3.2 Staged tag edits / dirty buffer (`useTagDrafts`, R-DRAFTS)

```ts
interface DraftPatch { filenameBase?: string; metadata?: Metadata }   // only changed parts
// Keyed by recording id; in-memory, session-scoped (NOT persisted).
type Drafts = Map<string, DraftPatch>

interface UseTagDrafts {
  draftFor(id: string, item: LibraryItem): Reactive<editable view>     // staged values for the active id
  isDirty(id: string): boolean                                         // draft differs from saved
  dirtyCount: ComputedRef<number>                                      // for the status bar
  commit(id: string): Promise<{ ok: boolean }>                         // → useLibrary.update; clears draft on success
  discard(id: string): void
}
```

- Switching selection **retains** drafts (Q4 auto-preserve); returning restores them.
- `commit` reuses the existing atomic rename+retag PATCH (`useLibrary.update`); no server change.
- Multiple ids may be dirty simultaneously.

### 3.3 Table selection (multi-select, R-BULK)

```ts
selectedIds: Ref<Set<string>>     // checkbox multi-select (header select-all + per-row)
activeId:    Ref<string | null>   // the single inspector/waveform target (row click / Prev / Next)
```

- `selectedIds` drives **bulk delete** and **bulk tag edit**; `activeId` drives the inspector,
  waveform, and status-bar selection. They are independent (you can bulk-edit without changing the
  inspected recording).

---

## 4. Status-bar projection (read-only, R-STATUS)

Derived only from data already in hand — no new entity:

| Field | Source |
|---|---|
| Save state | `useTagDrafts.isDirty(activeId)` / `dirtyCount` ("All changes saved" / unsaved) |
| Files loaded | `useLibrary.total` (filtered count) |
| Current selection | active `LibraryItem.filename` (or none) |
| Tag encoding | `UTF-8` (constant) |
| Audio properties | `LibraryItem.audioProperties` (R-AUDIOPROPS) → codec, bitrate, sample rate; blank where unreadable |

---

## 5. Relationships (client data flow)

```text
useLibrary (query → list/total, update, remove)
   │  query = q + voiceId + format + createdAt-range
   │        + genre + language + recordedAt-range + sort/order/page   ← R-FILTER (server)
   ▼
library-next.vue (owns query, items, total, selectedIds, activeId)
   ├─ LibraryFilterBar          → v-model:query
   ├─ LibraryFileTable          → :items :total, v-model:selected-ids, v-model:active-id,
   │     ├─ LibraryColumnsDialog (useViewPreferences.libraryColumns)
   │     └─ BulkTagEditDialog    (useLibrary.bulkRetag) / bulk delete (useLibrary.removeMany)
   ├─ TagInspector (active item) → useTagDrafts (stage/restore), Save→useLibrary.update, Prev/Next (R-NAV)
   │     └─ InspectorFieldsDialog (useViewPreferences.inspectorFields)
   ├─ WaveformPlayer (active item.audioUrl)        ← reused 005
   └─ LibraryStatusBar (projection §4)
```

**Invariants**: no audio-tag schema change; the only persisted-store touch is reading existing
columns (R-FILTER); all new persisted client state is `localStorage` view-prefs; drafts and
selection are in-memory.
