# Phase 0 Research: Structured Generate Batch Import

**Feature**: 008-batch-import | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

All behavioral clarifications are resolved. This document records implementation decisions and alternatives; no clarification marker remains.

## R1 — Framework-independent import pipeline

**Decision**: Build a cohesive `src/core/batch/` pipeline with serialization adapters (`text`, `yaml`, `json`) feeding one exact-field validator and normalizer. The core accepts raw content, a format, filename, and a snapshot of current Generate values and returns either a typed blocking document error or an ordered preview. Vue/Nuxt code only reads `File`, enforces byte size/extension, stores reactive workflow state, localizes codes, downloads the example, and confirms queue append.

**Rationale**: Parsing, inheritance, null clearing, field validation, and issue classification are domain behavior and must be reusable/testable without Vue. It directly satisfies Constitution Principles III–IV and the spec's shared-validator requirement.

**Alternatives considered**: Put parsing in `generate.vue` or a composable—rejected because it leaks domain behavior into presentation. Add a Nitro upload endpoint—rejected because the workflow is intentionally local and needs no persistence/network. Build generic adapter registration—rejected as YAGNI; only three fixed formats exist.

## R2 — YAML 1.2 parser and safety policy

**Decision**: Add `yaml` `^2.9.0` as a direct runtime dependency and parse with `parseDocument()` using YAML 1.2 core semantics, strict parsing, unique string keys, merge disabled, known-tag resolution disabled, pretty source errors, and error-only logging. Before conversion, inspect the Document AST and reject every alias node, every node carrying an anchor (including unused anchors), and every explicit/custom tag. Reject any parse error, including duplicate keys and multiple documents. Convert only after checks with `doc.toJS({ maxAliasCount: 0, mapAsMap: false })` as defense in depth.

Representative options:

```text
version: '1.2'
schema: 'core'
strict: true
uniqueKeys: true
stringKeys: true
merge: false
resolveKnownTags: false
prettyErrors: true
logLevel: 'error'
```

**Rationale**: The library has no external dependencies, runs in Node and modern browsers, supports YAML 1.2, exposes source-aware Document errors and AST visitors, and documents duplicate/alias controls. `customTags: []` alone is not a tag ban, so explicit AST rejection is required. Rejecting all explicit tags is simpler and safer than maintaining a tag allowlist for a contract that needs only ordinary YAML 1.2 values.

**Alternatives considered**: `js-yaml`—capable, but its public load-first API is less convenient for rejecting unused anchors and inspecting explicit tags before materialization. Bespoke YAML parser—rejected for correctness/security/maintenance. Allow limited aliases—rejected by clarification.

**Primary sources**: [`yaml` documentation](https://eemeli.org/yaml/), [`yaml` content-node/AST documentation](https://github.com/eemeli/yaml/blob/main/docs/05_content_nodes.md), [`js-yaml` safety notes](https://github.com/nodeca/js-yaml/blob/master/docs/safety.md).

## R3 — Strict JSON and duplicate-property detection

**Decision**: Use the `yaml` Document AST parser configured with `schema: 'json'` as a duplicate-property preflight, with strict/unique string keys and no tags/anchors/aliases. This is parser configuration, not JSON Schema validation. Map `DUPLICATE_KEY` to the blocking `duplicateProperty` code. If preflight succeeds, run native `JSON.parse()` and use its result; native parsing is the final authority for strict JSON syntax because the parser's JSON scalar mode does not otherwise restrict YAML's broader syntax.

**Rationale**: Native `JSON.parse` silently keeps a duplicate's last value and cannot report the clarified error. The Document parser compares decoded keys, including escaped-equivalent property names, while a final native parse rejects YAML-only structure. Reusing the selected dependency avoids a second package and avoids a fragile regex/token scanner.

**Alternatives considered**: Microsoft's `jsonc-parser` visitor with per-object `Set`s—good diagnostics, but a second direct dependency and a deliberately fault-tolerant JSONC grammar require extra hardening. Custom tokenizer—unnecessary parser duplication. Last/first wins—rejected by clarification.

**Primary sources**: [RFC 8259 §4](https://www.rfc-editor.org/rfc/rfc8259#section-4), [`jsonc-parser` official repository](https://github.com/microsoft/node-jsonc-parser).

## R4 — Canonical contract, merge, and null semantics

**Decision**: Structured files use exact v1 shapes:

- document: `schema`, `version`, optional `defaults`, `items` only;
- defaults: optional `voiceId`, `model`, `format`, `instructions`, `metadata` only;
- item: required `text` plus the same optional override fields;
- metadata: exact current `Metadata` keys.

Resolve a candidate from a frozen base snapshot, then file defaults, then item overrides. Missing inherits. `instructions: null` removes instructions. `metadata.<field>: null` removes only that field. Metadata objects merge field-by-field; supplied arrays replace, never concatenate. Empty arrays normalize to absent metadata fields, matching current UI removal behavior. `metadata: null`, `text: null`, and null required generation settings are errors. Preserve multiline text internally after trimming its outer whitespace.

**Rationale**: One normalized input model guarantees YAML/JSON equivalence. Field-level metadata merge gives null clearing without erasing unrelated inherited tags. The frozen base matches the spec's file-selection assumption.

**Alternatives considered**: Whole-metadata replacement—would make single-field defaults erase inherited fields. Deep array concatenation—contradicts the spec. Treat null as missing—cannot express clearing.

## R5 — Metadata validation and Feature 007 derived fields

**Decision**: Validate all fields in the authoritative core `Metadata` type structurally in the batch validator:

- textual fields are strings;
- `languages` is an array of nonblank strings;
- `customText` entries have exact nonblank `description` and `value` strings;
- `customUrl` entries have exact nonblank `description` and `url` strings (no new URL-scheme rule);
- `bpm` is a finite non-negative integer;
- `rating` is an integer from 0 through 5;
- unknown metadata and nested entry fields are row/default errors.

The validator does not alter server or Library validation; it defines the strict public batch contract. Imported Title is retained because Feature 007 only derives a title when blank. Imported Track is accepted and previewed but is deliberately re-derived from full queue order and the configured first-track value immediately before generation, as Feature 007 already requires. Documentation calls this out explicitly.

**Rationale**: There is no existing centralized runtime metadata validator; the current Generate/Library controls enforce these structural constraints at interaction boundaries. Reproducing them in the batch boundary prevents unsafe casts while preserving current semantics. Track derivation is an existing user-visible invariant and cannot be silently changed by an import feature.

**Alternatives considered**: Shallow-cast metadata as `Metadata`—rejected under strict TypeScript and typo-rejection requirements. Narrow the contract to visible Generate fields—rejected because the feature says existing domain types and the example uses Title/Track. Preserve imported Track through generation—rejected because it breaks Feature 007 queue ordering/start-track behavior.

## R6 — Blocking errors, row errors, and preview representation

**Decision**: Syntax, size/extension/read failures, schema/version, top-level/default shape, top-level/default unknown fields, duplicate keys/properties, custom tags, anchors, and aliases are blocking. Item and item-metadata shape/value errors produce invalid candidates while valid siblings remain confirmable. Errors are stable typed codes plus path/location/details, never English strings.

Structured source locations use one-based item numbers; text uses original one-based line numbers. Invalid candidates keep best-effort excerpts/display strings but never expose a typed normalized input. Preview counts valid, rejected, and blank text lines. Confirmation requires at least one valid candidate. Render 100 candidates per UI page so all accepted candidates remain inspectable without an unbounded DOM.

**Rationale**: Stable codes keep the core localization-free and make tests exact. A discriminated union prevents invalid input from reaching queue append. Pagination honors the no-candidate-count decision without adding another dependency.

**Alternatives considered**: Throw exceptions for expected validation—harder to localize and test. Drop invalid rows—violates preview requirements. Render all rows—unsafe for accepted large files. Virtualization dependency—unnecessary at the guaranteed 100-row responsiveness target.

## R7 — Plain-text compatibility

**Decision**: Evolve the current pure parser to return line-aware preview candidates instead of immediately appendable valid rows. Preserve CRLF/LF handling, trimming, order, duplicate text, and the convention that a single terminal newline does not create a phantom blank. Preserve the current all-whitespace result (zero candidates and zero blank count), while non-terminal blank lines are counted. Oversized nonblank lines become visible invalid candidates rather than count-only drops. Keep `parseUploadText` as a compatibility export/wrapper during migration if existing callers/tests need it, then route the UI through the unified parser.

**Rationale**: This is the smallest evolution that adds required preview/error locations without regressing shipped edge-case conventions.

**Alternatives considered**: Rewrite text import with structured-document rules—would change blank/trailing-newline behavior. Keep immediate append—violates preview-first flow.

## R8 — Queue append and existing live-setting behavior

**Decision**: Add `appendImported(inputs, filename, options)` to `useQueue`; it accepts normalized snapshots rather than reading live form state. It appends to then-current queue contents, preserves existing row object identity/order/state, deep-clones candidate metadata, and creates fresh `clientId`, `queued` status, `upload` source, and filename with no error/result/selection/active state.

Structured rows set `metadataEdited: true`, so `applyMetadataToPending()` cannot erase imported file defaults/per-item metadata immediately before generation. Plain-text rows retain `metadataEdited: false` and existing form metadata behavior. Later form Voice/Model/Format edits continue to rewrite all pending rows, including imported rows, because Feature 007 defines those controls as explicit apply-to-all settings. Track remains derived; imported Title survives when nonblank.

**Rationale**: The normalized preview must be the data confirmed by the user. A dedicated append API avoids `makeItem()` re-reading changed form values. The metadata flag is the existing mechanism for row-specific metadata, while global generation-setting watchers are an explicit shipped behavior preserved by FR-029.

**Alternatives considered**: Reuse `addFromUpload`/`makeItem`—loses candidate voice/model/format/instructions/metadata. Replace queue—belongs to Load queue. Add field-level provenance state—unnecessary complexity for the current global controls.

## R9 — UI state, accessibility, localization, and documentation

**Decision**: Add `useBatchImport` with `idle → reading/parsing → preview | blocked → imported/cancelled → idle` state. `BatchImportPreviewDialog` uses a modal with labelled paged rows, valid/invalid status, text excerpt, resolved settings, per-row issues, counts, confirm/cancel, focus management, and confirmation disabled at zero valid. A polite live region announces parsing/ready/count/success; blocking failures use alert semantics. The hidden input accepts all four extensions and the action bar is renamed to Import batch.

Ship `public/examples/echorecall-batch-v1.yaml` and `docs/batch-import.md`. Test the example by parsing it through the core; documentation includes exact fields, precedence/null/array rules, validation, Track derivation, and equivalent JSON. Add matching en/hu keys and retain the parity gate.

**Rationale**: A dedicated dialog keeps Generate focused, allows explicit review, and maps directly to the specified status announcements. Versioned static artifacts are easy to download, review, and test for drift.

**Alternatives considered**: Inline editable table—out of scope. Toast-only errors—insufficient for row inspection/accessibility. Generate example dynamically—adds runtime assembly with no benefit over a tested versioned asset.

## R10 — Test and rollout strategy

**Decision**: Implement red-first in story order: core contract/YAML/preview (P1), mixed validity + queue append (P1), JSON/text parity (P2), then example/docs/i18n/a11y (P2). Unit tests cover parser safety and normalization; component tests cover dialog/action/page flows; regression tests prove Load queue still replaces while Import batch only appends. Run `pnpm test`, `pnpm test:component`, `pnpm typecheck`, and `pnpm lint`; no adapter/WASM suite is required because audio tagging is untouched.

**Rationale**: Each story yields an independently testable slice and follows the constitution's mandatory Red–Green–Refactor cycle.

**Alternatives considered**: UI-first parsing mocks—would delay the highest-risk safety rules and duplicate implementations. Broad end-to-end-only coverage—poor diagnostics for parser edge cases.

## R11 — Technology governance

**Decision**: Constitution v2.6.0 approves direct `yaml` use in the framework-independent shared core for strict YAML 1.2 parsing, source-aware validation, and JSON duplicate-property preflight. Declare it directly during implementation; do not rely on its current transitive presence in the lockfile.

**Rationale**: The approved entry makes supply-chain and architectural intent reviewable and requires the exact untrusted-input protections selected in R2–R3. A transitive dependency is not an application contract and may disappear.

**Alternatives considered**: Rely on transitive `yaml`—fragile and contradicts the feature's direct-dependency requirement. Bespoke parser—greater risk and complexity. Broader tag/alias support—outside the approved policy and unnecessary for the canonical contract.
