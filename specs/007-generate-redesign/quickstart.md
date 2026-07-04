# Quickstart / Validation Guide: Generate Tab Redesign

**Feature**: 007-generate-redesign · **Date**: 2026-07-04 · Companion to [plan.md](./plan.md),
[spec.md](./spec.md). A run + validation guide proving the feature end-to-end. Implementation code lives
in `tasks.md` / the implementation phase, not here.

## Prerequisites

- Node **22.22.2** (pinned via mise). Prefix native/test commands with `mise exec node@22.22.2 --` (the
  bash shell defaults to a newer Node than the pin).
- Dependencies installed (`pnpm install`). No new runtime dependency is added by this feature.
- An OpenAI key set (env `OPENAI_API_KEY` or Settings) is only needed for *live* generation; automated
  tests mock `$fetch` and never call the network.

## Commands

```bash
# Unit + node tests (core: generation-defaults, pricing; composable logic)
mise exec node@22.22.2 -- pnpm test

# Component/integration tests (Nuxt + happy-dom)
mise exec node@22.22.2 -- pnpm test:component

# Strict type check (respect the ~-alias / composable-type-import gotchas)
mise exec node@22.22.2 -- pnpm typecheck

# Lint
mise exec node@22.22.2 -- pnpm lint

# Run the app; the redesigned page is at /generate-next until cutover
mise exec node@22.22.2 -- pnpm dev   # then open http://localhost:3000/generate-next
```

## Red-first order (Principle II)

Write failing tests before implementation, per story: **core first** (`generation-defaults`, `pricing`),
then the **editor** (US1), the **embed** (US2), **defaults persistence** (US3), the **progress modal +
cancel** (US4), **cost** (US5), **recording-date** (US6). Confirm red, implement to green, refactor.

## Validation scenarios (map to spec User Stories / SCs)

### US1 — Three-column editor + action bar (P1) · SC-001
1. Open `/generate-next`: page intro, Script / Generation settings / Metadata columns, and the action
   bar all render on one scrolling page (`generate-next`, `script-panel`, `voice`/`model`/`format`/
   `speed`, `action-bar`).
2. Type a script → `script-charcount` reflects length; **Add to queue** (`add-text-submit`) adds a row,
   `queue-count-badge` increments; **Clear** (`script-clear`) empties the textarea, queue unchanged.
3. **Save queue** / **Load queue** (`action-save-queue`/`action-load-queue`) round-trip a queue file;
   **Upload .txt batch** (`action-upload-txt` → `queue-file-input`) appends parsed rows.
   *Expected*: build-and-generate happens on one page, no tab/page change (SC-001).

### US2 — Embedded Library workspace, no player (P1) · SC-006
1. Below the editor the 006 workspace renders (filter bar, file table, Tag Editor inspector, status bar)
   and lists existing recordings; **no waveform player** is present.
2. Filter/sort/multi-select, edit a tag in the inspector + Save, and bulk-delete — each behaves as on the
   Library tab (same `useLibrary` data). Open the Library tab: the same edit is reflected there.
3. Generate an item (below) → it appears in the embedded file table (FR-010).
   *Expected*: identical filter/sort/edit/delete outcomes on both surfaces; no divergence (SC-006).

### US3 — Persisted generation settings (P2) · SC-002
1. In Settings, set a default Voice/Model/Format/Speed (`gen-default-*`, `gen-default-save`).
2. Reload `/generate-next` with no prior use → the four controls show the configured defaults.
3. Change a control, generate, revisit later (new session) → the control shows the **last-selected**
   value (precedence over the configured default).
4. Activate a field's reset (`gen-reset-<field>`) → it returns to the configured default.
   *Expected*: last-selected → configured default → fallback resolution; restore ≥95% (SC-002).

### US4 — Progress modal + confirm-then-stop cancel (P2) · SC-003
1. Queue several items, **Generate** → `progress-modal` opens showing `progress-current` + succeeded/
   failed tally; the rest of the page is disabled.
2. Force one item to fail (mock) → it is recorded failed and the run continues (not fatal).
3. Close the modal mid-run → `progress-cancel-confirm` appears; **confirm** → the in-flight file finishes,
   the run stops before the next item; **decline** → the run continues.
4. On end, `progress-summary` shows succeeded / failed / not-generated counts; already-generated files
   remain (visible in the embedded table).
   *Expected*: no already-generated file lost; every remaining item reported not-generated (SC-003).

### US5 — Per-item cost + queue total (P3) · SC-004
1. Queue items on `tts-1`/`tts-1-hd` → each shows a per-item estimate (`queue-row-cost`); `queue-total-cost`
   equals their sum.
2. Queue an item on `gpt-4o-mini-tts` → its cost reads **"unavailable"**; it is excluded from the total,
   and `queue-unavailable-note` shows "+ N items unavailable".
3. Generate is never blocked by the estimate.
   *Expected*: real per-item + total for estimable models, honest "unavailable", no fabricated $0 (SC-004).

### US6 — Recording date defaults to today (P3) · SC-005
1. Add an item leaving the recording date blank → generate → its stored `recordedAt` equals the
   **generation day** (date-only), not tomorrow.
2. Add an item with an explicit recording date → generate → that date is preserved.
   *Expected*: blank → generation day; user-set never overwritten (SC-005); 005 clobber resolved.

### Cross-cutting — i18n / a11y (SC-007) & accent (SC-010)
- Switch locale en↔hu: every new label is translated (no raw keys). Tab through all new controls and the
  progress-modal confirm — each is keyboard-operable and AT-labelled. The surface shows the `indigo`
  accent and no green; the Figma Account/credits area is absent.

## Cutover (final, separate step) · SC-009
- Repoint the Generate nav to the new surface; move `generate-next.vue` into `index.vue`; delete the
  superseded 005 Generate components. Verify `/` renders the redesigned page, existing links resolve, and
  the full suite (`pnpm test`, `pnpm test:component`, `pnpm typecheck`) is green.
