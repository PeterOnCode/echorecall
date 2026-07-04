# Tasks: Generate Tab Redesign (Figma) + Generation-Flow Enhancements

**Input**: Design documents from `/specs/007-generate-redesign/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (user stories), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ui-contracts.md](./contracts/ui-contracts.md)

**Tests**: INCLUDED and **red-first** — Constitution v2.5.0 Principle II (Test-First) is NON-NEGOTIABLE, and the plan mandates red-first for every new/forked component and both new core modules. `wavesurfer.js` is **not** used by this feature (no waveform player), so no waveform mock is needed.

**Organization**: Tasks are grouped by user story (spec.md priorities). Each story is an independently testable increment. Reuse the recorded `@nuxt/ui` test gotchas (USelectMenu emit trick, UInputNumber clamp, UInput/UTextarea `@blur` commit, UModal `#body` scroll, `useColorMode` mock, i18n catalog prewarm) and typecheck gotchas (auto-import components; import composable **types** by relative path).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US6 (user story). Setup / Foundational / Polish tasks carry no story label.
- All paths are repo-relative and exact.

## Path Conventions

Nuxt web app over a shared core: `app/` (Vue components, pages, composables), `src/core/` (framework-agnostic core), `server/api/` (Nitro routes), `tests/` (`component/`, `integration/`, `unit/`), `i18n/locales/`. Run test/native commands via `mise exec node@22.22.2 -- …`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Parallel-build entrypoint so the current Generate page (`/`) keeps working untouched (FR-001).

- [X] T001 Create the parallel Generate route shell `app/pages/generate-next.vue` rendering a page-intro placeholder only (no logic yet), reachable at `/generate-next`, using the app's `indigo` accent (FR-001/FR-021)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The single-scrolling page skeleton that both the editor (US1) and the embedded workspace (US2) fill. MUST complete before US1/US2.

- [X] T002 [P] Red test `tests/component/generate-next.layout.spec.ts` asserting `generate-next.vue` renders the five stacked regions in order — page intro, editor region, action-bar region, embedded-workspace region, status-bar region (`data-test="generate-next"`) — as a single scrolling page with no resizable split (FR-003)
- [X] T003 Implement the single-scroll layout skeleton in `app/pages/generate-next.vue`: page intro + empty container regions (editor 3-col grid, action bar, embedded workspace, status bar), collapsing to one column on narrow viewports (FR-003) — makes T002 green

**Checkpoint**: The parallel page renders its region skeleton; stories can now slot components in.

---

## Phase 3: User Story 1 — Three-column generation editor + action bar (Priority: P1) 🎯 MVP

**Goal**: Build a queue on one scrolling page — Script entry, Generation settings, Metadata, and an action bar (Save queue / Load queue / Upload .txt batch / Generate + count badge), replacing the 005 two-pane QueueList.

**Independent Test**: Open `/generate-next`; type a script, set voice/format/metadata, Add to queue → the row appears and the count badge increments; Clear empties the textarea; Save/Load/Upload round-trip a queue (spec US1 acceptance).

### Tests (red-first) for US1

- [X] T004 [P] [US1] Component spec `tests/component/ScriptEntryPanel.spec.ts`: textarea + character hint vs `MAX_INPUT_LENGTH`, Clear empties text (queue untouched), Add emits, blank text is blocked (`data-test` `script-panel`/`add-text-input`/`add-text-submit`/`script-clear`/`script-charcount`)
- [X] T005 [P] [US1] Component spec `tests/component/GenerationSettingsPanel.spec.ts`: Voice/Model/Format selects over `VOICES`/`MODELS`/`FORMATS`, numeric Speed clamped to [0.25,4.0] (`data-test` `voice`/`model`/`format`/`speed`) — resolution/reset deferred to US3
- [X] T006 [P] [US1] Component spec `tests/component/GenerationActionBar.spec.ts`: count badge matches queue size, Save/Load/Upload/Generate emits, Generate disabled when the queue is empty (`data-test` `action-bar`/`action-generate`/`action-save-queue`/`action-load-queue`/`action-upload-txt`/`queue-count-badge`)
- [X] T007 [P] [US1] Component spec `tests/component/QueuePanel.spec.ts`: renders pending rows (text preview + status), remove emits, empty state (`data-test` `queue-panel`/`queue-row`/`queue-row-status`/`queue-empty`/`remove-item`)
- [X] T008 [US1] Integration spec `tests/integration/generate-next.editor.spec.ts`: Add increments the badge; Clear leaves the queue; Save→Load round-trips via `useQueueFile`; Upload .txt appends parsed rows via `addFromUpload` (`queue-file-input`)

### Implementation for US1

- [X] T009 [P] [US1] Create `app/components/generate/ScriptEntryPanel.vue` (fork `AddTextPanel.vue`): title+badge, textarea, char hint, Clear, Add to queue — makes T004 green
- [X] T010 [P] [US1] Create `app/components/generate/GenerationSettingsPanel.vue` (fork `GenerateForm.vue`): Voice/Model/Format `USelectMenu` + numeric Speed; values via `v-model` (resolution stubbed to fallback for now) — makes T005 green
- [X] T011 [P] [US1] Create `app/components/generate/GenerationActionBar.vue` (fork `GenerateToolbar.vue`): queue summary + count badge + Save queue / Load queue / Upload .txt batch / Generate — makes T006 green
- [X] T012 [P] [US1] Create `app/components/generate/QueuePanel.vue` (replaces `QueueList.vue`): compact pending-item list with text preview + status + remove — makes T007 green
- [X] T013 [US1] Wire the editor into `app/pages/generate-next.vue`: three columns (ScriptEntryPanel, GenerationSettingsPanel, reused `MetadataFields.vue`) + GenerationActionBar + QueuePanel, backed by `useQueue` + `useGeneration.generateAll` + `useQueueFile`; Upload .txt calls `useQueue.addFromUpload`; Save/Load use `serialize`/`loadDocument` — makes T008 green (FR-003/FR-004/FR-005/FR-006/FR-007)
- [X] T014 [P] [US1] Add en/hu i18n keys for the page intro, script panel, generation-settings labels, metadata labels reused, and action-bar labels in `i18n/locales/en.json` + `i18n/locales/hu.json` (parity, FR-022)

**Checkpoint**: US1 is independently demoable — build a queue and Generate (using the existing generation loop) entirely on `/generate-next`. **This is the MVP.**

---

## Phase 4: User Story 2 — Embedded Library-style workspace (Priority: P1)

**Goal**: Embed the fully-functional 006 Library components below the editor over the same `useLibrary` data — **without** the waveform player (FR-008/G-EMBED).

**Independent Test**: The lower workspace renders filter bar + file table + Tag Editor inspector + status bar (no player); filter/sort/multi-select/edit+Save/bulk-delete behave as on the Library tab; a generated recording appears in the embedded table (spec US2 acceptance).

### Tests (red-first) for US2

- [ ] T015 [US2] Integration spec `tests/integration/generate-next.embed.spec.ts`: the embedded workspace renders `LibraryFilterBar`/`LibraryFileTable`/`TagInspector`/`LibraryStatusBar`; **asserts no `WaveformPlayer` is present**; a tag edit+Save goes through the shared `useLibrary`; a newly generated recording appears after a run (FR-008/FR-009/FR-010)

### Implementation for US2

- [ ] T016 [US2] Mount the 006 Library components in `app/pages/generate-next.vue`'s embedded-workspace region (`LibraryFilterBar`, `LibraryFileTable`, `LibraryColumnsDialog`, `BulkTagEditDialog`, `TagInspector`, `InspectorFieldsDialog`, `LibraryStatusBar`) wired to `useLibrary` + `useViewPreferences` + `useTagDrafts`, **explicitly excluding `WaveformPlayer.vue`** (FR-008/FR-009)
- [ ] T017 [US2] After a generation run completes, refresh `useLibrary` so newly generated recordings appear in the embedded table (FR-010) — makes T015 green

**Checkpoint**: US1 + US2 deliver the full P1 Generate surface (editor + live library workspace) at the parallel route.

---

## Phase 5: User Story 3 — Persisted generation settings (Priority: P2)

**Goal**: Configurable Voice/Model/Format/Speed defaults (server, alongside Default Tags) + remembered last-selected; resolution last-selected → default → fallback; per-field reset (G-DEFAULTS, FR-011–FR-013).

**Independent Test**: Set defaults in Settings; a fresh page shows them; changing a field then revisiting shows the last-selected value; per-field reset restores the configured default (spec US3 acceptance).

### Tests (red-first) for US3

- [ ] T018 [P] [US3] Core unit spec `tests/unit/generation-defaults.spec.ts`: sanitize (drop unknown voice/model/format, clamp speed), round-trip, all-blank ≡ clear, `get` never throws — against an in-memory `AppConfigRepository`
- [ ] T019 [P] [US3] Route/integration spec `tests/integration/generation-defaults.route.spec.ts`: `GET`/`PUT`/`DELETE /api/settings/generation-defaults` return `{ generationDefaults }`, sanitize on PUT, clear on empty/DELETE
- [ ] T020 [P] [US3] Unit spec `tests/unit/useViewPreferences.genSettings.spec.ts`: last-selected read-merge-sanitize under key `echorecall:viewprefs:genSettings`; unknown values ignored; SSR-safe fallback
- [ ] T021 [P] [US3] Component spec `tests/component/GenerationDefaultsSettings.spec.ts`: fields + Save + Clear + per-field reset + status (`data-test` `gen-default-voice`/`-model`/`-format`/`-speed`/`gen-default-reset-*`/`gen-default-save`/`gen-default-clear`/`gen-default-status`)
- [ ] T022 [US3] Extend `tests/component/GenerationSettingsPanel.spec.ts`: per-field reset emits + resolution order (last-selected → configured default → fallback) (`gen-reset-voice`/`-model`/`-format`/`-speed`)

### Implementation for US3

- [ ] T023 [P] [US3] Create core module `src/core/settings/generation-defaults.ts` (`GENERATION_DEFAULTS_CONFIG_KEY`, `GenerationDefaults`, `getGenerationDefaults`/`setGenerationDefaults`/`clearGenerationDefaults`) mirroring `default-tags.ts`, validating via `isKnownVoice`/`isKnownModel`/`isKnownFormat`/`normalizeSpeed`; export from `src/core/index.ts` — makes T018 green
- [ ] T024 [P] [US3] Create server routes `server/api/settings/generation-defaults.get.ts`, `.put.ts`, `.delete.ts` over `getAppConfigRepository()` — makes T019 green
- [ ] T025 [P] [US3] Create `app/composables/useGenerationDefaults.ts` (load/save/clear + per-field reset over the new routes), mirroring `useDefaultTags` — supports T021
- [ ] T026 [US3] Extend `app/composables/useViewPreferences.ts` with `genSettings` last-selected (`{voiceId?,model?,format?,speed?}`) + read/persist + per-field reset — makes T020 green
- [ ] T027 [US3] Create `app/components/settings/GenerationDefaultsSettings.vue` and mount it in `app/components/settings/SettingsModal.vue` beside `DefaultTagsSettings` — makes T021 green
- [ ] T028 [US3] Wire resolution (last-selected → configured default → fallback) and per-field reset into `GenerationSettingsPanel.vue` + `generate-next.vue`/`useQueue` so the four controls initialize and persist correctly — makes T022 green (FR-012/FR-013)
- [ ] T029 [P] [US3] Add en/hu i18n keys for the generation-defaults Settings section + reset labels (parity, FR-022)

**Checkpoint**: Voice/Model/Format/Speed persist and resolve per the clarified order; independently testable via Settings.

---

## Phase 6: User Story 4 — Generation progress modal with cancel (Priority: P2)

**Goal**: A progress modal (current file, per-file succeeded/failed, page disabled) whose close **confirms then gracefully stops** the run (finish in-flight, stop before next), with a summary (G-CANCEL, FR-014–FR-017).

**Independent Test**: Generate multiple items → modal shows progress; a failing item is skipped and the run continues; closing prompts a confirm; confirm finishes the in-flight file then stops; the summary shows succeeded/failed/not-generated (spec US4 acceptance).

### Tests (red-first) for US4

- [ ] T030 [P] [US4] Component spec `tests/component/GenerationProgressModal.spec.ts`: shows current file + succeeded/failed tally; page disabled while running; close-request → in-modal confirm (`progress-cancel-confirm`), confirm/decline emits, summary states (`progress-modal`/`progress-current`/`progress-succeeded`/`progress-failed`/`progress-summary`) — must NOT use a native `confirm`/`alert`
- [ ] T031 [US4] Integration spec `tests/integration/generate-next.progress-cancel.spec.ts` (mocked `$fetch`): sequential run, a failure is recorded and skipped (run continues), confirm-then-stop finishes the in-flight item then breaks before the next, remaining items reported not-generated, summary counts correct (FR-015/FR-016/FR-017)

### Implementation for US4

- [ ] T032 [US4] Extend `app/composables/useGeneration.ts`: add reactive `progress` (`{ total, index, current, succeeded[], failed[], notGenerated[], state }`) and a `cancelRequested` ref checked **between items** in `generateAll` (await the in-flight `generateItem`, then break); expose progress + `requestCancel`/`reset` — makes T031 green (no `AbortController`)
- [ ] T033 [US4] Create `app/components/generate/GenerationProgressModal.vue` with an in-modal `@nuxt/ui` confirm (no native dialog) — makes T030 green
- [ ] T034 [US4] Wire the modal into `app/pages/generate-next.vue`: open on Generate, disable the rest of the page while running, route close→confirm→`requestCancel`, show the end summary (FR-014)
- [ ] T035 [P] [US4] Add en/hu i18n keys for the progress modal, cancel-confirm, and summary (parity, FR-022)

**Checkpoint**: Long runs are visible and safely cancellable; independently testable.

---

## Phase 7: User Story 5 — Per-item cost estimate + queue total (Priority: P3)

**Goal**: Per-item + total cost before Generate; `gpt-4o-mini-tts` shows "unavailable"; total sums estimable items + "+ N items unavailable" note; display-only (G-PRICING, FR-018/FR-019).

**Independent Test**: Estimable-model items show per-item estimates and a summed total; a token-priced item shows "unavailable", is excluded from the total, and drives the "+N unavailable" note; Generate is never blocked (spec US5 acceptance).

### Tests (red-first) for US5

- [ ] T036 [P] [US5] Core unit spec `tests/unit/pricing.spec.ts`: `estimateItemCost` per model (`tts-1`=charN/1e6·15, `tts-1-hd`=·30), `gpt-4o-mini-tts`→`'unavailable'`, empty text → `{amountUsd:0}` for estimable models
- [ ] T037 [US5] Unit spec `tests/unit/useQueue.cost.spec.ts`: `QueueCost` per-item map from `item.text.length`, `totalUsd` sums estimable only (never counts unavailable as $0), `unavailableCount`
- [ ] T038 [US5] Component spec (extend `QueuePanel` + `GenerationActionBar`): per-item cost / "unavailable" (`queue-row-cost`), total (`queue-total-cost`), "+N unavailable" note (`queue-unavailable-note`); Generate not blocked by estimate state

### Implementation for US5

- [ ] T039 [P] [US5] Create core module `src/core/tts/pricing.ts` (`MODEL_PRICING`, `CostEstimate`, `estimateItemCost`) and export from `src/core/index.ts` — makes T036 green
- [ ] T040 [US5] Derive `QueueCost` (perItem/totalUsd/unavailableCount) in `app/composables/useQueue.ts` via `estimateItemCost` over each item's text length — makes T037 green
- [ ] T041 [US5] Render per-item cost in `QueuePanel.vue` and the total + "+N unavailable" note in `GenerationActionBar.vue`; keep it display-only (never gate Generate) — makes T038 green
- [ ] T042 [P] [US5] Add en/hu i18n keys for cost, "unavailable", and "+N items unavailable" (parity, FR-022)

**Checkpoint**: Honest per-item + total estimates shown before Generate; independently testable.

---

## Phase 8: User Story 6 — Recording date defaults to today (Priority: P3)

**Goal**: Recording date defaults to the generation day (date-only), stamped at generation time only when empty; user-set dates preserved — replacing the `tomorrowIso()` add-time default and resolving the 005 clobber (FR-020).

**Independent Test**: A blank-dated item generated stores the generation day; a user-dated item keeps its date (spec US6 acceptance).

### Tests (red-first) for US6

- [ ] T043 [US6] Unit spec `tests/unit/useQueue.recordedAt.spec.ts`: `makeItem` no longer stamps a default `recordedAt`; the generate flow stamps `todayIso()` only when `recordedAt` is empty; a user-set `recordedAt` is never overwritten; several items in one run each behave correctly

### Implementation for US6

- [ ] T044 [US6] Remove the `tomorrowIso()` default from `useQueue.makeItem`, add a `todayIso()` helper, and stamp `recordedAt` at generation time (over the generate target, only when empty) in `app/composables/useQueue.ts` / the generate flow — makes T043 green

**Checkpoint**: Recording date is correct and non-destructive; the long-standing clobber is resolved.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: i18n/a11y verification, quality gates, and the final cutover (FR-002/FR-022/FR-023, SC-007/SC-009).

- [ ] T045 [P] i18n parity test `tests/unit/i18n.generate-next.spec.ts`: every new key added by this feature exists in both `en.json` and `hu.json` with no missing/extra keys (FR-022/SC-007)
- [ ] T046 [P] Accessibility sweep test `tests/component/generate-next.a11y.spec.ts`: every new control (script textarea + Clear + Add, four selects + resets, Save/Load/Upload/Generate, per-item remove, progress-modal confirm) is tab-reachable, Enter/Space-activatable, and ARIA-labelled (FR-023/SC-007)
- [ ] T047 Run `mise exec node@22.22.2 -- pnpm typecheck` and `… pnpm lint`; fix any issues, honoring the `~`-alias / composable-type-import / `runtimeConfig.public` / i18n-composer gotchas
- [ ] T048 **Cutover** (FR-002/SC-009): repoint the Generate nav target to the new surface, move `app/pages/generate-next.vue` into `app/pages/index.vue`, and DELETE the superseded 005 Generate components (`AddTextPanel.vue`, `GenerateForm.vue`, `GenerateToolbar.vue`, `QueueList.vue`, and `QueueColumnsDialog.vue` if unused) plus their now-dead tests; update any references so `/` renders the redesigned page and existing links resolve
- [ ] T049 Execute the [quickstart.md](./quickstart.md) validation scenarios end-to-end against `pnpm dev`, confirming SC-001…SC-011 (indigo accent, no green, Account area omitted)
- [ ] T050 Final green gate: `mise exec node@22.22.2 -- pnpm test`, `… pnpm test:component`, `… pnpm typecheck`, `… pnpm lint` all pass

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** block everything.
- **US1 (Phase 3)** and **US2 (Phase 4)** are both P1 and both mount into the Phase 2 skeleton; US2's "new recording appears" check (T017) is easiest to verify once US1 can generate, so **do US1 before US2**.
- **US3/US4/US5/US6** each build on the US1 editor + `useQueue`/`useGeneration` and are otherwise independent of one another — after US1 they can proceed **in parallel** (different files: US3 core/settings, US4 `useGeneration`+modal, US5 `pricing`+`useQueue` cost, US6 `useQueue` date). US5 and US6 both touch `useQueue.ts`, so serialize their `useQueue` edits (T040 before/after T044) or land them in one coordinated change.
- **Polish (Phase 9)** runs after all stories; **T048 cutover is strictly last** among functional work (it deletes the old page/components).

**Story completion order (priority)**: US1 → US2 → US3 → US4 → US5 → US6 → Polish/Cutover.

## Parallel Execution Examples

- **US1 tests** T004, T005, T006, T007 are independent files → run in parallel; then their impl T009, T010, T011, T012 in parallel; T013 (page wiring) after; T014 (i18n) parallel with impl.
- **US3 core/routes/composable** T023, T024, T025 touch different files → parallel; T026/T027/T028 (wiring) follow.
- **Cross-story after US1**: a dev can take US3 (T018–T029), another US4 (T030–T035), another US5 (T036–T042) concurrently; coordinate the shared `useQueue.ts` edits between US5 (T040) and US6 (T044).

## Implementation Strategy

- **MVP = User Story 1** (Phase 1–3): the rebuilt three-column editor + action bar generating on one scrolling page at `/generate-next`. Demoable on its own.
- **Full P1 = US1 + US2**: adds the embedded live Library workspace (no player).
- **Incremental P2/P3**: layer US3 (persisted settings), US4 (progress/cancel), US5 (cost), US6 (date) as independent increments, each red-first.
- **Ship**: Polish + **cutover last** — swap `/` to the new surface and delete the 005 Generate page/components once the full suite is green.
