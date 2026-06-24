---
description: "Task list for 005-dashboard-redesign implementation"
---

# Tasks: Dashboard Workspace Redesign

**Input**: Design documents from `specs/005-dashboard-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md, quickstart.md

**Tests**: REQUIRED. The constitution's Principle II (Test-First, NON-NEGOTIABLE) and the spec's
FR-019/FR-020/SC-009 mandate **red-first** component/unit specs and automated i18n/a11y gates.
Every implementation task is preceded by a failing test.

**Organization**: Tasks grouped by user story (priority order) for independent implementation and
testing. This is a **presentation-layer-only** feature — all paths are under `app/`, `tests/`,
and `i18n/`; **no `src/core/`, `server/`, or schema files are touched** (FR-018).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US7 (user-story phases only)
- All test/run commands go through `mise exec node@22.22.2 --` (Node pin).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared scaffolding used across stories.

- [X] T001 [P] Add new i18n namespace placeholders for the redesign to `i18n/locales/en.json` and `i18n/locales/hu.json` (`generate.toolbar`, `generate.columns`, `library.tags`, `library.waveform`, `settings.modal`; `generate.queue` already exists — keys filled per story)
- [X] T002 [P] Add a red-first automated en/hu key-parity test for the new namespaces in `tests/unit/i18n-parity.test.ts` (FR-019/SC-009)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared two-pane shell and queue state every story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Write red-first component test for the shared workspace in `tests/component/DashboardWorkspace.test.ts` (renders `#list`/`#detail` slots, `dashboard-detail-empty` placeholder, resize handle present + keyed to `storageKey` for FR-002 persistence)
- [X] T004 Create `app/components/dashboard/DashboardWorkspace.vue` using `UDashboardGroup`/`UDashboardPanel`/`UDashboardResizeHandle` (props `storageKey`, `defaultRatio?`, `detailEmpty?`; slots `#list`/`#detail`/`#empty`/`#footer?`; `data-test` per contract) to pass T003
- [X] T005 Write red-first test for foundational queue state in `tests/component/QueueState.test.ts` (`source`/`sourceName` set by add vs upload, `activeId`, `checkedIds`, `toggleChecked`, `toggleAll`, `removeMany`) — in the Nuxt env, not `tests/unit`, since the composable relies on Nuxt auto-imports
- [X] T006 Extend `app/composables/useQueue.ts`: add `source`/`sourceName` to `QueueItem`, `activeId`/`checkedIds` refs and `toggleChecked`/`toggleAll`/`removeMany`; `addFromUpload(content, filename)` gains the filename arg; `makeItem` sets `source` to pass T005

**Checkpoint**: Shared shell + queue state ready — user stories can begin.

---

## Phase 3: User Story 1 - Side-by-side generation workspace (Priority: P1) 🎯 MVP

**Goal**: Generate surface becomes the resizable two-pane workspace (queue list left, metadata
editor right); selecting a row loads its metadata; new items default recording date to tomorrow.

**Independent Test**: Open Generate with ≥2 items; selecting a row swaps the editor; dragging the
divider resizes and persists; a new item shows tomorrow's recording date in a calendar picker;
no selection → empty detail state.

### Tests for User Story 1 (red-first)

- [X] T007 [P] [US1] Rewrite `tests/component/QueueList.test.ts` red-first: rows render and clicking a row sets `active-id` (loads detail); `queue-row`/`queue-table` hooks
- [X] T008 [P] [US1] Rewrite `tests/component/MetadataFields.test.ts` red-first: `recordedAt` rendered as `UPopover`+`UCalendar`; new item defaults to **tomorrow**; editable/clearable (`meta-recordedAt-*`)
- [X] T009 [P] [US1] Rewrite `tests/component/Generate.test.ts` red-first: two-pane wiring — selecting a queue row loads the editor; empty selection shows `dashboard-detail-empty`
- [X] T009a [P] [US1] Create `tests/component/GenerateForm.test.ts` red-first: the defaults bar sets voice/model/format/speed (form-level `v-model`) so newly added items inherit them (FR-021)

### Implementation for User Story 1

- [X] T010 [US1] Adapt `app/components/generate/QueueList.vue` into the list pane (`UTable`, selectable rows emit/`v-model:active-id`) to pass T007
- [X] T011 [US1] Adapt `app/components/generate/MetadataFields.vue`: `recordedAt` → `UPopover`+`UCalendar`, default tomorrow, `CalendarDate`↔string via `@internationalized/date` to pass T008
- [X] T011a [US1] Adapt `app/components/generate/GenerateForm.vue` into a compact defaults bar (voice/model/format/speed → `useQueue` form-level refs); keep an interim text-add here until `AddTextPanel` (US4) replaces it to pass T009a (FR-021)
- [X] T012 [US1] Adapt `app/components/generate/QueueItemEditor.vue` to render in the detail pane (preserve `@blur` validate-and-commit)
- [X] T013 [US1] Rebuild `app/pages/index.vue` onto `DashboardWorkspace` (`#list`=QueueList, `#detail`=editor); wire `useQueue.activeId`; empty-state to pass T009. **Preserve** the 003 default-tags pre-fill (onMounted fetch → `setDefaults`) and the `defaults-hint` (SC-008); **keep an interim add path** (existing `UploadDropzone` + text-add) until US2/US4 so the MVP is demoable
- [X] T014 [P] [US1] Add US1 i18n keys (detail empty-state, recording-date picker labels) to `i18n/locales/en.json` + `i18n/locales/hu.json`

**Checkpoint**: Generate workspace is functional and independently testable (MVP).

---

## Phase 4: User Story 2 - Centralized action toolbar (Priority: P1)

**Goal**: A header toolbar with upload, prev, next, generate, save queue, open queue, open
settings; prev/next move the active selection (disabled at bounds); Generate targets checked-else-
all and removes successfully generated items; queues save/open as local files.

**Independent Test**: All actions present; next/prev move selection and disable at ends; checking
2 of 4 then Generate processes only those (none checked → all); successful items leave the queue;
Save downloads a `.echoqueue.json` that Open re-imports.

### Tests for User Story 2 (red-first)

- [X] T015 [P] [US2] Create `tests/component/GenerateToolbar.test.ts`: all `toolbar-*` actions present; prev disabled when `!hasPrev`, next when `!hasNext`; generate disabled rules; emits fire
- [X] T016 [P] [US2] Create `tests/unit/queue-file.test.ts`: export→import round-trips regeneratable rows; rejects bad `schema`/`version`/shape (malformed-import edge case)
- [X] T017 [P] [US2] Create `tests/integration/generate-remove-on-success.test.ts`: generate target = checked-else-all; successful items removed, failed items retained (FR-005a/FR-005b)
- [X] T017a [P] [US2] Extend `tests/integration/generate-remove-on-success.test.ts`: after a run, the run's successful ids are downloadable as one archive even though removed from the queue; no download offered when zero succeed (FR-022)

### Implementation for User Story 2

- [X] T018 [P] [US2] Create `app/composables/useQueueFile.ts` (`exportQueue` download; `importQueue` validate → ok/reason) to pass T016
- [X] T019 [US2] Extend `app/composables/useQueue.ts`: `serialize()`/`loadDocument()`, `visibleItems`-based `generateTarget`, `hasPrev`/`hasNext`/active-index navigation
- [X] T020 [US2] Adapt `app/composables/useGeneration.ts`: accept a target list (checked-else-all), remove successfully generated items from the queue, and expose the run's successful ids as last-batch state (FR-022) to pass T017/T017a
- [X] T021 [US2] Create `app/components/generate/GenerateToolbar.vue` (`UDashboardToolbar`; emits upload/prev/next/generate/save-queue/open-queue/open-settings) to pass T015
- [X] T022 [US2] Wire the toolbar into `app/pages/index.vue` + `app/components/common/AppHeader.vue`: upload reuses `UploadDropzone` (hidden input out of tab order); save/open via `useQueueFile` (warn before replacing a non-empty queue); open-settings stubbed until US7
- [X] T022a [US2] Add a post-run "download this batch" affordance in `app/pages/index.vue` using `useGeneration` last-batch ids (reuse `downloadArchive`); hidden when a run yields no successes (FR-022) to pass T017a
- [X] T023 [P] [US2] Add US2 i18n keys (toolbar labels, save/open queue, import-replace confirmation, import-error messages) to `i18n/locales/en.json` + `i18n/locales/hu.json`

**Checkpoint**: Generate redesign (US1+US2) is a usable, demoable increment.

---

## Phase 5: User Story 3 - Queue list curation (Priority: P2)

**Goal**: Queue search; filters by voice/format/album/recording-date/language; multi-select
checkbox + confirmed delete; source column (filename vs "Text Entered"); configurable column
visibility (persisted, can't hide all).

**Independent Test**: Search narrows by filename and text; each filter narrows and clears;
checked rows delete together after confirmation; source column distinguishes origins; hiding a
column persists and the last column can't be hidden.

### Tests for User Story 3 (red-first)

- [X] T024 [P] [US3] Create `tests/unit/view-preferences.test.ts`: `queueColumns` persists to localStorage; `setColumn` prevents hiding all columns
- [X] T025 [P] [US3] Extend `tests/component/QueueList.test.ts` red-first: search filters by filename+text; per-field filters + clear; select-all/row checkboxes drive `checked-ids`; `queue-row-source` shows filename vs "Text Entered"; `queue-delete-selected` confirms then removes; assert search/filter stays responsive with ≥200 seeded items (SC-003)
- [X] T026 [P] [US3] Create `tests/component/QueueColumnsDialog.test.ts`: toggles persist; last-visible toggle disabled; `queue-columns-*` hooks

### Implementation for User Story 3

- [X] T027 [P] [US3] Create `app/composables/useViewPreferences.ts` (`queueColumns` localStorage-backed, SSR-guarded; `setColumn` guard) to pass T024
- [X] T028 [P] [US3] Create `app/components/generate/QueueColumnsDialog.vue` (`UModal`, `v-model:columns`) to pass T026
- [X] T029 [US3] Extend `app/composables/useQueue.ts`: `searchTerm`/`filters` + `visibleItems` computed (client-side over filename/text + voice/format/album/recordedAt/language)
- [X] T030 [US3] Extend `app/components/generate/QueueList.vue`: search input, filter `USelectMenu`s + date picker, leading `UCheckbox` select column, source column, `queue-delete-selected` (reuse `ConfirmDialog`), columns trigger, bind `visibleColumns` to pass T025
- [X] T031 [US3] Wire columns dialog + multi-select delete (`removeMany`) into `app/pages/index.vue`
- [X] T032 [P] [US3] Add US3 i18n keys (search, filter labels, column names, "Text Entered", delete confirmation) to `i18n/locales/en.json` + `i18n/locales/hu.json`

**Checkpoint**: Long queues are searchable, filterable, prunable, and configurable.

---

## Phase 6: User Story 4 - Add an ad-hoc text item (Priority: P2)

**Goal**: A top panel to add one text entry to the queue (source "Text Entered"); empty rejected.

**Independent Test**: Entering text and adding creates a row with that text and a "Text Entered"
source; empty input is rejected with a reason.

### Tests for User Story 4 (red-first)

- [X] T033 [P] [US4] Create `tests/component/AddTextPanel.test.ts`: add creates a `source:'text'` row; empty input rejected (`add-text-*`)

### Implementation for User Story 4

- [X] T034 [US4] Create `app/components/generate/AddTextPanel.vue` (text input + add; rejects empty via `validateItemText`) to pass T033
- [X] T035 [US4] Wire `AddTextPanel` into `app/pages/index.vue` (calls `addItem`, sets `source:'text'`)
- [X] T036 [P] [US4] Add US4 i18n keys (add-text label/placeholder/empty error) to `i18n/locales/en.json` + `i18n/locales/hu.json`

**Checkpoint**: Ad-hoc text entry works alongside upload.

---

## Phase 7: User Story 5 - Library workspace parity (Priority: P2)

**Goal**: Library adopts the same two-pane layout (results table left, audio-tags panel right with
prev/next navigation).

**Independent Test**: Selecting a row loads its tags in the panel; prev/next move through
recordings updating tags without returning to the table; divider resizes and persists.

### Tests for User Story 5 (red-first)

- [X] T037 [P] [US5] Rewrite `tests/component/LibraryTable.test.ts` red-first: rows selectable → emit `selected-id` (inline `#expanded` editor removed)
- [X] T038 [P] [US5] Create `tests/component/AudioTagsPanel.test.ts`: loads selected item's tags; `tags-prev`/`tags-next` change active item and disable at bounds; `save`/`delete` emits; `tags-empty` when none selected

### Implementation for User Story 5

- [X] T039 [US5] Adapt `app/components/library/LibraryTable.vue` into the list pane (selectable rows emit `selected-id`; drop inline expansion) to pass T037
- [X] T040 [US5] Create `app/components/library/AudioTagsPanel.vue` embedding `LibraryItemEditor` + prev/next nav to pass T038
- [X] T041 [US5] Adapt `app/components/library/LibraryItemEditor.vue` to render inside the panel; relocate `app/components/library/LibrarySearchBar.vue` above the table list pane
- [X] T042 [US5] Rebuild `app/pages/library.vue` onto `DashboardWorkspace` (`#list`=table, `#detail`=AudioTagsPanel); manage `selectedId` + nav (reuse `useLibrary` unchanged)
- [X] T043 [P] [US5] Add US5 i18n keys (tags-panel nav, empty state) to `i18n/locales/en.json` + `i18n/locales/hu.json`

**Checkpoint**: Library matches the Generate workflow for tag editing.

---

## Phase 8: User Story 6 - Waveform review player (Priority: P3)

**Goal**: A bottom waveform player for the selected recording with zoom and loop regions
(loop-only; no audio modification). Constitution v2.5.0 approves the waveform library.

**Independent Test**: Selecting a recording renders a playable waveform; zoom scales it; marking
a region creates a visible loop; a missing-audio item shows an unavailable state (no crash).

### Story setup

- [X] T044 [US6] Add `wavesurfer.js` `^7` (+ regions/zoom plugins) to `package.json` dependencies and install (constitution v2.5.0 — web-UI/`app/` only)
- [X] T045 [US6] Add a `wavesurfer.js` mock for happy-dom in `tests/component/` (factory stub exposing `load`/`zoom`/`on`/`destroy` + regions plugin), mirroring the `useColorMode` mock pattern

### Tests for User Story 6 (red-first)

- [X] T046 [P] [US6] Create `tests/component/WaveformPlayer.test.ts` (mocked wavesurfer): loads `src`; `waveform-zoom` calls `zoom`; `waveform-add-region` creates a loop region; `waveform-unavailable` on load error

### Implementation for User Story 6

- [X] T047 [US6] Create `app/components/library/WaveformPlayer.vue` (wavesurfer lifecycle on `src`, regions = loop-only, zoom control, `error`→unavailable; destroy on unmount/`src` change) to pass T046
- [X] T048 [US6] Wire `WaveformPlayer` as the `#footer` of `DashboardWorkspace` in `app/pages/library.vue` for the selected recording
- [X] T049 [P] [US6] Add US6 i18n keys (play/zoom/add-region/loop/unavailable labels) to `i18n/locales/en.json` + `i18n/locales/hu.json`

**Checkpoint**: Waveform review works in the Library workspace.

---

## Phase 9: User Story 7 - Settings in a modal (Priority: P3)

**Goal**: Settings opens as a modal from the toolbar; the standalone Settings tab/page is removed.

**Independent Test**: Open-settings shows the modal over the current surface; changes save and
close; focus returns; the Settings tab/page no longer exists (Generate, Library tabs only).

### Tests for User Story 7 (red-first)

- [X] T050 [P] [US7] Create `tests/component/SettingsModal.test.ts`: opens via `v-model:open`, renders the four settings sections, Escape closes + focus returns (`settings-modal-*`)
- [X] T051 [P] [US7] Update `tests/component/AppHeader.test.ts` (or layout spec) red-first: tab list = Generate, Library only (no Settings tab) — implemented as `tests/component/DefaultLayout.test.ts` (the tabs live in the layout, not the header)

### Implementation for User Story 7

- [X] T052 [US7] Create `app/components/settings/SettingsModal.vue` (`UModal` wrapping `AppearanceSettings`/`LanguageSettings`/`OpenAiKeySettings`/`DefaultTagsSettings`, unchanged) to pass T050
- [X] T053 [US7] Remove `app/pages/settings.vue`; update `app/layouts/default.vue` tabs to drop Settings to pass T051
- [X] T054 [US7] Wire `toolbar-open-settings` → `SettingsModal` `v-model:open` (shared across `index.vue`/`library.vue` via the header) — new `useSettingsModal()` (`useState`) shared ref; the one `SettingsModal` is hosted in `AppHeader`. One settings entry **per surface** (FR-017): Generate opens it from its workspace toolbar (FR-004), so the header gear renders only on toolbar-less surfaces (e.g. Library, which has no toolbar) — Library would otherwise be unable to reach Settings. End-to-end wiring covered by `tests/component/GenerateSettingsWiring.test.ts`
- [X] T055 [P] [US7] Add US7 i18n keys (settings-modal title/close; remove obsolete settings-tab key) to `i18n/locales/en.json` + `i18n/locales/hu.json`

**Checkpoint**: All seven stories independently functional.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story gates and final validation.

- [X] T056 [P] Add automated accessibility assertions (keyboard operability, roles/labels, modal focus-trap/Escape/return) for all new controls across `tests/component/` — toolbar, resize handle, row selection, columns dialog, settings modal, tags nav, waveform controls (FR-020/SC-009)
- [X] T057 [P] Verify the en/hu key-parity test in `tests/unit/i18n-parity.test.ts` passes for every added namespace and remove orphaned keys in `i18n/locales/en.json` + `i18n/locales/hu.json` (FR-019)
- [X] T058 Run full suite green: `pnpm test`, `pnpm typecheck`, `pnpm lint` (via `mise exec node@22.22.2 --`); preserve or update every existing `data-test` consumer (SC-008 no-regression)
- [X] T059 [P] Update `README.md`/runtime docs for the redesign + waveform (deferred from the constitution v2.5.0 sync)
- [X] T060 Execute `specs/005-dashboard-redesign/quickstart.md` scenarios end-to-end (US1–US7 + cross-cutting gates)

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)**: no dependencies.
- **Foundational (P2)**: depends on Setup; **blocks all user stories** (DashboardWorkspace + queue state).
- **User stories (P3–P9)**: depend on Foundational. Soft inter-story dependencies (below) — most are testable independently.
- **Polish (P10)**: depends on all targeted stories.

### User-story dependencies (soft)

- **US1 (P1)**: only Foundational. **MVP.**
- **US2 (P1)**: builds on the US1 Generate page (toolbar wires into it); `useQueue` nav/serialize + `useGeneration` changes are US2-owned.
- **US3 (P2)**: extends the US1 queue list/page (filters, selection UI, columns).
- **US4 (P2)**: extends the US1 Generate page (add-text panel).
- **US5 (P2)**: only Foundational (independent of US1–US4; reuses `useLibrary` unchanged).
- **US6 (P3)**: builds on the US5 Library workspace (waveform is its footer); adds the new dependency.
- **US7 (P3)**: SettingsModal is independent; its open trigger lives in the US2 toolbar.

### Within each story

Tests (red) → composables/state → components → page wiring → i18n keys. Verify red before green.

---

## Parallel Opportunities

- Setup: T001, T002 in parallel.
- Foundational: T003/T004 (workspace) run alongside T005/T006 (queue state) — different files.
- Within a story, all `[P]` test tasks run together, then `[P]` implementation tasks on different files.
- Across stories after Foundational: **US1** and **US5** are the most independent and can be built in parallel by different developers; US2/US3/US4 layer onto US1; US6 layers onto US5.

### Parallel example — User Story 1

```bash
# Red-first tests together:
Task: "tests/component/QueueList.test.ts (row select → active-id)"
Task: "tests/component/MetadataFields.test.ts (recordedAt picker, tomorrow default)"
Task: "tests/component/Generate.test.ts (two-pane wiring + empty state)"
```

---

## Implementation Strategy

### MVP first

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 **US1** → **STOP & validate** the
   side-by-side Generate workspace independently → demo.

### Incremental delivery

US1 (MVP) → US2 (toolbar: usable Generate redesign) → US3 (curation) → US4 (ad-hoc text) →
US5 (Library parity) → US6 (waveform) → US7 (settings modal). Each adds value without breaking
prior stories; commit after each task or logical group.

### Notes

- `[P]` = different files, no incomplete-task dependency.
- Presentation-only: never edit `src/core/`, `server/`, or the schema (FR-018).
- `wavesurfer.js` is mocked in tests (happy-dom can't render canvas/WebAudio).
- Respect typecheck gotchas: auto-import components (no `~`), import composable *types* by relative path.
