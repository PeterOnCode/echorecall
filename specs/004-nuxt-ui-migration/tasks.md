# Tasks: Nuxt UI Component Migration

**Input**: Design documents from `specs/004-nuxt-ui-migration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md, quickstart.md

**Tests**: REQUIRED — the constitution mandates Test-First (Principle II, NON-NEGOTIABLE). Component swaps change structure/selectors, so the affected `@nuxt/test-utils` specs are rewritten/extended **red-first** (fail against the new components) before each migration. SC-002 (dark mode) and SC-004 (keyboard/focus) are gated by **new automated tests** (clarification: "automated only").

**Organization**: Grouped by the spec's priority slices — US1 (P1 Generate), US2 (P2 Library), US3 (P3 Overlays + Settings). Per the clarification, all three ship in **one combined change**; priorities are **build order**, not separate releases.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 (user-story phases only)
- All paths are repo-relative.

## Conventions (project-specific — apply throughout)

- **Run tests/typecheck/build via the pinned runtime**: `mise exec node@22.22.2 -- pnpm test`, `... pnpm test:component` (the component gate), `... pnpm typecheck`, `... pnpm lint`. The bash shell defaults to Node 25; native `better-sqlite3` and the toolchain expect 22.22.2.
- **Typecheck import rule**: in `.vue`/composables, **auto-import components** (no `~` import); import composable/core *types* by relative path or `#core/client` (the `~` alias fails `nuxt typecheck`).
- **Text inputs commit on `@blur`** (validate-and-restore): VTU `setValue` on a textarea also fires `change`, so keep the `QueueItemEditor` commit on `@blur` and `trigger('blur')` in tests.
- **`useColorMode` must be mocked** in component tests via `mockNuxtImport` (it crashes the nuxt vitest/happy-dom env otherwise); use a reactive stand-in to drive dark-mode assertions.
- **i18n catalog prewarm**: for locale-dependent assertions, warm the catalog in `beforeAll` and poll with a real delay (lazy catalog import races the poll under full-suite load).
- **`data-test` parity is the regression gate** (FR-006): preserve every hook in `contracts/ui-contracts.md` §2, or update its consuming test in the same task. When a hook moves onto a design-system wrapper (e.g. the date-picker trigger), keep it on the user-operable element.
- **Presentation-only**: do NOT touch `src/core/`, `server/`, the SQLite schema, or any port. v-model shapes, emits, and behavior stay identical except the date-picker interaction (FR-011).
- **`UModal` teleports** to `document.body`: query overlay content on `document.body`, not the component root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a known-green baseline before red-first work.

- [ ] T001 Confirm the baseline suite is green on branch `004-nuxt-ui-migration`: run `mise exec node@22.22.2 -- pnpm test`, `... pnpm test:component`, and `... pnpm typecheck`. Record which component specs currently pass (`LibraryTable`, `BulkCleanDialog`, `LibraryItemEditor`, `LibraryItemActions`, `QueueItemEditor`, `MetadataFields`, `Generate`, `QueueList`, `DefaultTags`, `DefaultTagsSettings`, `LibraryList`) — these are rewritten/removed in later phases.

**Checkpoint**: Clean baseline; ready to author failing tests.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one shared prerequisite for the two date-picker stories (US2, US3). US1 (Generate) does not depend on this and may begin in parallel.

**⚠️ CRITICAL**: US2 and US3 date-picker tasks cannot begin until this is complete.

- [ ] T002 Add `@internationalized/date` `^3.12.2` to `package.json` `dependencies` (same version already resolved under `@nuxt/ui@4.8.2`), run `mise exec node@22.22.2 -- pnpm install`, and confirm it resolves at the top level by importing `{ CalendarDate, getLocalTimeZone, parseDate } from '@internationalized/date'` in a scratch check + `... pnpm typecheck` (no new transitive surface). See plan Complexity Tracking + research D3.

**Checkpoint**: `@internationalized/date` importable in app code; typecheck green.

---

## Phase 3: User Story 1 - Consistent, theme-correct controls on the Generate workflow (Priority: P1) 🎯 MVP

**Goal**: Every control on the Generate tab (form, metadata, queue-item editor, upload) is a `@nuxt/ui` component — consistent, dark-mode-correct, behavior identical.

**Independent Test**: On the Generate tab in light + dark mode, fill the form, add/edit a queued item (incl. metadata languages/custom text/url), and upload a `.txt`; all controls render in design-system style and every action produces the same result as before.

### Tests for User Story 1 (write/adjust FIRST, ensure they FAIL) ⚠️

- [ ] T003 [P] [US1] Rewrite `tests/component/MetadataFields.test.ts` (red) for `UInput`/`UTextarea`/`UBadge`/`UButton` in `UFormField`: scalar fields drop key when cleared; language chip add (Enter)/remove; customText & customUrl add (Enter)/remove; preserve dt `meta-title/artist/album/genre/recordedAt/track/comment`, `meta-language-input/add/chip/remove`, `meta-text-*`, `meta-url-*` (data-model.md P1).
- [ ] T004 [P] [US1] Rewrite `tests/component/QueueItemEditor.test.ts` (red) for `UTextarea`/`USelectMenu`: text commits on **`@blur`** (invalid edit shows `edit-text-error` and restores prior value without emitting `update`); voice/model/format emit `update`; preserve dt `queue-item-editor/edit-text/edit-text-error/edit-voice/edit-model/edit-format/edit-instructions/edit-instructions-note/edit-skip-warning`.
- [ ] T005 [P] [US1] Update `tests/component/Generate.test.ts` (red) for `USelectMenu`/`UInputNumber`/`UTextarea`/`UFileUpload` on `GenerateForm` + `UploadDropzone`: add-item via dt `add-text`/`add-item` (Ctrl+Enter); speed bounds; upload `.txt` over `maxBytes` shows `upload-error`, valid upload (**via click-to-select; no drag required**) emits + shows `upload-summary` and resets; preserve dt `voice/model/format/speed/upload-input/summary-*`.
- [ ] T006 [P] [US1] Update `tests/component/QueueList.test.ts` (red only if child-component selectors change) to match the migrated queue-item editor controls.

### Implementation for User Story 1

- [ ] T007 [US1] Migrate `app/components/generate/MetadataFields.vue`: scalar `<input>`→`UInput`, comment `<textarea>`→`UTextarea`, language input+Add→`UInput`+`UButton`, chips→`UBadge`+`UButton` (×), customText/customUrl inputs→`UInput`, all in `UFormField`; keep the `<fieldset>/<legend>` group (or `UCard`) and the immutable-update v-model + Enter handlers. Make T003 green. **(Shared: also consumed by US2 `LibraryItemEditor`.)**
- [ ] T008 [US1] Migrate `app/components/generate/QueueItemEditor.vue`: text/instructions `<textarea>`→`UTextarea` (preserve `@blur` commit + `@input` error-clear + `v-model.lazy` instructions), 3×`<select>`→`USelectMenu`; embeds migrated `MetadataFields`. Make T004 green. (depends on T007)
- [ ] T009 [P] [US1] Migrate `app/components/generate/GenerateForm.vue`: 3×`<select>`→`USelectMenu` (items from `voices`/`MODELS`/`FORMATS`), speed `<input type=number>`→`UInputNumber` (min 0.25/max 4/step 0.05, `v-model.number`), text `<textarea>`→`UTextarea` (preserve `@keydown.ctrl.enter`), labels→`UFormField`. Make form half of T005 green.
- [ ] T010 [P] [US1] Migrate `app/components/generate/UploadDropzone.vue`: `<input type=file>`→`UFileUpload` wired to the existing `onChange` (`.txt`/`text/plain` accept, `MAX_UPLOAD_BYTES` guard, `file.text()`, emit `uploaded`, reset to allow re-select, never upload). **Constraint (FR-002): click-to-select MUST remain the primary interaction and the emit/reset/size-guard behavior MUST be identical — drag-drop may only be an *additive* affordance, never required — so this is not a second interaction change beyond the authorized date picker.** If `UFileUpload` cannot satisfy that (forces a required/drag-only dropzone or alters emit/reset), use the FR-009 fallback: a `UButton` that triggers a visually-hidden native `<input type=file>` (justified structural exception, already accounted for in T030). Make the upload half of T005 green.
- [ ] T011 [US1] Verify `app/components/generate/QueueList.vue` has no raw interactive control (already `UButton`-based); adjust only if a child swap requires. Make T006 green.

**Checkpoint**: Generate tab fully migrated; `mise exec node@22.22.2 -- pnpm test:component MetadataFields QueueItemEditor Generate QueueList` green in light + dark.

---

## Phase 4: User Story 2 - Consistent, theme-correct controls on the Library (Priority: P2)

**Goal**: The search/filter bar, results table (server-driven sort + inline expandable player/editor rows), pagination, and item editor are `@nuxt/ui` components; the date-range filter becomes the design-system date picker (FR-010, FR-011).

**Independent Test**: On the Library tab in light + dark, search, filter by voice/format/date-range, sort each column, page through results, and replay/download/edit/delete a row; the same result sets/orderings are produced and a missing-audio row still shows "unavailable" with replay disabled.

### Tests for User Story 2 (write/adjust FIRST, ensure they FAIL) ⚠️

- [ ] T012 [P] [US2] Rewrite `tests/component/LibraryTable.test.ts` (red) for `UTable`: sortable header buttons drive `query` to `{ sort, order, page: 1 }` (server-driven; dt `sort-title/voice/format/createdAt` + ▲/▼); `#expanded` region shows `AudioPlayer` on replay and `LibraryItemEditor` on edit (mutually per-row); unavailable row keeps dt `row-unavailable` + disabled `replay`; pagination dt `page-prev/page-next/page-status` disable at bounds; empty dt `library-empty`.
- [ ] T013 [P] [US2] Add `tests/component/LibrarySearchBar.test.ts` (NEW, red): search/voice/format changes emit a fresh `query` with `page:1`; the **single range picker** emits **both** inclusive local-day ISO bounds from one selection (start→`from` `T00:00:00`, end→`to` `T23:59:59.999`) and clearing resets both; assert the resulting `query.from`/`query.to` values (behavior unchanged); preserve dt `library-search/filter-voice/filter-format` and select the picker via the new `filter-range` hook.
- [ ] T014 [P] [US2] Rewrite `tests/component/LibraryItemEditor.test.ts` (red) for `UInput` filename (+ read-only `filename-ext` slot) and the metadata editor; the confirm-delete flow still emits `delete` only after confirmation (still targets the bespoke `ConfirmDialog` at this phase). Preserve dt `library-item-editor/edit-filename/filename-ext/save-item/cancel-edit/delete-item`.
- [ ] T015 [P] [US2] Update `tests/component/LibraryItemActions.test.ts` (red) for the `UTable` row-action buttons (`replay/download/edit-item`) and expansion behavior.

### Implementation for User Story 2

- [ ] T016 [US2] Migrate `app/components/library/LibrarySearchBar.vue`: search `<input>`→`UInput`, 2×`<select>`→`USelectMenu` (+ "all" item), 2×`<input type=date>`→a **single range date picker** (`UPopover`+`UCalendar` in `range` mode) using `@internationalized/date`, **reusing the existing local-day→ISO bound mapping inline** so start→`from` (`T00:00:00`) / end→`to` (`T23:59:59.999`) and the page-reset are unchanged (the range selection inherently enforces start≤end, replacing the old `:min`/`:max`). Collapse dt `filter-from`+`filter-to` → a single `filter-range` hook on the picker trigger; add a clear affordance that resets both bounds. Make T013 green. (depends on T002)
- [ ] T017 [US2] Migrate `app/components/library/LibraryItemEditor.vue`: filename `<input>`→`UInput` with the immutable extension in a trailing slot; embeds migrated `MetadataFields`; keeps `ConfirmDialog` usage (props/emits stable). Make T014 green. (depends on T007)
- [ ] T018 [US2] Migrate `app/components/library/LibraryTable.vue` to `UTable`: column cell/header slots preserving existing markup/badges; sortable headers render `UButton` calling the existing `toggleSort` (server-driven, NOT client sort); replace the extra-`<tr>` expansions with a single `#expanded` region driven by a per-row `mode: 'none'|'player'|'editor'` (replay→player/`AudioPlayer`, edit→editor/`LibraryItemEditor`); pagination via `UPagination` or retained `UButton`s. Make T012 + T015 green. (depends on T016, T017)
- [ ] T019 [US2] Run `mise exec node@22.22.2 -- pnpm test:component LibraryTable LibrarySearchBar LibraryItemEditor LibraryItemActions` + `... pnpm typecheck`; confirm green in light + dark.

**Checkpoint**: Library tab fully migrated; search/sort/filter/paginate/replay/download/edit/delete identical; date picker emits identical filter bounds.

---

## Phase 5: User Story 3 - Consistent overlays + remaining Settings controls (Priority: P3)

**Goal**: The confirmation and bulk-clean overlays move to `UModal` (fixing the dark-mode hardcoded-`#fff` defect and unifying focus/Escape/focus-return), and the remaining Settings (default-tag) controls become `@nuxt/ui` form controls (FR-003/004/008).

**Independent Test**: Open the delete confirmation and the bulk-clean confirmation in dark mode; each renders with correct theme colors, traps focus, dismisses on Escape, and returns focus to the trigger. Edit and save a default-tag value; behavior unchanged.

### Tests for User Story 3 (write FIRST, ensure they FAIL) ⚠️

- [ ] T020 [P] [US3] Add `tests/component/ConfirmDialog.test.ts` (NEW, red): with `UModal`, the dialog teleports to `document.body` when `open`; **focus moves into it on open**, **Escape emits `cancel`**, backdrop/cancel/confirm emit correctly, **focus returns to the trigger on close**; with `useColorMode` mocked `dark` it renders with no bespoke `.backdrop`/`.dialog` hardcoded panel. Preserve dt `confirm-dialog/confirm-cancel/confirm-ok`. (SC-002, SC-004)
- [ ] T021 [P] [US3] Rewrite `tests/component/BulkCleanDialog.test.ts` (red) for `UModal` + `USelectMenu` + a **single range date picker**: confirm disabled until `hasFilter`; filters re-seed on open; Escape/cancel/confirm emit; the range selection emits identical inclusive ISO bounds; dark-mode render. Update the existing `bulk-from`/`bulk-to` selectors to the new `bulk-range` hook (FR-006 — consuming test updated in the same change); preserve dt `bulk-clean-dialog/bulk-voice/bulk-cancel/bulk-confirm` and `bulk-range`.
- [ ] T022 [P] [US3] Rewrite `tests/component/DefaultTags.test.ts` (red) for `UInput`/`UFormField`: five fields + no Title; edit + Save calls `PUT /api/settings/defaults`; pre-filled from `GET` on mount; `:disabled` while loading/saving.
- [ ] T023 [P] [US3] Rewrite `tests/component/DefaultTagsSettings.test.ts` (red) for `UInput`/`UFormField`: status (`default-status`)/error (`default-error`), Save (`default-save`) loading, Clear (`default-clear`) disabled until saved; preserve dt `default-artist/album/genre/comment/languages`.

### Implementation for User Story 3

- [ ] T024 [US3] Migrate `app/components/ConfirmDialog.vue` → `UModal` (`v-model:open` from `open` prop; footer `UButton` cancel/confirm): **delete** the scoped `<style>` (hardcoded `#fff`), the manual `onKeydown` focus-trap, the `FOCUSABLE` query, and the focus-restore `watch` — `UModal` provides them. Preserve props/emits. Make T020 green. (SC-002 fix)
- [ ] T025 [US3] Migrate `app/components/library/BulkCleanDialog.vue` → `UModal` + `USelectMenu` (voice) + a **single range date picker** (inline ISO mapping preserved); collapse dt `bulk-from`+`bulk-to` → `bulk-range`; delete scoped `<style>` + `tabindex`/`@keydown.esc`/manual focus handling; keep the `hasFilter` gate + re-seed-on-open. Make T021 green. (depends on T002)
- [ ] T026 [P] [US3] Migrate `app/components/settings/DefaultTagsSettings.vue`: 5×`<input>`→`UInput` in `UFormField` (preserve `:disabled="loading||saving"`, languages hint/placeholder). Make T022 + T023 green.
- [ ] T027 [US3] Update consuming tests for the now-teleported overlays: `tests/component/LibraryItemEditor.test.ts` + `tests/component/LibraryItemActions.test.ts` (confirm-delete flow → query the teleported `ConfirmDialog`/`UModal` on `document.body`) and `tests/component/LibraryTable.test.ts` (bulk-clean flow → teleported `BulkCleanDialog`). Keep green. (depends on T024, T025)

**Checkpoint**: All overlays + Settings migrated; the confirm overlay renders correctly in dark mode; focus/Escape/focus-return covered by automated tests.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Dead-code removal, i18n parity, and the final acceptance gate.

- [ ] T028 [P] Remove the dead `app/components/LibraryList.vue` and `tests/component/LibraryList.test.ts` (re-confirm it is unreferenced by any page/component first via grep). (Principle V — research D8)
- [ ] T029 [P] Add any new date-picker i18n keys (e.g. trigger placeholder / "clear") to `i18n/locales/en.json` **and** `i18n/locales/hu.json` with parity; verify no missing-key warnings. Reuse existing label keys otherwise (no copy rewrites). (FR-005)
- [ ] T030 SC-001 verification: grep the in-scope components for raw interactive tags (`<input|select|textarea|button|table>` and bespoke `.backdrop`/`.dialog`) — confirm zero remain except any explicitly justified FR-009 exception (e.g. a hidden file input if the UploadDropzone fallback was used). Note results in the PR.
- [ ] T031 Run the full gate via the pinned runtime: `mise exec node@22.22.2 -- pnpm test` (core/server unaffected — must stay green), `... pnpm test:component`, `... pnpm typecheck`, `... pnpm lint`. All green. (SC-003)
- [ ] T032 Manual smoke per `quickstart.md`: walk Generate/Library/Settings + the delete-confirm overlay in **light and dark**; confirm visual consistency and that the previously-broken dark-mode confirm overlay now renders correctly. (SC-002 visual confirmation)
- [ ] T033 [P] Update any README/docs screenshots or references that show the old raw-HTML UI (only if present).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup. Blocks the **date-picker tasks** in US2 (T016) and US3 (T025) only — not all of US1.
- **US1 (Phase 3)**: depends on Setup; independent of Foundational (no date picker). MVP.
- **US2 (Phase 4)**: depends on Foundational (T002) for the date picker and on **US1 T007** (`MetadataFields`, embedded by `LibraryItemEditor`).
- **US3 (Phase 5)**: depends on Foundational (T002) for the bulk-clean date picker; T027 depends on US2's `LibraryItemEditor`/`LibraryTable`/`LibraryItemActions` being migrated (T017, T018).
- **Polish (Phase 6)**: depends on all stories complete.

### Within Each User Story

- Tests are written and FAIL before the matching migration (red → green).
- Shared `MetadataFields` (T007) precedes its consumers `QueueItemEditor` (T008) and `LibraryItemEditor` (T017).
- `LibraryTable` (T018) follows `LibrarySearchBar` (T016, embedded) and `LibraryItemEditor` (T017, used in the expanded editor row).
- Overlay migrations (T024, T025) precede the consuming-test updates (T027).

### Cross-story coupling note

The bespoke `ConfirmDialog`/`BulkCleanDialog` keep a **stable props/emits contract**
(ui-contracts.md §1), so US2 components migrate against them as-is; US3 then swaps them to
`UModal` and updates the teleport-affected consuming tests in T027. No component is blocked on
a later story's internals.

### Parallel Opportunities

- All red-first test tasks within a story are different files → `[P]` (T003–T006; T012–T015; T020–T023).
- US1 implementation: T009 (`GenerateForm`) and T010 (`UploadDropzone`) are `[P]`; T007 precedes T008.
- US3 implementation: T026 (`DefaultTagsSettings`) is `[P]` with the overlay migrations T024/T025.
- Polish: T028, T029, T033 are `[P]`.
- With staffing, US1 can proceed alongside Foundational; US2 and US3 can overlap once T002 + T007 land.

---

## Parallel Example: User Story 1 (red-first tests)

```bash
# Author these failing specs together (different files):
Task: "Rewrite tests/component/MetadataFields.test.ts (red)"      # T003
Task: "Rewrite tests/component/QueueItemEditor.test.ts (red)"     # T004
Task: "Update tests/component/Generate.test.ts (red)"             # T005
Task: "Update tests/component/QueueList.test.ts (red)"            # T006

# Then parallelizable implementation:
Task: "Migrate GenerateForm.vue"     # T009 [P]
Task: "Migrate UploadDropzone.vue"   # T010 [P]
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → Phase 3 US1 (Generate). US1 needs no date dependency.
2. **STOP and VALIDATE**: `pnpm test:component` for the Generate specs green in light + dark; visually confirm the Generate tab.

### Incremental build (single combined PR)

1. Setup → Foundational (`@internationalized/date`).
2. US1 (Generate) → green.
3. US2 (Library: search bar → item editor → table) → green.
4. US3 (overlays → settings → consuming-test updates) → green.
5. Polish (remove dead `LibraryList`, i18n parity, SC-001 grep, full gate, manual dark/light smoke).
6. Open one PR for the whole migration (`Closes #<issue>` if tracked in GitHub Issues).

---

## Notes

- `[P]` = different files, no dependency on an incomplete task.
- This is **presentation-only**: no `src/core/`, `server/`, schema, or contract changes — the full `pnpm test` (unit + integration) must stay green untouched as a guardrail.
- Verify each red test fails before implementing; commit after each task or logical group via `/speckit-git-commit`.
- Honor the `data-test` ledger (ui-contracts.md §2) — it is the regression gate.
- Stop at any checkpoint to validate a slice independently.
