# Phase 1 Data Model: Dashboard Workspace Redesign

**Scope note**: This feature changes **no persisted/server data**. The SQLite schema, the core
`Generation`/`Metadata`/`ListItem`/`LibraryQuery` types in `src/core/shared/types.ts`, and all
Nitro routes are **unchanged** (FR-018, Principle IV). Everything below is **client-side state**
living in `app/` composables, plus one **file document** (the exported queue). Existing core
types are referenced (not redefined) to show the mapping.

---

## 1. QueueItem (extended — `app/composables/useQueue.ts`)

The ephemeral, never-persisted queue row. Extends the core `ListItem` (unchanged) with the
existing transient status fields **and two new presentation fields**.

| Field | Type | New? | Notes |
|-------|------|------|-------|
| `clientId` | `string` | — | UUID identity (from core `ListItem`). |
| `text` | `string` | — | Validated: trimmed, non-empty, ≤ `MAX_INPUT_LENGTH`. |
| `voiceId` / `model` / `format` | core types | — | Per-row generation inputs. |
| `instructions?` | `string` | — | Sent only for `gpt-4o-mini-tts`. |
| `metadata` | `Metadata` | — | Includes `recordedAt` (recording date), `album`, `languages`. |
| `status` | `'queued'\|'generating'\|'done'\|'failed'` | — | Transient. |
| `error?` / `result?` | — | — | Transient generation outcome. |
| `metadataEdited?` | `boolean` | — | Existing per-row-edit guard. |
| **`source`** | `'upload' \| 'text'` | ✅ | Origin of the row (FR-006). |
| **`sourceName?`** | `string` | ✅ | Uploaded filename when `source==='upload'`; absent for text. |

**Source-column display rule**: `source==='upload' ? sourceName : t('generate.queue.textEntered')`.

**Lifecycle (new/changed)**:
- *Create (text)* → `source:'text'`, `metadata.recordedAt` defaulted to **tomorrow**.
- *Create (upload)* → `source:'upload'`, `sourceName` = file name; one row per parsed line.
- *Generate success* → row **removed** from the queue (FR-005b).
- *Generate failure* → row **remains**, `status:'failed'` (retryable).

---

## 2. QueueSelection & filters (new state — `useQueue.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `checkedIds` | `Set<string>` (clientIds) | Multi-select for delete and generate-target (FR-005a/FR-011). |
| `activeId` | `string \| null` | The item shown in the detail pane; driven by list selection and toolbar prev/next (FR-003/FR-005). |
| `searchTerm` | `string` | Free-text over `sourceName`/`text` (FR-009). |
| `filters` | `{ voiceId?, format?, album?, recordedAt?, language? }` | Client-side queue filters (FR-010). |

**Derived**:
- `visibleItems` = items filtered by `searchTerm` + `filters` (order preserved).
- `generateTarget` = `checkedIds.size > 0 ? checked items : all items` (FR-005a).
- `activeIndex` / `hasPrev` / `hasNext` over `visibleItems` for toolbar navigation (FR-005 boundaries).

**Validation/guards**:
- Delete requires confirmation; on delete the `activeId` resolves to a neighbor or `null`.
- Adding empty text is rejected (FR-007) — reuses `validateItemText`.

---

## 3. QueueFileDocument (new — `app/composables/useQueueFile.ts`)

The exported/imported local file (R4). **Not stored by the app.**

```text
QueueFileDocument {
  schema:  "echorecall.queue"        // fixed discriminator
  version: 1                          // integer; import rejects unknown majors
  items:   QueueFileItem[]
}

QueueFileItem {                        // regeneratable inputs only — no transient state
  text:         string
  voiceId:      string
  model:        Model
  format:       Format
  instructions?: string
  metadata:     Metadata
  source:       'upload' | 'text'
  sourceName?:  string
}
```

**Validation on import** (all must hold, else reject with a localized message; current queue
untouched):
- top-level `schema === "echorecall.queue"` and `version === 1`;
- `items` is an array; each item has non-empty `text` (≤ cap), a `voiceId`, a valid `model` and
  `format`, and a `metadata` object (defaults to `{}`).
- Unknown/extra fields are ignored (forward-tolerant); `status`/`result`/`clientId` are **never**
  read from a file (fresh `clientId` assigned on import).

**Round-trip guarantee** (test, SC for save/open): export → import reproduces the same
regeneratable rows (text, voice, model, format, instructions, metadata, source, sourceName).

---

## 4. ViewPreferences (new — `app/composables/useViewPreferences.ts`)

Per-device client preferences in `localStorage` (R5). No server, no schema.

| Key | Type | Notes |
|-----|------|-------|
| `queueColumns` | `Record<ColumnId, boolean>` | Visible-column map for the queue `UTable`; guard prevents all-false (FR-012). |
| *(split size)* | — | **Not stored here** — `@nuxt/ui` dashboard storage owns pane size (R1/FR-002). |

`ColumnId` ∈ a fixed union of the queue columns (e.g. `select`, `source`, `text`, `voice`,
`format`, `recordedAt`, `language`, `status`). The `select` column is non-hideable.

---

## 5. Library detail-pane state (`app/pages/library.vue` + `AudioTagsPanel.vue`)

No new persisted data. The Library reuses `useLibrary` (`items`, `total`, `query`, `load`,
`update`, `remove`, `bulkClean`) **unchanged**. New client state:

| Field | Type | Notes |
|-------|------|-------|
| `selectedId` | `string \| null` | Active library row → drives the tags panel + waveform (FR-014). |
| `activeIndex` / prev / next | derived over loaded `items` | Tags-panel navigation (FR-015) within the current page of results. |

**Edge**: navigating prev/next past the loaded page bounds is disabled (no implicit page fetch in
this release; documented in quickstart).

---

## 6. WaveformRegion (transient UI — `WaveformPlayer.vue`)

A loop region marked on the waveform (FR-016 / Q2). **Display + playback-loop only**; never
modifies/exports audio and is **not persisted**.

| Field | Type | Notes |
|-------|------|-------|
| `start` / `end` | `number` (seconds) | Loop bounds within the clip. |
| `loop` | `boolean` | When set, playback loops within `[start,end]`. |

Lifecycle is owned by the wavesurfer Regions plugin instance; cleared on recording change and on
unmount.

---

## Entity → Requirement map

| Entity | Requirements |
|--------|--------------|
| QueueItem (`source`/`sourceName`, recordedAt default, remove-on-success) | FR-006, FR-008, FR-005b |
| QueueSelection & filters | FR-005a, FR-009, FR-010, FR-011, FR-003, FR-005 |
| QueueFileDocument | FR-013 |
| ViewPreferences | FR-002 (split via dashboard storage), FR-012 |
| Library detail-pane state | FR-014, FR-015 |
| WaveformRegion | FR-016 |
| (cross-cutting) i18n/a11y of all new controls | FR-019, FR-020 |
