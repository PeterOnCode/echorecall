# Phase 1 UI Contracts: Dashboard Workspace Redesign

Component APIs (props / emits / v-model), the `data-test` ledger, and keyboard/AT contracts the
test suite asserts. **No HTTP/route/schema contracts** — this feature adds no server surface
(FR-018). Existing endpoints (`/api/generations`, `/api/generations/:id`, `/api/library/bulk-clean`,
`/api/settings/defaults`) are consumed **unchanged** via the existing composables.

Convention: every interactive control carries a stable `data-test`; tests drive components
through these and through `v-model`. New components are auto-imported (do **not** import via `~`);
composable *types* are imported by relative path (per repo typecheck gotchas).

---

## 1. `DashboardWorkspace.vue` (NEW, shared)

Resizable two-pane shell (R1). Surface-agnostic.

| Aspect | Contract |
|--------|----------|
| Props | `storageKey: string` (persists split size), `defaultRatio?: number` (initial list/detail split), `detailEmpty?: boolean` (render empty slot state) |
| Slots | `#list`, `#detail`, `#footer?` (Library waveform) |
| v-model | none |
| `data-test` | `dashboard-workspace`, `dashboard-resize-handle`, `dashboard-list-pane`, `dashboard-detail-pane`, `dashboard-detail-empty` |
| Keyboard/AT | resize handle is focusable with `role="separator"`, `aria-orientation="vertical"`, arrow-key resizable (provided by `UDashboardResizeHandle`); panes are labelled regions. |
| Behavior tests | split persists across remount under `storageKey` (FR-002); `detailEmpty` shows placeholder (FR-003). |

---

## 2. `GenerateToolbar.vue` (NEW)

`UDashboardToolbar` of primary actions (FR-004/FR-005/FR-005a).

| Aspect | Contract |
|--------|----------|
| Props | `hasPrev: boolean`, `hasNext: boolean`, `canGenerate: boolean`, `generating: boolean`, `checkedCount: number` |
| Emits | `upload`, `prev`, `next`, `generate`, `save-queue`, `open-queue`, `open-settings` |
| `data-test` | `toolbar-upload`, `toolbar-prev`, `toolbar-next`, `toolbar-generate`, `toolbar-save-queue`, `toolbar-open-queue`, `toolbar-open-settings` |
| Disabled rules | `prev` disabled when `!hasPrev`; `next` disabled when `!hasNext` (FR-005 boundaries); `generate` disabled when `!canGenerate` or `generating`. |
| Generate label hint | when `checkedCount > 0`, the generate control indicates it acts on the selection (FR-005a) — asserted via accessible name/title. |
| Keyboard/AT | all actions are `UButton`s (Enter/Space activate); hidden file inputs for upload/open-queue stay **out of tab order** (004 fix); icon-only buttons carry `aria-label`. |

---

## 3. `QueueList.vue` (ADAPT → list pane)

`UTable` with selection, source, search, filters, column visibility (FR-006/009/010/011/012).

| Aspect | Contract |
|--------|----------|
| Props | `items: QueueItem[]`, `voices: Voice[]`, `visibleColumns: Record<ColumnId,boolean>` |
| v-model | `v-model:checked-ids` (`Set<string>`), `v-model:active-id` (`string \| null`), `v-model:search` (`string`), `v-model:filters` (`QueueFilters`) |
| Emits | `open-columns` (request the column dialog) |
| `data-test` | `queue-table`, `queue-search`, `queue-filter-voice`, `queue-filter-format`, `queue-filter-album`, `queue-filter-recordedAt`, `queue-filter-language`, `queue-filters-clear`, `queue-row` (per row), `queue-row-checkbox`, `queue-row-source`, `queue-select-all`, `queue-columns-button`, `queue-delete-selected` |
| Source cell | shows `sourceName` (upload) or localized "Text Entered" (text) — `data-test="queue-row-source"`. |
| Selection | header checkbox toggles all *visible* rows; row checkbox toggles one; both reflected in `checked-ids`. |
| Active row | clicking a row sets `active-id` (loads detail pane, FR-003); selected row visually marked + `aria-selected`. |
| Keyboard/AT | rows reachable by keyboard; checkboxes are real `UCheckbox`; filters are `USelectMenu`/date-picker with labels. |

---

## 4. `QueueColumnsDialog.vue` (NEW)

`UModal` column-visibility chooser (FR-012).

| Aspect | Contract |
|--------|----------|
| Props | `open: boolean` (or `v-model:open`), `columns: Record<ColumnId,boolean>` |
| v-model | `v-model:open`, `v-model:columns` |
| `data-test` | `queue-columns-dialog`, `queue-column-toggle-<id>`, `queue-columns-apply` |
| Guard | toggling such that **all** would be hidden is prevented (last enabled toggle disabled) — FR-012. |
| Keyboard/AT | `UModal` focus trap + Escape close + focus return; toggles are labelled checkboxes. |

---

## 5. `MetadataFields.vue` (ADAPT — recording-date picker)

| Aspect | Contract |
|--------|----------|
| v-model | `v-model` (`Metadata`) — unchanged shape |
| New control | `recordedAt` rendered via `UPopover`+`UCalendar`; maps `CalendarDate` ↔ `recordedAt` string (R6) |
| `data-test` | existing `meta-*` retained; date picker adds `meta-recordedAt-trigger`, `meta-recordedAt-calendar`, `meta-recordedAt-clear` |
| Default | a newly created item's `recordedAt` is **tomorrow** (FR-008); field editable/clearable |
| Keyboard/AT | calendar is keyboard-navigable (design-system); trigger has an accessible label. |

---

## 6. `QueueItemEditor.vue` (ADAPT — detail pane)

Unchanged API except it renders inside the detail pane. Preserves `@blur` validate-and-commit
(repo memory: VTU `setValue` also fires `change`). `data-test` hooks retained.

---

## 7. `AudioTagsPanel.vue` (NEW — Library detail pane)

| Aspect | Contract |
|--------|----------|
| Props | `item: LibraryItem \| null`, `hasPrev: boolean`, `hasNext: boolean` |
| Emits | `prev`, `next`, `save` (`{ filename, metadata }`), `delete` (`id`) |
| `data-test` | `audio-tags-panel`, `tags-prev`, `tags-next`, `tags-empty` |
| Composition | embeds the existing `LibraryItemEditor` for the edit form (reused, not duplicated). |
| Navigation | `prev`/`next` change the active recording without returning to the table (FR-015); disabled at bounds. |
| Keyboard/AT | nav buttons labelled; panel is a labelled region. |

---

## 8. `WaveformPlayer.vue` (NEW — US6, behind amendment gate)

Wraps `wavesurfer.js` (R2). Loop regions only (FR-016 / Q2).

| Aspect | Contract |
|--------|----------|
| Props | `src: string`, `label?: string` |
| Emits | `error` (audio load failure → consumer shows unavailable state) |
| `data-test` | `waveform-player`, `waveform-canvas`, `waveform-play`, `waveform-zoom`, `waveform-add-region`, `waveform-loop-toggle`, `waveform-unavailable` |
| Behavior | mounts wavesurfer on `src`; `waveform-zoom` calls `zoom`; `waveform-add-region` creates a loop region; destroys on unmount/`src` change. |
| Testing | `wavesurfer.js` **mocked** (stub: `create`→instance with `load`/`zoom`/`on`/`destroy` + regions plugin stub); assert wiring, not rendering. |
| Keyboard/AT | play/zoom/region controls are real buttons with labels; missing audio → `waveform-unavailable` (no crash). |

---

## 9. `SettingsModal.vue` (NEW)

`UModal` hosting the four existing settings sections (FR-017 / Q3).

| Aspect | Contract |
|--------|----------|
| v-model | `v-model:open` |
| `data-test` | `settings-modal`, `settings-modal-close` |
| Composition | renders `AppearanceSettings`, `LanguageSettings`, `OpenAiKeySettings`, `DefaultTagsSettings` **unchanged**. |
| Keyboard/AT | focus trap + Escape + focus-return (UModal); opened from `toolbar-open-settings`. |
| IA change | `app/pages/settings.vue` removed; `layouts/default.vue` tab list = Generate, Library only. |

---

## 10. Composable contracts

### `useQueue` (ADAPT)
Adds: `checkedIds: Ref<Set<string>>`, `activeId: Ref<string|null>`, `searchTerm`, `filters`,
`visibleItems` (computed), `generateTarget` (computed), `toggleChecked(id)`, `toggleAll(visible)`,
`removeMany(ids)`, `serialize(): QueueFileDocument`, `loadDocument(doc)`. `addFromUpload(content,
filename)` gains the filename arg; `makeItem` sets `source` + tomorrow `recordedAt`.

### `useQueueFile` (NEW)
`exportQueue(doc, suggestedName?)` → triggers download; `importQueue(file)` →
`{ ok: true; doc } | { ok: false; reason: 'schema'|'version'|'shape' }`. Pure + unit-tested
(round-trip, malformed rejection).

### `useViewPreferences` (NEW)
`queueColumns: Ref<Record<ColumnId,boolean>>` (localStorage-backed, SSR-guarded);
`setColumn(id, visible)` enforces the not-all-hidden guard.

### `useGeneration` (ADAPT)
`generateAll` accepts a target list (checked-else-all from the caller) and **removes
successfully generated items** from the queue, leaving failures (FR-005b).

---

## `data-test` ledger (new/changed — summary)

```text
dashboard-workspace, dashboard-resize-handle, dashboard-list-pane, dashboard-detail-pane, dashboard-detail-empty
toolbar-upload, toolbar-prev, toolbar-next, toolbar-generate, toolbar-save-queue, toolbar-open-queue, toolbar-open-settings
queue-table, queue-search, queue-filter-voice, queue-filter-format, queue-filter-album, queue-filter-recordedAt, queue-filter-language, queue-filters-clear
queue-row, queue-row-checkbox, queue-row-source, queue-select-all, queue-columns-button, queue-delete-selected
queue-columns-dialog, queue-column-toggle-<id>, queue-columns-apply
meta-recordedAt-trigger, meta-recordedAt-calendar, meta-recordedAt-clear
audio-tags-panel, tags-prev, tags-next, tags-empty
waveform-player, waveform-canvas, waveform-play, waveform-zoom, waveform-add-region, waveform-loop-toggle, waveform-unavailable
settings-modal, settings-modal-close
add-text-input, add-text-submit
```

Existing hooks (e.g. `generate-all`, `download-all`, `meta-*`, library row/editor hooks) are
**preserved or their consuming tests updated in the same change** so the suite stays green.
