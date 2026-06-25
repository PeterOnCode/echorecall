---
description: "Task list for Library Tab Redesign (Waveform Tag-Editor)"
---

# Tasks: Library Tab Redesign (Waveform Tag-Editor)

**Input**: Design documents from `specs/006-library-redesign/` (reconciled against the Figma "Library Tab 2" read)

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ui-contracts.md](./contracts/ui-contracts.md)

**Tests**: REQUIRED — Principle II (Test-First) is NON-NEGOTIABLE; FR-026/SC-008 mandate test-gating. Every behavior is red-first. `wavesurfer.js` is mocked via `tests/component/wavesurfer-mock.ts`.

**Three migration-free core extensions** (user-approved at plan time): **R-FILTER** (query), **R-TAGS** (extra editable fields via existing `tags_extra` JSON), **R-AUDIOPROPS** (read-only audio properties). No SQL migration; no generation change.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different files, no incomplete-task dependency. **[Story]**: US1–US6 (Setup/Foundational/Polish have no label).

## Path Conventions

`app/` (presentation), `src/core/` (domain), `server/api/` (Nitro), `tests/{unit,component,integration}/`, `i18n/locales/`. Node pin 22.22.2 (mise).

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create the parallel-route stub `app/pages/library-next.vue` rendering an empty `DashboardWorkspace` (`#list`/`#detail`/`#footer`) so `/library-next` resolves while `/library` stays untouched (FR-001); confirm `wavesurfer.js ^7.12.8` present (no new dep).
- [X] T002 [P] Confirm `tests/component/wavesurfer-mock.ts` is reusable by new specs.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared core + composable layer all stories consume — R-FILTER/R-TAGS/R-AUDIOPROPS in the core, plus `useLibrary`/`useViewPreferences`/`useTagDrafts`. **⚠️ No story phase completes until this is done.**

### Core: query, tags, audio properties (red-first)

- [X] T003 [P] Core unit test (RED) in `tests/unit/library-query-extension.test.ts`: R-FILTER `genre`/`language`/`recordedFrom`/`recordedTo` filters + sort keys `filename|artist|album|recordedAt|track|genre|comment` (Year+Date→recordedAt; Filename→stored name), plus back-compat.
- [X] T004 [P] Core unit test (RED) in `tests/unit/metadata-extra-tags.test.ts`: R-TAGS — `notes`/`encodedBy`/`albumArtist`/`composer`/`bpm`/`rating` write→read round-trip via the native ID3 frames (TENC/TPE2/TCOM/TBPM/POPM; notes→customText) mirrored in `tags_extra`; **Rating 0–5 ↔ POPM 0–255** mapping; existing rows without the keys read back empty.
- [X] T005 [P] Core unit test (RED) in `tests/unit/audio-properties.test.ts`: R-AUDIOPROPS — reader returns codec/bitrate/sampleRate/duration for a real file; an unreadable/missing file yields an empty object (no throw).
- [X] T006 Extend `src/core/shared/types.ts`: (R-FILTER) `LibraryQuery` optional `genre`/`language`/`recordedFrom`/`recordedTo` + sort union additions `filename|artist|album|recordedAt|track|genre|comment`; (R-TAGS) `Metadata` optional `notes`/`encodedBy`/`albumArtist`/`composer`/`bpm` (int)/`rating` (0–5); (R-AUDIOPROPS) new `AudioProperties` type.
- [X] T007 Extend `src/core/library/sqlite-repository.ts`: (R-FILTER) additive `WHERE` (genre/language/recordedAt) + `ORDER BY` for the new sort keys (filename→stored name, comment→`tag_comment`, year/date→`tag_recorded_at`) over existing columns; (R-TAGS) serialize/hydrate the 6 extra fields inside the existing `tags_extra` JSON — **no new SQL column/migration**.
- [X] T008 Create `src/core/library/audio-properties.ts` (R-AUDIOPROPS): read codec/bitrate/sampleRate/duration via taglib `audioProperties`, computed on read.
- [X] T009 Update `src/core/library/library-service.ts` + `repository.ts`: forward the new query params; attach read-only `audioProperties` on returned items.
- [X] T010 Update `server/api/generations.get.ts`: accept/validate/forward the R-FILTER params; include read-only `audioProperties` per item.
- [X] T011 Update `server/api/generations/[id].patch.ts`: accept the extra editable tag fields (R-TAGS) in the retag patch (validated, optional).

### Composables (red-first)

- [X] T012 [P] Unit test (RED) in `tests/unit/use-library-bulk-nav.test.ts`: `removeMany`, `bulkRetag` (any editable field incl. extras; `{succeeded,failed}`), cross-page `hasPrev`/`hasNext` + adjacent-page selection.
- [X] T013 Extend `app/composables/useLibrary.ts`: carry new query params + `audioProperties`; add `removeMany`/`bulkRetag`; cross-page Prev/Next helpers (R-NAV).
- [X] T014 [P] Unit test (RED) in `tests/unit/use-view-preferences-library.test.ts`: `libraryColumns` (ordered, Filename always-on, reorder, not-all-hidden) + `inspectorFields` (14 ordered, Name always-on, not-all-hidden); SSR-safe.
- [X] T015 Extend `app/composables/useViewPreferences.ts`: ordered `libraryColumns` + `inspectorFields` with guards + the two `localStorage` keys.
- [X] T016 [P] Unit test (RED) in `tests/unit/use-tag-drafts.test.ts`: stage per id, `isDirty`, `dirtyCount`, auto-preserve across switches, `commit` clears on success, `discard`.
- [X] T017 Create `app/composables/useTagDrafts.ts`: in-memory per-recording dirty buffer; `commit` reuses `useLibrary.update`.

**Checkpoint**: Core + composables unit-green — stories can begin.

---

## Phase 3: User Story 1 — Two-pane file table + tag-editor inspector (Priority: P1) 🎯 MVP

**Goal**: Resizable two-pane workspace at `/library-next` — table left, inspector right — where selecting a row loads tags and inspector Prev/Next traverse across pages.

**Independent Test**: Row click loads tags + highlights; divider resizes (persists); Prev/Next reach every recording across pages; inspector header reads "Tag Editor (ID3v2.4)".

- [X] T018 [P] [US1] Component test (RED) `tests/component/library-next.test.ts`: renders `DashboardWorkspace` (table/inspector/footer); inspector empty state when nothing selected (FR-005); the show/hide-inspector control **collapses and restores** the inspector pane (FR-021).
- [X] T019 [P] [US1] Component test (RED) `tests/component/library-file-table.test.ts`: row click sets `activeId` + highlights (`aria-pressed`); Filename always shown.
- [X] T020 [P] [US1] Component test (RED) `tests/component/tag-inspector.test.ts`: fixed title "Tag Editor (ID3v2.4)" (FR-032), loads field values, Prev/Next emits + bounds, empty state.
- [X] T021 [P] [US1] Integration test (RED) `tests/integration/library-cross-page-nav.test.ts`: Next/Prev cross page boundaries; disabled at global first/last (SC-002).
- [X] T022 [US1] Create `app/components/library/LibraryFileTable.vue` (forks `LibraryTable`): rows, Filename + base columns, row click → `v-model:active-id`, highlight, `v-model:query`.
- [X] T023 [US1] Create `app/components/library/TagInspector.vue` skeleton (forks `AudioTagsPanel`): fixed title, toolbar Prev/Next, field display, empty state (editing in US5).
- [X] T024 [US1] Wire `app/pages/library-next.vue`: workspace `#list`/`#detail`, `activeId`, cross-page Prev/Next via `useLibrary`, split `storage-key="library-next-workspace"`.
- [X] T025 [P] [US1] i18n keys (en/hu) inspector title/nav/empty + base column labels in `i18n/locales/en.json` + `hu.json`.

**Checkpoint**: US1 testable — the two-pane workspace (MVP).

---

## Phase 4: User Story 2 — Waveform player with loop + zoom (Priority: P1)

**Goal**: Reused light-theme waveform in the footer — Play, single A–B loop + repeat, zoom.

**Independent Test**: Waveform renders/plays; zoom scales; Add loop section marks one A–B region; repeat loops only that range; broken audio → unavailable.

- [X] T026 [P] [US2] Component test (RED) `tests/component/library-next-waveform.test.ts` (wavesurfer mocked): footer renders `WaveformPlayer` for the active item, absent when none, unavailable passthrough (FR-007/FR-010).
- [X] T027 [US2] Wire the reused `WaveformPlayer` into `app/pages/library-next.vue` `#footer` (`:src`/`:label`).
- [X] T028 [US2] Surface waveform i18n labels (Play/Add loop section/Repeat section/Zoom) in `app/components/library/WaveformPlayer.vue`, behavior unchanged.
- [X] T029 [P] [US2] i18n waveform keys (en/hu).

**Checkpoint**: US1 + US2 — review a recording on the waveform.

---

## Phase 5: User Story 3 — Library filter bar (Priority: P2)

**Goal**: Filter bar (search-all, format, recording-date, genre, language) narrowing the whole library.

**Independent Test**: Each filter narrows via the extended query; clearing restores; no-match → empty state.

- [X] T030 [P] [US3] Component test (RED) `tests/component/library-filter-bar.test.ts`: search/format/genre/language emit `query` patches (reset page 1); the **single recording-date** sets `recordedFrom`/`recordedTo` to the chosen day's bounds and clears back; `__all__` sentinel clears selects.
- [X] T031 [P] [US3] Integration test (RED) `tests/integration/library-filter.test.ts`: each filter narrows via `LibraryQuery`; no-match → empty-result state.
- [X] T032 [US3] Create `app/components/library/LibraryFilterBar.vue` (supersedes `LibrarySearchBar`): search-all, format, a single recording-date (`UPopover`+`UCalendar`, one day → `recordedFrom`/`recordedTo` bounds), genre, language.
- [X] T033 [US3] Wire `LibraryFilterBar` into `app/pages/library-next.vue` `#list` via `v-model:query`.
- [X] T034 [P] [US3] i18n keys (en/hu) `filters.genre/language/allGenres/allLanguages/recordedRange`.

**Checkpoint**: US3 testable — whole-library filtering.

---

## Phase 6: User Story 4 — File table management (Priority: P2)

**Goal**: Multi-select, sortable columns, bulk delete + bulk tag edit, and a Configure Columns modal (full inventory, toggle + reorder + Reset/Cancel/Apply, Filename always-on).

**Independent Test**: select-all/per-row; bulk delete (confirmed) clears selection; bulk tag edit (any editable field incl. extras) reports succeeded/failed; sort reorders; Configure Columns toggles/reorders the full set with Filename locked and persists.

- [X] T035 [P] [US4] Component test (RED) `tests/component/library-file-table-management.test.ts`: select-all + per-row; sort headers drive `query.sort`/`order` (Filename/Title/Artist/Album/Year/Track/Genre/Comment/Date — Composer/Duration/Bitrate unsortable); emits `toggle-inspector` from the show/hide control (FR-021).
- [X] T036 [P] [US4] Component test (RED) `tests/component/library-columns-dialog.test.ts`: full inventory (Title/Artist/Album/Year/Track/Genre/Comment/Date/Composer/Duration/Bitrate) toggle + reorder, Filename always-on, not-all-hidden, Reset/Cancel/Apply, persistence (FR-017/FR-031).
- [X] T037 [P] [US4] Component test (RED) `tests/component/bulk-tag-edit-dialog.test.ts`: field select (any editable tag field incl. extras; filename excluded) + value → `apply`; result summary (FR-016).
- [X] T038 [P] [US4] Integration test (RED) `tests/integration/library-bulk.test.ts`: bulk delete → `removeMany` → reload + clear; bulk tag edit → `bulkRetag` succeeded/failed.
- [X] T039 [US4] Extend `app/components/library/LibraryFileTable.vue`: checkbox column (header select-all + per-row, `v-model:selected-ids`), sortable headers, Configure-Columns gear + show/hide-inspector control, bulk emits, render the extra columns (Comment/Date/Composer + display-only Duration/Bitrate from `audioProperties`).
- [X] T040 [US4] Create `app/components/library/LibraryColumnsDialog.vue` (`UModal`): full inventory toggle + drag-reorder + Reset/Cancel/Apply; consumes `useViewPreferences.libraryColumns`.
- [X] T041 [US4] Create `app/components/library/BulkTagEditDialog.vue` (`UModal`): one editable tag field (incl. extras; filename excluded) + value → `apply`.
- [X] T042 [US4] Wire in `app/pages/library-next.vue`: bulk delete (`removeMany` + `ConfirmDialog`), bulk tag edit (`bulkRetag`), columns dialog, show/hide inspector.
- [X] T043 [P] [US4] i18n keys (en/hu) `columns.{year,track,artist,album,genre,comment,date,composer,duration,bitrate}`, `columnsDialog.*` (incl. reset/cancel/apply), `bulkTagEdit.*`, `toggleInspector`.

**Checkpoint**: US4 testable — full table management + bulk ops.

---

## Phase 7: User Story 5 — Tag-editor inspector controls (Priority: P2)

**Goal**: The inspector becomes a full editor — fixed "Tag Editor (ID3v2.4)" title, toolbar Previous/Next/Play Audio/Save, **all 15 fields editable** (6 extras via R-TAGS), explicit Save with auto-preserved dirty buffer, and a Configure Visible Fields modal (toggle + reorder + Reset/Cancel/Apply).

**Independent Test**: Edit any field (incl. Encoded-By/Text/Album Artist/Composer/BPM/Rating) → dirty → Save commits → reload round-trips (via `tags_extra`, no migration); edit→switch→return restores staged edits; Configure Visible Fields toggles + reorders (Name locked) and persists; show/hide collapses.

- [X] T044 [P] [US5] Component test (RED) `tests/component/tag-inspector-edit.test.ts`: all 15 fields editable; Save (toolbar) calls `useLibrary.update`; dirty indicator; Play emits (FR-018/FR-019/FR-022/FR-032).
- [X] T045 [P] [US5] Component test (RED) `tests/component/inspector-fields-dialog.test.ts`: toggle + reorder, Name always-on, not-all-hidden, Reset/Cancel/Apply, persistence (FR-020/FR-031).
- [X] T046 [P] [US5] Integration test (RED) `tests/integration/inspector-drafts.test.ts`: explicit Save + auto-preserve across selection (Q4); an extra field (e.g. Album Artist) round-trips via `tags_extra` (SC-010).
- [X] T047 [US5] Extend `app/components/library/TagInspector.vue`: settings gear, toolbar Play + Save, all 15 editable fields (Name + `MetadataFields` incl. the 6 extras) bound to `useTagDrafts`, dirty indicator, fields-dialog trigger; render order/visibility from prefs.
- [X] T048 [US5] Create `app/components/library/InspectorFieldsDialog.vue` (`UModal`): toggle + reorder + Reset/Cancel/Apply; consumes `useViewPreferences.inspectorFields`.
- [X] T049 [US5] Wire `app/pages/library-next.vue`: `useTagDrafts`, inspector field prefs, Play, show/hide inspector.
- [X] T050 [P] [US5] i18n keys (en/hu) the 15 field labels (incl. albumArtist/composer/bpm/rating) + `inspectorFields.*` (incl. reset/cancel/apply).

**Checkpoint**: US5 testable — full tag editor with the extra fields.

---

## Phase 8: User Story 6 — Status bar (Priority: P3)

**Goal**: Status bar — save state, files loaded, selection, UTF-8, and real audio properties (codec/bitrate/sample-rate).

**Independent Test**: Shows loaded count, selection, save state (flips on edit/after Save), UTF-8, and codec/bitrate/sample-rate (blank where unreadable).

- [X] T051 [P] [US6] Component test (RED) `tests/component/library-status-bar.test.ts`: save state, files-loaded, selection, UTF-8, audio properties from `audioProperties`; reacts to dirty/save (FR-023, R-AUDIOPROPS).
- [X] T052 [US6] Create `app/components/library/LibraryStatusBar.vue` (`role="status"`; projection per data-model §4).
- [X] T053 [US6] Wire `LibraryStatusBar` into `app/pages/library-next.vue` (`useLibrary.total` + `useTagDrafts` + active item's `audioProperties`).
- [X] T054 [P] [US6] i18n keys (en/hu) `status.{saved,unsaved,files,selection}` (codec/encoding values are data, not translated).

**Checkpoint**: All six stories independently functional.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T055 [P] i18n parity test `tests/unit/i18n-library-parity.test.ts`: every new `library.*` key in both `en.json` + `hu.json` (SC-008).
- [ ] T056 [P] Accessibility/keyboard sweep across new specs: every new control keyboard-operable + ARIA-labelled (FR-026/SC-008).
- [ ] T057 Verify the accent is the app's `indigo` primary (no `app/app.config.ts` change; never green) (FR-024).
- [ ] T058 Run `npm run typecheck` + `npm run lint`; fix strict-TS/typecheck gotchas (auto-import components; relative-path composable types).
- [ ] T059 Run `npm test` + `npm run test:component` green; execute `quickstart.md` scenarios 1–12, confirming no regression vs the old `/library` (SC-007), extra-tag fields round-trip with **no SQL migration** (SC-010), and — seeding **≥200 recordings** — that search/any filter narrows in **<5s** (SC-003).
- [ ] T060 **Cutover (FR-002)** — final, separable: repoint the Library nav in `app/layouts/default.vue`, rename `app/pages/library-next.vue` → `app/pages/library.vue` (delete the old), delete the 005-only `app/components/library/{LibraryTable,AudioTagsPanel,LibrarySearchBar}.vue` + their specs, update consuming tests, verify `/library` resolves (SC-009).

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)** → none. **Foundational (P2)** → after Setup; **blocks all stories** (R-FILTER/R-TAGS/R-AUDIOPROPS core + the three composables).
- **Stories (P3–P8)** → after Foundational; best done in priority order (they share component files additively). **Polish (P9)** → after; **T060 cutover last**.

### Within-feature story dependencies (shared files — not fully parallel)

- **US1** creates `library-next.vue`, `LibraryFileTable.vue`, `TagInspector.vue` (the shells others extend).
- **US4** extends `LibraryFileTable.vue`; **US5** extends `TagInspector.vue`; **US2/US3/US6** mount into US1's page.
- US3 needs R-FILTER; US4 needs R-FILTER sort + `removeMany`/`bulkRetag` + `libraryColumns`; US5 needs R-TAGS + `useTagDrafts` + `inspectorFields`; US6 needs R-AUDIOPROPS + `useTagDrafts`.

### Within each story

- Tests (RED) before implementation; core/composables before components; components before page wiring.

---

## Parallel Opportunities

- **Foundational**: the five RED core/composable tests (T003/T004/T005/T012/T014/T016) [P] run together; then the implementations proceed (core types T006 first, as T007–T011 depend on it).
- **Per story**: the RED test tasks are [P]. i18n tasks (T025/T029/T034/T043/T050/T054) are [P] but **all touch `en.json`+`hu.json`** — serialize those two files.

### Parallel example — Foundational RED tests

```bash
Task: "T003 LibraryQuery extension test"
Task: "T004 Metadata extra-tags (tags_extra) round-trip test"
Task: "T005 audio-properties reader test"
Task: "T012 useLibrary bulk/nav test"
Task: "T014 useViewPreferences library-prefs test"
Task: "T016 useTagDrafts test"
```

---

## Implementation Strategy

### MVP (US1, +US2 — both P1)

1. Setup → Foundational (CRITICAL) → US1 → **STOP & VALIDATE** the two-pane workspace → US2 (waveform) → demo `/library-next`.

### Incremental delivery

- Foundational → US1 (MVP) → US2 → US3 → US4 → US5 → US6, validating each. **T060 cutover only after** the new surface is proven (FR-002).

---

## Notes

- **Tests red-first**; `wavesurfer.js` mocked via `tests/component/wavesurfer-mock.ts`.
- **No new dependency; no SQL migration.** Three migration-free core extensions: R-FILTER (query), R-TAGS (extra fields via `tags_extra`), R-AUDIOPROPS (read-only audio properties). Generation untouched (FR-027/FR-028).
- Preserve every reused 005 `data-test` hook or update its consuming test in the same change.
- Commit after each task/logical group; stop at any checkpoint to validate a story independently.
