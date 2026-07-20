# Quickstart Validation: Structured Generate Batch Import

**Feature**: 008-batch-import | **Branch**: `008-batch-import`

This is the runnable validation guide for the planned feature. It does not replace red-first task implementation.

## 1. Governance status

Constitution v2.6.0 approves direct `yaml` use in the framework-independent shared core for strict
YAML 1.2 parsing, source-aware validation, and JSON duplicate-property preflight through its
Document AST parser configured with `schema: 'json'`. This is parser configuration, not JSON
Schema validation. The governance gate is satisfied; task generation and red-first implementation
may proceed.

## 2. Environment

Expected toolchain:

- Node.js 22.22.2
- pnpm 10
- repository branch `008-batch-import`

Install dependencies after the constitution amendment and package change:

```bash
pnpm install
```

Run the application:

```bash
pnpm dev
```

Open `http://localhost:3102/generate`.

## 3. Contract references

- Authoring rules and equivalent examples: [batch-file-contract.md](./contracts/batch-file-contract.md)
- Preview/errors/state: [import-preview-contract.md](./contracts/import-preview-contract.md)
- Queue mutation and Feature 007 interactions: [queue-append-contract.md](./contracts/queue-append-contract.md)
- Entity fields and transitions: [data-model.md](./data-model.md)

## 4. Red-first verification order

For each slice, first add/enable its tests and confirm they fail for the missing behavior. Then implement until they pass and refactor while green.

1. YAML contract parsing and inheritance.
2. Mixed-validity preview and valid-only queue append.
3. JSON duplicate safety and YAML/JSON equivalence.
4. Plain-text preview compatibility.
5. Dialog, paging, accessibility, localization, example, and documentation.
6. Saved-queue replacement regression.

Focused commands during development:

```bash
pnpm test -- tests/unit/batch-yaml.test.ts tests/unit/batch-preview.test.ts tests/unit/batch-json.test.ts tests/unit/parse-upload.test.ts
pnpm test -- tests/unit/batch-example.test.ts tests/unit/batch-documentation.test.ts tests/unit/i18n.generate-next.test.ts
pnpm test:component -- tests/component/BatchImportPreviewDialog.test.ts tests/component/GenerationActionBar.test.ts tests/component/QueueState.test.ts tests/component/generate-next.batch-import.test.ts
pnpm test -- tests/integration/batch-import-regression.test.ts
```

### US1 approved red run — 2026-07-20

The reviewer approved T004–T008 before execution. The focused suites failed for the expected
missing Phase 3 behavior while all previously shipped tests in those invocations remained green:

- `pnpm test -- tests/unit/batch-yaml.test.ts` — failed because
  `src/core/batch/parse-batch.ts` did not exist; the existing 337 unit/integration tests passed.
- `pnpm test:component -- tests/component/QueueState.test.ts tests/component/GenerationActionBar.test.ts tests/component/BatchImportPreviewDialog.test.ts tests/component/generate-next.batch-import.test.ts`
  — failed because `appendImported`, the renamed **Import batch** action/event, the preview dialog,
  and the unified page file input did not exist; 226 existing component assertions passed.

This is the required US1 red checkpoint. T010–T020 may now implement only the behavior covered by
the approved tests.

### US2 approved red run — 2026-07-20

The reviewer approved T021–T024 before execution. The focused suites isolated the expected Phase 4
gaps while preserving the Phase 3 behavior:

- `pnpm exec vitest run tests/unit/batch-preview.test.ts` — 1 expected failure for precise nested
  metadata issue paths; 6 new preview/default invariants passed.
- `pnpm exec vitest run --config vitest.nuxt.config.ts tests/component/QueueState.test.ts tests/component/BatchImportPreviewDialog.test.ts tests/component/generate-next.batch-import.test.ts`
  — 8 expected failures for invalid-row semantics, zero-valid explanation, 100-row pagination,
  live status, and localized file errors; 24 assertions, including queue hardening, passed.

This is the required US2 red checkpoint. T026–T033 may now implement only the behavior covered by
the approved tests.

## 5. Manual scenario A — YAML defaults and overrides

1. Set known current Generate Voice, Model, Format, and metadata values.
2. Activate **Import batch** and download the YAML example.
3. Import the example unchanged.
4. Verify the queue is unchanged while preview is open.
5. Verify two one-based items appear in order with resolved settings.
6. Verify multiline text remains one item.
7. Verify item 2 clears instructions and artist, keeps unrelated inherited metadata, and shows its custom title.
8. Confirm.

Expected:

- both valid rows append after all existing rows;
- each receives a fresh identity, queued state, upload source, and example filename;
- existing rows and selection are unchanged;
- imported Title remains; Track is recalculated at generation from queue order/start-track.

## 6. Manual scenario B — mixed valid/invalid rows

Create a YAML document with three items: valid, blank text, and valid with an unknown field.

Expected:

- all three items remain visible;
- items are labelled 1, 2, 3;
- items 2 and 3 show localized row errors;
- confirm remains enabled because item 1 is valid;
- confirming appends exactly item 1 and announces `1 imported, 2 rejected`;
- cancelling instead appends nothing.

## 7. Manual scenario C — blocking parser safety

Individually try:

- duplicate YAML key;
- YAML custom tag;
- unused YAML anchor;
- YAML alias;
- two YAML documents;
- duplicate JSON property;
- JSON comment or trailing comma;
- wrong schema/version;
- invalid file defaults;
- unsupported extension;
- file larger than 5 MiB.

Expected: each produces an actionable localized blocking error and changes zero queue rows. Duplicate/custom-tag/anchor/alias input is rejected before conversion to normalized objects.

## 8. Manual scenario D — YAML/JSON equivalence

Import the canonical YAML example and its equivalent JSON from the contract from the same Generate base state.

Expected: ordered candidates, resolved values, null clearing, metadata arrays, validation outcomes, and confirmation counts match exactly.

## 9. Manual scenario E — plain-text compatibility

Import a `.txt` file containing:

```text
first

second
```

Add another nonblank line longer than 4,096 characters for the oversized case.

Expected:

- valid rows retain original one-based line numbers and source order;
- internal blank lines are counted but not candidates;
- a single trailing newline is not a phantom blank;
- the oversized line is visible and invalid;
- confirm appends only valid rows after explicit review;
- text rows keep current live Generate metadata behavior.

## 10. Manual scenario F — large accepted batch

Import a file at or below 5 MiB containing more than 100 short candidates.

Expected:

- the file is not rejected for candidate count;
- preview pages contain at most 100 rows;
- every candidate is reachable through pagination;
- counts cover all pages;
- confirm imports every valid candidate, not only the current page.

Only the first 100 candidates carry the explicit responsiveness target; larger accepted batches have no additional timing guarantee.

## 11. Manual scenario G — timed acceptance

Use the reference desktop profile from the specification: at least four logical processor cores,
8 GiB of memory, a current supported browser, and no concurrent processor-intensive workload.

For SC-001, start timing when **Import batch** is activated. Select the ready-made valid 100-item
YAML fixture, verify valid/rejected totals, inspect Voice/Model/Format for items 1 and 100, confirm,
and stop timing when the success announcement appears.

Expected: the complete walkthrough takes less than 2 minutes.

For SC-009, use one valid 100-candidate fixture for each accepted extension and one representative
blocking-error fixture for each structured format. Keep every fixture at or below 5 MiB. For each
fixture, run five consecutive measurements from completed file selection until the preview or
actionable error is available.

Expected: every run completes within 3 seconds. Record fixture, run number, and elapsed time.

## 12. Manual scenario H — concurrent queue change and saved-queue separation

1. Open a valid batch preview.
2. Add another row through the normal Script action before confirming.
3. Confirm the batch.
4. Separately use **Load queue** with an existing `echorecall.queue` JSON file.

Expected:

- the newly typed row remains and imported rows append after it;
- no existing row is rewritten or removed by batch confirmation;
- Load queue still follows its existing replacement confirmation behavior;
- batch JSON and saved-queue JSON are never confused.

## 13. Full verification gate

```bash
pnpm test
pnpm test:component
pnpm typecheck
pnpm lint
```

Expected: all commands pass, no live network calls occur, English/Hungarian parity remains complete, and no saved-queue/generation regression appears. `pnpm test:adapters` is not required because this feature does not touch audio tagging or WASM adapters.

### Phase 3 green verification — 2026-07-20

- US1 focused component tests: 4 files, 30 assertions passed.
- `pnpm test`: 54 files, 348 assertions passed.
- `pnpm test:component`: 41 files, 236 assertions passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.

### Phase 4 green verification — 2026-07-20

- US2 focused core tests: 1 file, 7 assertions passed.
- US2 focused component tests: 3 files, 32 assertions passed.
- The 205-candidate fixture rendered pages of 100, 100, and 5 rows while preserving global counts.
- `pnpm test`: 55 files, 355 assertions passed.
- `pnpm test:component`: 41 files, 247 assertions passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.

### Phase 5 approved red checkpoint — 2026-07-20

- User/reviewer explicitly approved T034–T037 before test execution.
- Focused unit/integration run: 3 files, 23 expected failures and 2 passes. JSON and text requests
  still returned `unsupportedExtension`; the existing saved-queue replacement behavior passed.
- Focused component run: 1 file, 3 expected failures and 7 passes. The file input did not yet
  advertise `.txt`/`.json`, and those formats produced no preview.

This is the required US3 red checkpoint. T039–T044 may now implement only the behavior covered by
the approved tests.

### Phase 5 green verification — 2026-07-20

- US3 focused core/integration tests: 3 files, 25 assertions passed.
- US3 focused component tests: 1 file, 10 assertions passed.
- Equivalent YAML/JSON normalization, strict JSON grammar, decoded duplicate-property rejection,
  original text line locations, and saved-queue replacement isolation all passed.
- `pnpm test`: 57 files, 376 assertions passed.
- `pnpm test:component`: 41 files, 250 assertions passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.

### Phase 6 approved red checkpoint — 2026-07-20

- User/reviewer explicitly approved T046–T048 before test execution.
- Focused unit run: 2 files, 3 expected failures because the canonical example and author guide
  did not yet exist.
- Focused component run: 2 files, 4 expected failures and 17 passes. The action bar did not yet
  expose the example download or documentation link, and the page had no download wiring.

This is the required US4 red checkpoint. T050–T055 may now implement only the behavior covered by
the approved tests.

### Phase 6 green verification — 2026-07-20

- US4 focused core/documentation tests: 2 files, 3 assertions passed.
- US4 focused component tests: 2 files, 21 assertions passed.
- The downloadable `echorecall-batch-v1.yaml` example round-tripped through the real parser with
  two ordered candidates, and the documented equivalent JSON parsed through the same contract.
- `pnpm test`: 59 files, 379 assertions passed.
- `pnpm test:component`: 41 files, 252 assertions passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.

### Phase 7 automated verification — 2026-07-20

- Removed obsolete text-only framing while retaining the documented legacy line-import wrapper.
- Added an exact non-empty English/Hungarian guard for all 45 Feature 008 copy leaves.
- Focused compatibility/localization run: 3 files, 16 assertions passed.
- `pnpm test`: 59 files, 380 assertions passed.
- `pnpm test:component`: 41 files, 252 assertions passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- SC-001 passed in ChatGPT Atlas on the reference desktop using
  `tests/fixtures/batch-import/valid-100.yaml`: the complete walkthrough took 44.792 seconds.
  The preview reported 100 valid and 0 rejected candidates; items 1 and 100 both resolved to
  voice `alloy`, model `gpt-4o-mini-tts`, and format `mp3`; confirmation announced
  `100 imported, 0 rejected`.
- SC-009 passed in ChatGPT Atlas. Five consecutive selection-to-result measurements (milliseconds)
  were: `valid-100.txt` 1573/1563/1564/2095/2140; `valid-100.yaml`
  2034/2083/2021/2062/2113; `valid-100.yml` 2289/1985/1996/1989/2010;
  `valid-100.json` 2037/2024/1591/1574/1569; `blocking-error.yaml`
  1660/1909/1668/1659/1676; and `blocking-error.json` 1658/1656/1652/1656/1672.
  Every preview or actionable blocking error appeared within the required 3000 ms.
- Remaining Atlas scenarios passed: the canonical example preserved order/multiline text and
  resolved `nova`/`alloy` overrides before appending both rows; the mixed fixture showed all three
  candidates and appended exactly 1 valid row while announcing 2 rejections; plain text preserved
  line 1/3 locations, counted one internal blank, and rejected the 4097-character line.
- The 205-item fixture rendered pages of 100/100/5 (`1 / 3` through `3 / 3`), exposed item 205,
  and appended all 205 rows. A row typed while batch work was in progress remained in place when
  the canonical batch appended. Loading `saved-queue.json` separately displayed a replacement
  warning for all 309 current rows and, after confirmation, replaced them with exactly its one
  saved row.
- Blocking-error checks for duplicate YAML keys, YAML custom tags, wrong schema, duplicate JSON
  properties, and trailing-comma JSON all produced localized actionable errors without changing
  the 306-row queue. The focused parser/preview/regression suites cover the remaining anchor,
  alias, multi-document, defaults, extension, and size boundaries and passed 43/43 assertions.
- YAML/JSON equivalence, resolved metadata/null clearing, cancellation, selection preservation,
  accessibility/status behavior, and saved-queue separation remained covered by the focused
  component suites, which passed 36/36 assertions. These default suites use mocked ports and made
  no live TTS, tagger, or other external-network calls; Atlas accessed only `localhost:3102`.
