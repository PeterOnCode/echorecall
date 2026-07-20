# Tasks: Structured Generate Batch Import

**Input**: Design documents from `specs/008-batch-import/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required. EchoRecall Constitution v2.6.0 mandates Red–Green–Refactor, and the feature specification explicitly requires unit, component, integration, localization, accessibility, and regression coverage.

**Organization**: Tasks are grouped by user story. Each story starts with tests, explicit user/reviewer approval of those tests, and a recorded red run before implementation. Setup, foundational, and cross-cutting tasks carry the label of the story that owns their acceptance.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Safe to execute in parallel because the task touches different files and has no dependency on unfinished work in the same phase.
- **[Story]**: Maps the task to the specification's user story.
- Every task includes an exact repository path.

## Phase 1: Setup

**Purpose**: Declare the constitution-approved parser dependency before core work.

**Documented TDD exemption for T001–T003**: These tasks install the constitution-approved parser and establish compile-time-only shared types/exports required for test files to load. They introduce no parsing, validation, queue, or UI behavior. All observable behavior begins in US1 only after its tests are written, approved, and confirmed red. Any observable behavior discovered in T001–T003 MUST be moved behind the US1 red gate.

- [X] T001 [US1] Add `yaml` `^2.9.0` as a direct runtime dependency and refresh the lockfile in `package.json` and `pnpm-lock.yaml` under the documented non-behavioral TDD exemption

---

## Phase 2: Foundational Contracts

**Purpose**: Establish shared strict types used by every serialization adapter, preview, and queue integration.

**⚠️ CRITICAL**: Complete this phase before any user-story implementation.

- [X] T002 [US1] Define compile-time-only `BatchDocumentV1`, defaults/items, metadata patches, base/resolved inputs, source locations, issue/error unions, candidates, previews, and parse results in `src/core/batch/contract.ts` under the documented non-behavioral TDD exemption
- [X] T003 [US1] Export only the compile-time batch contract types and shared 5 MiB constant through `src/core/client.ts` and align its ownership comment in `src/core/tts/provider.ts` under the documented non-behavioral TDD exemption

**Checkpoint**: Raw input can be represented only as `unknown`, and invalid candidates cannot expose a typed `ResolvedQueueInput`.

---

## Phase 3: User Story 1 — Import a YAML batch with inherited values (Priority: P1) 🎯 MVP

**Goal**: Select a valid canonical YAML document, resolve base → defaults → item overrides, preview without queue mutation, and explicitly append the confirmed rows.

**Independent Test**: With known Generate values, import a YAML document containing defaults, multiline text, overrides, null clearing, and array replacement; verify the ordered preview exactly, then confirm and verify append-only queue mutation with fresh transient state.

### Tests for User Story 1 — write and verify red first

- [ ] T004 [P] [US1] Write failing strict YAML 1.2, schema/version, precedence, multiline text, missing inheritance, null clearing, array replacement, metadata structure, order, duplicate-key, custom-tag, anchor, alias, and multi-document tests in `tests/unit/batch-yaml.test.ts`
- [ ] T005 [P] [US1] Write failing queue append tests for resolved values, fresh IDs/status/source/filename, metadata cloning, Title retention, Track derivation compatibility, and existing-row preservation in `tests/component/QueueState.test.ts`
- [ ] T006 [P] [US1] Write failing action-bar rename/event tests for **Import batch** in `tests/component/GenerationActionBar.test.ts`
- [ ] T007 [P] [US1] Write failing valid-preview dialog tests for ordered one-based items, excerpts, resolved settings, counts, confirm, and cancel in `tests/component/BatchImportPreviewDialog.test.ts`
- [ ] T008 [P] [US1] Write failing Generate-page tests for YAML selection, frozen base values, zero mutation before confirmation, append on confirmation, and same-file reselection in `tests/component/generate-next.batch-import.test.ts`
- [ ] T009 [US1] Obtain explicit user/reviewer approval for the US1 tests from T004–T008, then run the approved focused unit and component tests and record the expected failures before implementation in `specs/008-batch-import/quickstart.md`

### Implementation for User Story 1

- [ ] T010 [US1] Implement strict YAML 1.2 `parseDocument` handling, duplicate-key errors, explicit-tag rejection, unused-anchor/alias rejection, multiple-document rejection, and defensive `maxAliasCount: 0` conversion in `src/core/batch/parse-yaml.ts`
- [ ] T011 [US1] Implement exact document/default/item/metadata validation plus base → defaults → item resolution, null clearing, array replacement, catalog checks, and normalized candidates in `src/core/batch/validate-batch.ts`
- [ ] T012 [US1] Implement YAML format orchestration and typed blocking-versus-preview results in `src/core/batch/parse-batch.ts`
- [ ] T013 [US1] Export the YAML parser/orchestrator functions through `src/core/client.ts`
- [ ] T014 [US1] Add `appendImported` to deep-clone normalized inputs, mint fresh queue state, append without rewriting existing rows, mark structured metadata row-specific, and preserve Feature 007 Voice/Model/Format and Track behavior in `app/composables/useQueue.ts`
- [ ] T015 [US1] Rename the action-bar upload event/control/test id from `.txt` upload to unified batch import in `app/components/generate/GenerationActionBar.vue`
- [ ] T016 [US1] Create the valid-state modal shell with ordered read-only rows, one-based item labels, resolved setting display, counts, and confirm/cancel emits in `app/components/generate/BatchImportPreviewDialog.vue`
- [ ] T017 [US1] Create the browser file adapter for extension detection, size/read handling, frozen Generate base snapshots, YAML core invocation, and idle/reading/parsing/preview state in `app/composables/useBatchImport.ts`
- [ ] T018 [US1] Wire the unified YAML file input, import state, preview dialog, cancellation, and confirmed structured append into `app/pages/generate.vue`
- [ ] T019 [US1] Add the initial Import batch, valid preview, confirm/cancel, resolved-setting, and success-summary copy with matching structure in `i18n/locales/en.json` and `i18n/locales/hu.json`
- [ ] T020 [US1] Run the US1-focused tests until green, then refactor without changing the contracts in `tests/unit/batch-yaml.test.ts`, `tests/component/QueueState.test.ts`, `tests/component/GenerationActionBar.test.ts`, `tests/component/BatchImportPreviewDialog.test.ts`, and `tests/component/generate-next.batch-import.test.ts`

**Checkpoint**: A valid YAML batch can be previewed and appended; the queue remains unchanged until confirmation.

---

## Phase 4: User Story 2 — Review row-specific errors and import valid rows (Priority: P1)

**Goal**: Show every valid/invalid candidate with source-specific issues, paginate large previews, import only valid rows, and announce accessible outcomes.

**Independent Test**: Import a mixed-validity document, verify one-based issue association and read-only details, confirm that only valid rows append, verify zero-valid confirmation is disabled, and verify cancellation leaves all queue state unchanged.

### Tests for User Story 2 — write and verify red first

- [ ] T021 [P] [US2] Write failing mixed-item tests for multiple issue codes/paths, exact unknown fields, wrong types, empty/oversized text, invalid catalogs/metadata, invalid blocking defaults, best-effort display, duplicate text, and valid sibling preservation in `tests/unit/batch-preview.test.ts`
- [ ] T022 [P] [US2] Extend failing queue tests for valid-only append, structured metadata preservation, concurrent queue additions, existing object identity/order/selection/active state, and absent transient error/result state in `tests/component/QueueState.test.ts`
- [ ] T023 [P] [US2] Extend failing dialog tests for invalid indicators, associated issue lists, zero-valid disabled confirmation, 100-row pagination, all-page confirmation counts, keyboard/focus behavior, status announcements, and alert semantics in `tests/component/BatchImportPreviewDialog.test.ts`
- [ ] T024 [P] [US2] Extend failing page tests for oversized/unsupported/unreadable files, blocking document errors, mixed valid-only confirmation, cancellation, parsing/ready/success announcements, and a queue changed while preview is open in `tests/component/generate-next.batch-import.test.ts`
- [ ] T025 [US2] Obtain explicit user/reviewer approval for the US2 tests from T021–T024, then run the approved focused unit and component tests and record the expected failures before implementation in `specs/008-batch-import/quickstart.md`

### Implementation for User Story 2

- [ ] T026 [US2] Complete stable document/candidate issue-code creation with source paths, one-based locations, line/column details, multiple row errors, and best-effort displays in `src/core/batch/validate-batch.ts`
- [ ] T027 [US2] Complete preview invariants, valid/rejected/blank counts, duplicate retention, zero-valid confirmation guard, and blocking scope mapping in `src/core/batch/parse-batch.ts`
- [ ] T028 [US2] Harden `appendImported` for valid normalized inputs, existing-row identity/order/state preservation, concurrent additions, and structured-versus-text metadata modes in `app/composables/useQueue.ts`
- [ ] T029 [US2] Add invalid-row details, localized issue association, disabled zero-valid confirm, 100-row pagination, all-page counts, modal focus behavior, polite status, and blocking alerts in `app/components/generate/BatchImportPreviewDialog.vue`
- [ ] T030 [US2] Complete blocked/imported/cancelled state transitions, actionable file errors, and valid-candidate extraction across all preview pages in `app/composables/useBatchImport.ts`
- [ ] T031 [US2] Wire valid-only confirmation, cancel/dismiss cleanup, concurrent append behavior, and accessible status/alert regions into `app/pages/generate.vue`
- [ ] T032 [US2] Add every blocking and row issue message, pagination label, valid/rejected/blank count, disabled-confirm explanation, and status announcement in `i18n/locales/en.json` and `i18n/locales/hu.json`
- [ ] T033 [US2] Run the US2-focused tests until green and verify the 100-candidate preview target plus an accepted greater-than-100 paged preview in `tests/unit/batch-preview.test.ts`, `tests/component/BatchImportPreviewDialog.test.ts`, `tests/component/QueueState.test.ts`, and `tests/component/generate-next.batch-import.test.ts`

**Checkpoint**: One bad item never hides valid siblings; confirmation appends all and only valid candidates across the complete preview.

---

## Phase 5: User Story 3 — Import equivalent JSON and plain-text batches (Priority: P2)

**Goal**: Add strict JSON as the canonical structured equivalent and preserve line-based text import through the same preview-and-confirm workflow.

**Independent Test**: From the same Generate base, import equivalent YAML and JSON and verify identical normalized previews; import text with blank and oversized lines and verify original line numbers, counts, ordering, and valid-only confirmation.

### Tests for User Story 3 — write and verify red first

- [ ] T034 [P] [US3] Write failing JSON strict-grammar, duplicate/escaped-equivalent property, YAML/JSON equivalence, order, schema/version, and malformed-input tests in `tests/unit/batch-json.test.ts`
- [ ] T035 [P] [US3] Rewrite failing text parser tests for original one-based line numbers, CRLF/LF, trimming, internal blanks, conventional trailing newline, whitespace-only compatibility, oversized visible candidates, duplicates, order, and preview counts in `tests/unit/parse-upload.test.ts`
- [ ] T036 [P] [US3] Extend failing page tests for `.txt`, `.yaml`, `.yml`, and `.json` acceptance, format dispatch, JSON/text previews, source filenames, and valid-only confirmation in `tests/component/generate-next.batch-import.test.ts`
- [ ] T037 [P] [US3] Write failing regression tests proving `echorecall.batch` JSON appends while existing `echorecall.queue` JSON Load queue still replaces through its existing confirmation path in `tests/integration/batch-import-regression.test.ts`
- [ ] T038 [US3] Obtain explicit user/reviewer approval for the US3 tests from T034–T037, then run the approved focused unit, component, and integration tests and record the expected failures before implementation in `specs/008-batch-import/quickstart.md`

### Implementation for User Story 3

- [ ] T039 [US3] Implement decoded duplicate-property preflight with the `yaml` Document AST parser configured in `schema: 'json'` mode—not JSON Schema validation—followed by native strict `JSON.parse` and typed blocking errors in `src/core/batch/parse-json.ts`
- [ ] T040 [US3] Implement line-aware text preview candidates and preserve shipped blank/trailing-newline conventions in `src/core/batch/parse-text.ts`
- [ ] T041 [US3] Retain a compatibility `parseUploadText` export or migrate its callers while routing text through the unified preview contract in `src/core/batch/parse-upload.ts` and `src/core/client.ts`
- [ ] T042 [US3] Extend format dispatch so text, YAML, and JSON feed the same validator/preview model in `src/core/batch/parse-batch.ts`
- [ ] T043 [US3] Accept and dispatch `.txt`, `.yaml`, `.yml`, and `.json` while preserving original filename and format-specific blocking errors in `app/composables/useBatchImport.ts` and `app/pages/generate.vue`
- [ ] T044 [US3] Keep saved-queue import/replacement isolated while batch JSON remains append-only in `app/composables/useQueueFile.ts` and `app/pages/generate.vue`
- [ ] T045 [US3] Run the US3-focused suites until green and verify equivalent YAML/JSON normalization plus unchanged saved-queue replacement in `tests/unit/batch-json.test.ts`, `tests/unit/parse-upload.test.ts`, `tests/component/generate-next.batch-import.test.ts`, and `tests/integration/batch-import-regression.test.ts`

**Checkpoint**: All four accepted extensions share one review flow, while Load queue retains its separate contract and replacement semantics.

---

## Phase 6: User Story 4 — Discover and reuse the batch contract (Priority: P2)

**Goal**: Make the canonical format self-discoverable through a tested downloadable YAML example and complete human-readable YAML/JSON documentation.

**Independent Test**: Download the YAML example, import it unchanged into a valid preview with two representative candidates, and verify that the documentation alone defines every field, inheritance/clearing/array rule, error rule, Track behavior, and equivalent JSON representation.

### Tests for User Story 4 — write and verify red first

- [ ] T046 [P] [US4] Write failing tests that load the shipped YAML example, parse it through the real core, and assert defaults, two ordered candidates, multiline text, overrides, metadata, and null clearing in `tests/unit/batch-example.test.ts`
- [ ] T047 [P] [US4] Write failing action-bar/page tests for a keyboard-accessible YAML example download with the exact `echorecall-batch-v1.yaml` filename and no queue mutation in `tests/component/GenerationActionBar.test.ts` and `tests/component/generate-next.batch-import.test.ts`
- [ ] T048 [P] [US4] Write a failing documentation contract test that verifies every canonical field/rule heading plus the equivalent JSON example in `tests/unit/batch-documentation.test.ts`
- [ ] T049 [US4] Obtain explicit user/reviewer approval for the US4 tests from T046–T048, then run the approved focused unit and component tests and record the expected failures before implementation in `specs/008-batch-import/quickstart.md`

### Implementation for User Story 4

- [ ] T050 [P] [US4] Add the canonical downloadable YAML example in `public/examples/echorecall-batch-v1.yaml`
- [ ] T051 [P] [US4] Write the complete author guide with field tables, precedence, missing/null/array semantics, validation/safety rules, Track derivation, and equivalent JSON in `docs/batch-import.md`
- [ ] T052 [US4] Add the discoverable example-download control/event to `app/components/generate/GenerationActionBar.vue`
- [ ] T053 [US4] Implement the example download wiring without queue mutation in `app/composables/useBatchImport.ts` and `app/pages/generate.vue`
- [ ] T054 [US4] Add matching English/Hungarian example-download and documentation-link copy in `i18n/locales/en.json` and `i18n/locales/hu.json`
- [ ] T055 [US4] Update current feature, Stack, project layout, and documentation references for shipped batch import in `README.md`
- [ ] T056 [US4] Run the US4-focused suites until green and verify the downloaded example round-trips through the real parser in `tests/unit/batch-example.test.ts`, `tests/unit/batch-documentation.test.ts`, `tests/component/GenerationActionBar.test.ts`, and `tests/component/generate-next.batch-import.test.ts`

**Checkpoint**: A first-time user can discover, download, understand, and successfully preview the canonical format without assistance.

---

## Phase 7: Polish & Cross-Cutting Verification

**Purpose**: Remove obsolete `.txt`-only language, prove localization/accessibility parity, and execute the automated, timed, and manual validation gates.

- [ ] T057 [P] [US3] Remove obsolete `.txt`-only identifiers/comments and align public batch exports without changing saved-queue behavior in `src/core/batch/parse-upload.ts`, `src/core/client.ts`, `app/components/generate/GenerationActionBar.vue`, and `app/pages/generate.vue`
- [ ] T058 [P] [US2] Extend feature-specific English/Hungarian parity assertions for every new batch-import key in `tests/unit/i18n.generate-next.test.ts`
- [ ] T059 [US4] Run `pnpm test`, `pnpm test:component`, `pnpm typecheck`, and `pnpm lint`, fixing only Feature 008 regressions under `src/core/batch/`, `app/components/generate/`, `app/composables/`, `app/pages/generate.vue`, `tests/`, and `i18n/locales/`
- [ ] T060 [US1] Execute the SC-001 timed acceptance walkthrough on the ready-made valid 100-item YAML fixture, measuring from **Import batch** activation through totals review, item 1/item 100 resolved-setting inspection, confirmation, and success announcement; verify completion under 2 minutes and record the elapsed time in `specs/008-batch-import/quickstart.md`
- [ ] T061 [US3] Execute the SC-009 performance matrix on the specified reference desktop using one valid 100-candidate fixture per accepted extension and one representative blocking-error fixture per structured format, measure five consecutive runs per fixture from completed file selection to preview/actionable error, verify every run is at most 3 seconds, and record fixture/run/elapsed-time evidence in `specs/008-batch-import/quickstart.md`
- [ ] T062 [US4] Execute every remaining manual scenario and the no-live-network checks from `specs/008-batch-import/quickstart.md`, then record final outcomes in `specs/008-batch-import/quickstart.md`

---

## Dependencies & Execution Order

### Phase dependencies

```text
Phase 1 Setup
  → Phase 2 Foundational Contracts
    → Phase 3 US1 YAML MVP
      ├→ Phase 4 US2 mixed-error review
      ├→ Phase 5 US3 JSON/text parity
      └→ Phase 6 US4 example/documentation
           all completed → Phase 7 Polish & Verification
```

- Setup has no dependency.
- Foundational contracts depend on the direct parser dependency declaration.
- US1 is the shared MVP because it establishes the parser/validator/orchestrator, queue append, dialog shell, and page wiring.
- After US1, US2, US3, and most of US4 can proceed independently; they extend different adapters/tests, with coordination required on shared page/dialog/action-bar files.
- Polish begins after all selected stories are complete.

### User-story dependencies

- **US1 (P1)**: Depends only on Setup and Foundational; independently demonstrates valid YAML preview and confirmed append.
- **US2 (P1)**: Depends on US1's preview/validator/dialog shell; independently demonstrates mixed-validity review and valid-only import.
- **US3 (P2)**: Depends on US1's common pipeline, not on US2; independently demonstrates JSON/YAML equivalence, text compatibility, and saved-queue separation.
- **US4 (P2)**: Depends on US1's real YAML parser; its JSON documentation must remain aligned with US3's adapter contract. Example and documentation files can be authored in parallel.

### Within each user story

1. Write the story's tests.
2. Obtain explicit user/reviewer approval for the authored tests.
3. Run the approved tests and confirm the expected red state.
4. Implement core behavior before adapters and UI wiring.
5. Run focused suites to green.
6. Refactor only while tests remain green.

## Parallel Opportunities

- US1 test authoring T004–T008 touches five independent test files and can run in parallel.
- US2 test authoring T021–T024 touches four independent test boundaries and can run in parallel.
- US3 test authoring T034–T037 touches distinct unit/component/integration files and can run in parallel.
- US4 test authoring T046–T048 can run in parallel; after red confirmation, T050 and T051 can also run in parallel.
- Cross-cutting cleanup T057 and parity coverage T058 touch different files and can run in parallel.
- Do not parallelize tasks that modify `app/pages/generate.vue`, `GenerationActionBar.vue`, shared locale files, or the same existing test file across stories.

## Parallel Execution Examples

### User Story 1

```text
Parallel tests: T004 batch-yaml, T005 QueueState, T006 GenerationActionBar,
T007 BatchImportPreviewDialog, T008 Generate-page flow.
Then sequential: T009 approval + red gate → T010–T019 implementation → T020 green gate.
```

### User Story 2

```text
Parallel tests: T021 batch-preview, T022 QueueState hardening,
T023 dialog errors/a11y/paging, T024 page failures/status.
Then sequential: T025 approval + red gate → T026–T032 implementation → T033 green gate.
```

### User Story 3

```text
Parallel tests: T034 strict JSON, T035 plain text, T036 accepted extensions,
T037 saved-queue regression.
Then sequential: T038 approval + red gate → T039–T044 implementation → T045 green gate.
```

### User Story 4

```text
Parallel tests: T046 example parsing, T047 download UI, T048 documentation contract.
Then T049 approval + red gate; author T050 example and T051 docs in parallel;
complete T052–T055 integration and finish with T056 green gate.
```

## Implementation Strategy

### MVP first

1. Complete T001–T003.
2. Complete US1 T004–T020 using Red–Green–Refactor.
3. Stop and validate the YAML preview-and-append journey independently.
4. Demo the MVP before adding partial-error, JSON/text, or documentation enhancements.

### Incremental delivery

1. **Foundation**: direct parser dependency plus strict shared contracts.
2. **US1**: valid YAML import with inheritance and explicit confirmation.
3. **US2**: mixed-validity review, paging, accessibility, and valid-only import.
4. **US3**: JSON equivalence, plain-text compatibility, and Load queue regression protection.
5. **US4**: discoverable tested example and full author documentation.
6. **Polish**: terminology cleanup, parity, full automated suites, explicit SC-001/SC-009 timing evidence, and remaining quickstart validation.

## Notes

- Default tests MUST make no live network calls; this feature is entirely local.
- `pnpm test:adapters` is not required because audio tagging/WASM behavior is untouched.
- No task may add a Nitro route, database migration, persistent file storage, XML adapter, arbitrary mapping engine, CLI command, authentication, or editable preview.
- `yaml` use MUST remain within constitution v2.6.0's strict untrusted-input policy.
- Commit after each logical red/green/refactor unit with a focused Conventional Commit subject.
