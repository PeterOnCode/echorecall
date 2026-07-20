# Implementation Plan: Structured Generate Batch Import

**Branch**: `008-batch-import` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-batch-import/spec.md`

## Summary

Replace the Generate page's immediate `.txt` upload with a local, preview-first **Import batch** workflow for `.txt`, `.yaml`, `.yml`, and `.json`. A new framework-independent batch module parses each serialization, validates one canonical `echorecall.batch` v1 contract, resolves current Generate values → file defaults → item overrides, and returns typed blocking errors or ordered valid/invalid preview candidates. The browser adapter enforces the 5 MiB limit, snapshots current Generate values, manages preview state, and appends only confirmed valid candidates through a queue API that mints fresh transient state and preserves existing rows.

Use one new direct runtime dependency, `yaml` `^2.9.0`, for strict YAML 1.2 parsing and AST inspection. Its Document AST parser, configured in `schema: 'json'` mode, performs duplicate-property preflight before native `JSON.parse` enforces strict JSON grammar, avoiding a second dependency. YAML duplicate keys, custom/explicit tags, anchors, and aliases and JSON duplicate properties are blocking errors. No server request, persistence, database migration, or external service is introduced.

The plan preserves Feature 007 behavior: later form-level Voice/Model/Format changes remain explicit apply-to-all operations, imported Title survives derivation, and Track is always re-derived from queue order/start-track at generation time. Structured imported metadata is marked as row-specific so the pre-generation form metadata projection cannot erase file defaults or per-item overrides. Plain-text rows retain their existing live form-metadata behavior.

## Technical Context

**Language/Version**: Strict TypeScript 6 on Node.js 22.22.2 (project pin); Vue SFCs use `<script setup lang="ts">`.

**Primary Dependencies**: Existing Nuxt 4.4 / Vue 3.5 / Nitro / Vite, `@nuxt/ui` 4.8, `@nuxtjs/i18n` 10.4; **new direct runtime dependency** `yaml` `^2.9.0` for browser-safe YAML 1.2 parsing and AST checks. Native `JSON.parse` remains the final JSON grammar authority.

**Storage**: N/A. Selected files, parse results, and previews are browser/session memory only. Confirmed candidates enter the existing ephemeral queue; no SQLite, filesystem, localStorage, or server schema change.

**Testing**: Vitest 4 unit/integration tests plus `@nuxt/test-utils` with happy-dom for components. All new behavior is written red-first; default suites make no live network calls. Existing i18n parity tests enforce English/Hungarian key parity.

**Target Platform**: Modern evergreen browsers served by the Dockerized Nuxt/Nitro application. File parsing occurs client-side; pure parser/validator code also runs in Node unit tests.

**Project Type**: Nuxt full-stack web application over a framework-independent TypeScript core; this feature is a browser UI adapter over a reusable core import capability.

**Performance Goals**: On the specification's reference desktop profile, every defined acceptance fixture of at most 100 candidates reaches preview or an actionable error within 3 seconds in each of five consecutive runs. The timed 100-item YAML walkthrough—from activating **Import batch**, through checking totals and the resolved settings for items 1 and 100, to the success announcement—completes in under 2 minutes. The preview renders at most 100 rows per page so accepted larger files do not create an unbounded DOM.

**Constraints**: Maximum file size 5 MiB; no separate candidate-count limit; item text 1–4,096 trimmed characters; exact contract fields; YAML 1.2 only; reject duplicate YAML keys, custom/explicit tags, anchors, aliases, and duplicate JSON properties; no `any`; all domain parsing/merge/validation stays outside Vue/Nuxt; English/Hungarian parity; keyboard/AT-accessible dialog and status announcements; saved-queue load remains a separate replacement flow.

**Scale/Scope**: One new core batch module family, one client composable, one preview dialog, Generate action/input rewiring, one downloadable example, one user document, locale additions, and focused unit/component/regression tests. No server routes or persistence changes.

## Constitution Check

*GATE: Evaluated before Phase 0 and re-checked after Phase 1 design.*

Against EchoRecall Constitution **v2.6.0**:

| Principle | Pre-research | Post-design | Evidence |
|-----------|--------------|-------------|----------|
| I. TypeScript-First | PASS | PASS | All raw input enters as `unknown`; discriminated result/error unions and full public signatures avoid `any`. |
| II. Test-First | PASS | PASS | Core parser/merge/validation, queue append, dialog/page behavior, a11y, localization, and regressions are explicitly red-first with no live network. |
| III. Modular Architecture | PASS | PASS | Serialization adapters and the shared validator live under `src/core/batch/`; Vue code only handles files, reactive state, downloads, and queue confirmation. |
| IV. Shared Core, Multiple Interfaces | PASS | PASS | Parsing, normalization, validation, and preview contracts are programmatic core exports. The web adapter is thin. CLI exposure is explicitly out of scope, not technically prevented. |
| V. Simplicity & YAGNI | PASS | PASS | One mature zero-transitive-dependency parser replaces bespoke YAML/JSON tokenizers; no generic mapping engine, XML adapter, server path, persistence, or virtualization dependency is added. |

**Technology Stack governance gate — PASS.** Constitution v2.6.0 approves `yaml` as a direct
dependency in the framework-independent shared core for strict YAML 1.2 parsing, source-aware
validation, and JSON duplicate-property preflight. The planned use is within that scope and applies
the constitution's required duplicate-key/property checks and custom-tag/anchor/alias rejection.
No further amendment or Complexity-Tracking exception is required.

**Constitution HTTP-mocking follow-up**: unaffected because import is entirely local and makes no HTTP request.

## Project Structure

### Documentation (this feature)

```text
specs/008-batch-import/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── batch-file-contract.md
│   ├── import-preview-contract.md
│   └── queue-append-contract.md
├── checklists/
│   └── requirements.md
├── spec.md
└── tasks.md                         # created later by /speckit-tasks
```

### Source Code (repository root)

```text
src/core/
├── batch/
│   ├── contract.ts                  # NEW: raw v1 shapes, normalized inputs, issue/result types
│   ├── parse-batch.ts               # NEW: format dispatch + shared orchestration
│   ├── parse-text.ts                # NEW: line-preserving text candidates; supersedes parse-upload
│   ├── parse-yaml.ts                # NEW: strict YAML 1.2 Document parse + AST safety checks
│   ├── parse-json.ts                # NEW: YAML Document AST duplicate-property preflight in schema: 'json' mode + native JSON.parse
│   └── validate-batch.ts            # NEW: exact fields, defaults/items, merge/null/array semantics
├── client.ts                        # ADAPT: export batch-import types/functions and size constant
└── tts/provider.ts                  # ADAPT: comment/ownership of MAX_UPLOAD_BYTES only if moved

app/
├── pages/
│   └── generate.vue                 # ADAPT: unified input, snapshot base, preview/confirm wiring
├── components/generate/
│   ├── GenerationActionBar.vue      # ADAPT: Upload .txt → Import batch event/copy/test id
│   └── BatchImportPreviewDialog.vue # NEW: paged read-only candidates, errors, counts, confirm/cancel
├── composables/
│   ├── useBatchImport.ts            # NEW: file/size/extension/read/preview/download UI adapter
│   └── useQueue.ts                   # ADAPT: append normalized confirmed candidates atomically

public/examples/
└── echorecall-batch-v1.yaml          # NEW: canonical importable YAML example

docs/
└── batch-import.md                   # NEW: human contract guide + equivalent JSON example

i18n/locales/
├── en.json                            # ADD Import batch, preview, issue, status, download copy
└── hu.json                            # ADD matching Hungarian keys

tests/
├── unit/
│   ├── batch-yaml.test.ts             # NEW: YAML safety, contract, inheritance, normalization
│   ├── batch-preview.test.ts          # NEW: mixed validity, issue scope, counts, paging invariants
│   ├── batch-json.test.ts             # NEW: strict JSON, duplicate properties, YAML equivalence
│   ├── parse-upload.test.ts           # ADAPT: line-aware plain-text compatibility
│   ├── batch-example.test.ts          # NEW: downloadable YAML example round-trip
│   ├── batch-documentation.test.ts    # NEW: author-guide contract coverage
│   └── i18n.generate-next.test.ts     # ADAPT: English/Hungarian batch-copy parity
├── component/
│   ├── BatchImportPreviewDialog.test.ts # NEW: rows, paging, counts, errors, a11y, actions
│   ├── GenerationActionBar.test.ts    # ADAPT: renamed action/event/test id
│   ├── QueueState.test.ts             # ADAPT: append mapping/fresh state/existing-row preservation
│   └── generate-next.batch-import.test.ts # NEW: every extension, limit, cancel/confirm, example
└── integration/
    └── batch-import-regression.test.ts # NEW: saved-queue replacement remains separate/unchanged
```

**Structure Decision**: Keep every parse, safety, exact-field, merge, normalization, and error-code rule in a cohesive framework-independent `src/core/batch/` module. `useBatchImport` translates a browser `File` into core calls and UI state; `generate.vue` supplies the current form snapshot and delegates confirmed append to `useQueue`. No Nitro route is involved. The public example and user documentation are versioned assets verified against the same core contract.

## Complexity Tracking

| Item | Why Needed | Simpler Alternative Rejected Because |
|------|------------|--------------------------------------|
| Direct constitution-approved `yaml` dependency | Correct YAML 1.2 scalar semantics, source-aware errors, duplicate-key detection, and AST inspection for custom tags/anchors/aliases | A bespoke parser/token scanner is larger, security-sensitive, and conflicts with Simplicity; `JSON.parse` cannot parse YAML. `js-yaml` exposes less convenient documented AST control for unused anchors/custom tags. |
| JSON duplicate-property preflight through the `yaml` Document AST parser configured with `schema: 'json'`, before native `JSON.parse` | Native `JSON.parse` silently overwrites earlier duplicate properties, violating the clarified blocking-error contract | A second JSON parser adds dependency/governance surface; regex cannot correctly handle escaped keys/nesting; a custom tokenizer duplicates mature parser work. |
| Paged preview (100 rows/page) | No candidate-count cap exists, but every candidate must remain inspectable without unbounded DOM rendering | Rendering every candidate at once risks freezing the page; a virtualization library adds unnecessary dependency and complexity. |

## Phase 0: Research Outcome

All technical unknowns are resolved in [research.md](./research.md). The chosen parser API, JSON duplicate strategy, merge semantics, metadata contract, queue interaction, preview state, documentation delivery, and test boundaries have no unresolved clarification markers. Constitution v2.6.0 approves the selected dependency and no planning gate remains.

## Phase 1: Design Outcome

- [data-model.md](./data-model.md) defines raw and normalized entities, issue codes, preview lifecycle, validation, and queue transitions.
- [batch-file-contract.md](./contracts/batch-file-contract.md) is the canonical author-facing v1 YAML/JSON contract.
- [import-preview-contract.md](./contracts/import-preview-contract.md) defines core parse results, blocking versus row errors, counts, and UI state.
- [queue-append-contract.md](./contracts/queue-append-contract.md) fixes confirmation mapping, fresh transient state, concurrent append behavior, and Feature 007 interactions.
- [quickstart.md](./quickstart.md) provides runnable red-first and end-to-end validation scenarios.

Post-design constitution re-check: Principles I–V pass; no persistence/server/network scope appeared. The direct `yaml` dependency and its strict untrusted-input policy are approved by constitution v2.6.0. The feature is ready for task generation.
