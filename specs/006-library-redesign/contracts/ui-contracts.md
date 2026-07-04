# Phase 1 UI & Query Contracts: Library Tab Redesign

**Feature**: 006-library-redesign · **Date**: 2026-06-24 · Companion to [data-model.md](../data-model.md),
[plan.md](../plan.md). Defines the component APIs (props / emits / `v-model`), the `data-test`
ledger, keyboard/AT contracts, and the one server query-extension contract. These are the
**red-first test targets**; `wavesurfer.js` is mocked.

Conventions: components auto-imported (don't import via `~`); composable **types** imported by
relative path; all labels via `t()` (en/hu parity, FR-025); every interactive control keyboard-
operable + ARIA-labelled (FR-026).

---

## A. Server query-extension contract (R-FILTER) — `LibraryQuery`

Additive, optional, read-only over existing columns. Contract the core unit tests assert:

| Param | Type | Behavior | Test |
|---|---|---|---|
| `genre` | `string?` | rows where `tag_genre` matches | filter narrows to matching genre; absent → unchanged |
| `language` | `string?` | rows whose `tags_extra.languages` contains the code | filter narrows; multi-value membership |
| `recordedFrom` / `recordedTo` | `string?` (ISO) | inclusive bounds over `tag_recorded_at`; null `recordedAt` excluded when bounded | range narrows; open-ended bound works |
| `sort` | `+ 'filename'|'artist'|'album'|'recordedAt'|'track'|'genre'|'comment'` | `ORDER BY` matching column; "Year"+"Date"→`recordedAt`, "Filename"→stored name; Composer/Duration/Bitrate unsortable; stable 2nd sort `createdAt` | each new key orders asc/desc |
| **Back-compat** | — | all new params optional; omitting them reproduces current results | existing list tests stay green |

Route: accepts + validates the new optional query params and forwards them; rejects nothing that was
previously accepted. **No schema/migration; retag/delete/generation untouched.**

### A2. Server contract — R-TAGS (extra editable tag fields)

`Metadata` (core) gains optional `notes`, `encodedBy`, `albumArtist`, `composer`, `bpm`, `rating`,
**persisted in the existing `tags_extra` JSON** (no SQL column). The retag route
`server/api/generations/[id].patch.ts` accepts these in the `metadata` patch; the taglib mapping
writes/reads their ID3 frames. Tests: editing each extra field → PATCH → reload round-trips it;
existing rows without the keys read back empty; **no migration runs**.

### A3. Server contract — R-AUDIOPROPS (read-only audio properties)

The list route `server/api/generations.get.ts` (and item serving) attaches read-only
`audioProperties { codec?, bitrate?, sampleRate?, duration? }` per item, read via taglib
`audioProperties` (a new `src/core/library/audio-properties.ts`). Tests: a real file yields
codec/bitrate/sampleRate; an unreadable/missing file yields an empty object, not an error; nothing
is persisted.

---

## B. Page — `library-next.vue` (FR-001)

Owns `useLibrary` (extended), `useViewPreferences`, `useTagDrafts`, and selection state. Composes
`DashboardWorkspace` (`#list` = filter bar + file table, `#detail` = inspector, `#footer` = waveform)
+ `LibraryStatusBar`. Cutover (FR-002) renames this to `library.vue` and deletes the old surface.

`data-test`: `library-next` (root).

---

## C. `LibraryFilterBar.vue` (US3 / FR-011-012) — supersedes `LibrarySearchBar`

- **v-model**: `query: LibraryQuery` (patches reset `page` to 1, per the 005 pattern).
- Controls: search-all (`q`), audio-format select, a **single recording-date** (`UPopover`+
  `UCalendar`, one day → sets `recordedFrom`/`recordedTo` to that day's start/end bounds), genre
  select, language select. An "all" sentinel clears each select (reka-ui forbids empty-string item
  values — reuse the `__all__` sentinel pattern).
- **`data-test`**: `library-search`, `filter-format`, `filter-recorded-date`,
  `filter-recorded-date-clear`, `filter-genre`, `filter-language`.
- **Keyboard/AT**: each control labelled via `UFormField`; selects are `USelectMenu` (keyboard
  combobox); clearing restores the list (FR-012).

---

## D. `LibraryFileTable.vue` (US1/US4 / FR-005/FR-013/FR-014/FR-017) — forks `LibraryTable`

- **props**: `items: LibraryItem[]`, `total: number`, `loading?: boolean`.
- **v-model**: `selectedIds: Set<string>` (multi-select), `activeId: string | null` (row click →
  inspector), `query: LibraryQuery` (sort/page).
- **emits**: `bulk-delete []`, `open-bulk-tag-edit []`, `toggle-inspector []`.
- Columns: **Filename (always-on)**, Title, Artist, Album, Year, Track, Genre (+ optional
  voice/format/created), visibility/order from `useViewPreferences.libraryColumns`. Sortable headers
  drive `query.sort`/`query.order`. Selected row highlighted (`aria-pressed`/selected style). Leading
  checkbox column: header **select-all** + per-row.
- **`data-test`**: `library-file-table`, `select-all`, `row-select-<id>`, `library-row` (rows,
  `:aria-pressed="activeId===id"`), `sort-<columnId>`, `open-columns-dialog` (gear),
  `toggle-inspector`, `bulk-delete`, `open-bulk-tag-edit`, `page-prev`/`page-next`/`page-status`.
- **Keyboard/AT**: checkboxes are `UCheckbox` (space toggles); sort headers are buttons (Enter/Space);
  rows activate via click/Enter; bulk actions disabled when `selectedIds` empty.

---

## E. `LibraryColumnsDialog.vue` (US4 / FR-017/FR-031) — `UModal`

- **props**: `open: boolean`.
- **v-model**: `columns: LibraryColumnPref[]` (ordered). Toggleable set per design: Title, Artist,
  Album, Year, Track, Genre, Comment, Date, Composer, Duration, Bitrate (Composer/Duration/Bitrate
  display-only). **Filename** not listed (always-on); **not-all-hidden** guard.
- Toggle visibility + **reorder** (drag grip / move up-down). Footer: **Reset to defaults · Cancel ·
  Apply** (FR-031). Persists across sessions.
- **`data-test`**: `columns-dialog`, `column-toggle-<id>`, `column-grip-<id>`, `column-move-up-<id>`,
  `column-move-down-<id>`, `columns-reset`, `columns-cancel`, `columns-apply`.
- **Keyboard/AT**: focus-trapped modal; toggles are checkboxes; move/reorder controls are buttons.

---

## F. `BulkTagEditDialog.vue` (US4 / FR-016) — `UModal`

- **props**: `open: boolean`, `count: number` (selected recordings).
- **emits**: `apply [{ field: EditableTagField; value: string }]`, `close []`.
- Field select limited to **Title, Artist, Album, Comment, Date, Track Number, Genre, Language**
  (filename excluded); value input typed to the field. Applying overwrites across the selection.
- **`data-test`**: `bulk-tag-edit-dialog`, `bulk-field`, `bulk-value`, `bulk-apply`, `bulk-cancel`,
  `bulk-result` (succeeded/failed summary).
- **Keyboard/AT**: focus-trapped; result summary `role="status"`.

---

## G. `TagInspector.vue` (US1/US5 / FR-005/FR-006/FR-018-022/FR-032) — forks `AudioTagsPanel`+`LibraryItemEditor`

- **props**: `item: LibraryItem | null`, `hasPrev: boolean`, `hasNext: boolean`,
  `fields: InspectorFieldPref[]` (ordered).
- **emits**: `prev []`, `next []`, `play []`, `save []`, `open-fields-dialog []`, `delete [id]`.
- Header shows a **fixed title "Tag Editor (ID3v2.4)"** (FR-032) + settings gear. Toolbar =
  **Previous · Next · Play Audio · Save** (Save in the toolbar). Edits go through **`useTagDrafts`**
  (staged per recording, auto-preserved on switch — Q4); **Save** commits via the page's
  `useLibrary.update`. **All 15 fields editable** (the 6 extra via R-TAGS); fields render in the
  order/visibility from `fields`. Empty state when `item === null`.
- **`data-test`**: `tag-inspector`, `inspector-title`, `inspector-fields-gear`, `tags-prev`,
  `tags-next`, `inspector-play`, `inspector-save`, `inspector-dirty`, `inspector-delete`,
  `tags-empty`, and one per field: `field-name`, `field-text`, `field-title`, `field-artist`,
  `field-album`, `field-comment`, `field-date`, `field-track`, `field-genre`, `field-encodedby`,
  `field-language`, `field-albumartist`, `field-composer`, `field-bpm`, `field-rating`.
- **Keyboard/AT**: Prev/Next disabled at global bounds (R-NAV); Save reflects dirty state; gear opens
  the fields dialog; inputs labelled via `UFormField`. Switching recordings must **not** discard
  unsaved edits (restores staged buffer).

---

## H. `InspectorFieldsDialog.vue` (US5 / FR-020/FR-031) — `UModal`

- **props**: `open: boolean`.
- **v-model**: `fields: InspectorFieldPref[]` (ordered; the 14 toggleable field ids, Name always-on).
- Toggle **and reorder** (drag grip) which inspector fields show; **not-all-hidden** guard. Footer:
  **Reset to defaults · Cancel · Apply** (FR-031). Persists.
- **`data-test`**: `inspector-fields-dialog`, `field-toggle-<id>`, `field-grip-<id>`,
  `inspector-fields-reset`, `inspector-fields-cancel`, `inspector-fields-apply`.

---

## I. `LibraryStatusBar.vue` (US6 / FR-023) — read-only

- **props**: `saveState: 'saved' | 'unsaved'`, `dirtyCount: number`, `filesLoaded: number`,
  `selection: string | null`, `charset: 'UTF-8'`,
  `audio?: { codec?: string; bitrate?: number; sampleRate?: number }` (from R-AUDIOPROPS).
- Renders e.g. "All changes saved · 10 files loaded · Selected: 1 file (…)" and right-aligned
  "UTF-8 · MPEG-1 Layer 3 (320 kbps, 44100 Hz)"; audio items blank where unreadable.
- **`data-test`**: `status-bar`, `status-save`, `status-files`, `status-selection`, `status-charset`,
  `status-audio`.
- **AT**: `role="status"` region; save-state change announced.

---

## J. `WaveformPlayer.vue` (US2 / FR-007-010) — **reused 005, contract unchanged**

- **props**: `src: string`, `label?: string`. **emits**: `error [Error]`.
- Play/pause, **single A–B loop** region + repeat toggle, zoom range, unavailable state.
- **`data-test`** (existing): `waveform-player`, `waveform-canvas`, `waveform-unavailable`,
  `waveform-play`, `waveform-add-region`, `waveform-loop-toggle`, `waveform-zoom`.
- **Test**: `wavesurfer.js` mocked (no canvas/WebAudio in happy-dom).

---

## K. Composable contracts

### `useLibrary` (extended)
- Query carries the R-FILTER params. New wrappers (over existing `remove`/`update`):
  `removeMany(ids: string[]): Promise<void>` (reload once after) and
  `bulkRetag(ids, field, value): Promise<{ succeeded: number; failed: string[] }>` (sequential).
- Cross-page nav helpers expose global `hasPrev`/`hasNext` (from `total`+`page`+`pageSize`) and
  resolve selection to the first/last row of an adjacent page after a boundary page change (R-NAV).

### `useViewPreferences` (extended)
- Adds `libraryColumns` (ordered, Filename-always-on, not-all-hidden) and `inspectorFields`
  (not-all-hidden), persisted to the two `localStorage` keys. SSR-safe.

### `useTagDrafts` (new)
- `draftFor`, `isDirty(id)`, `dirtyCount`, `commit(id)` (→ `useLibrary.update`, clears on success),
  `discard(id)`. In-memory, session-scoped; auto-preserves across selection changes.

---

## L. i18n key namespaces (en/hu parity, FR-025)

Extend `library.*`: `library.filters.{genre,language,allGenres,allLanguages,recordedRange}`,
`library.columns.{title,artist,album,year,track,genre}`, `library.columnsDialog.*`,
`library.bulkTagEdit.*`, `library.inspector.{title,fields...,readonly}`,
`library.inspectorFields.*`, `library.status.{saved,unsaved,files,selection,encoding}`,
`library.toggleInspector`. Every new `t()` key MUST exist in **both** `en.json` and `hu.json`
(asserted by the i18n parity test).
