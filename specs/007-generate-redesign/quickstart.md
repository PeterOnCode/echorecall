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

# Run the app; Nuxt is configured on port 3102
mise exec node@22.22.2 -- pnpm dev   # then open http://localhost:3102/generate
```

## Red-first order (Principle II)

Write failing tests before implementation, per story: **core first** (`generation-defaults`, `pricing`),
then the **editor** (US1), **defaults persistence** (US3), the **progress modal +
cancel** (US4), **cost** (US5), **recording-date** (US6). Confirm red, implement to green, refactor.

## Validation scenarios (map to spec User Stories / SCs)

### US1 — Responsive editor + action bar (P1) · SC-001
1. Open `/generate`: page intro, Script and Generation settings columns, a full-width Metadata row,
   and the action bar render on one scrolling page (`generate-next`, `script-panel`,
   `voice`/`model`/`format`, `action-bar`). `/` redirects to the same surface.
2. Type a script → `script-charcount` reflects length; **Add to queue** (`add-text-submit`) adds a row,
   `queue-count-badge` increments; **Clear** (`script-clear`) empties the textarea, queue unchanged.
3. **Save queue** / **Load queue** (`action-save-queue`/`action-load-queue`) round-trip a queue file;
   **Upload .txt batch** (`action-upload-txt` → `queue-file-input`) appends parsed rows.
   *Expected*: build-and-generate happens on one page, no tab/page change (SC-001).

### Queue interactions and Library separation (P1) · SC-006/SC-011
1. Add several rows, select individual rows or all rows, bulk-delete, clear, and drag to reorder.
2. Set the first Track number and generate; derived Track values follow the reordered queue.
3. Populate 100 rows and confirm rendering, selection, removal, reorder, cost updates, and progress
   remain responsive. Generate contains no Library workspace or waveform; `/library` remains separate.

### US3 — Persisted generation settings (P2) · SC-002
1. In Settings, set default Voice/Model/Format values (`gen-default-*`, `gen-default-save`).
2. Reload `/generate` with no prior use → the three controls show the configured defaults.
3. Change a control, generate, revisit later (new session) → the control shows the **last-selected**
   value (precedence over the configured default).
4. Activate a field's reset (`gen-reset-<field>`) → it returns to the configured default.
   *Expected*: last-selected → configured default → fallback resolution; restore ≥95% (SC-002).

### US4 — Progress modal + confirm-then-stop cancel (P2) · SC-003
1. Queue several items, **Generate** → `progress-modal` opens showing `progress-current` + succeeded/
   failed tally; the rest of the page is disabled.
2. Force one item to fail (mock) → its label and error appear in `progress-failed-items`, and the run
   continues (not fatal).
3. Close the modal mid-run → `progress-cancel-confirm` appears; **confirm** → the in-flight file finishes,
   the run stops before the next item; **decline** → the run continues.
4. On end, `progress-summary` shows succeeded / failed / not-generated counts; successful recordings
   are available from `/library`.
   *Expected*: no already-generated file lost; every remaining item reported not-generated (SC-003).

### US5 — Per-item cost + queue total (P3) · SC-004
1. Queue items on `tts-1`/`tts-1-hd` → each shows a per-item estimate (`queue-row-cost`); `queue-total-cost`
   equals their sum.
2. Queue an item on `gpt-4o-mini-tts` → it shows an explicitly approximate duration/text-token
   estimate and participates in the total. An unknown model remains "unavailable" and excluded.
3. Generate is never blocked by the estimate.
   *Expected*: real per-item + total for estimable models, honest "unavailable", no fabricated $0 (SC-004).

### US6 — Recording date defaults to today (P3) · SC-005
1. Add an item leaving the recording date blank → generate → its stored `recordedAt` equals the
   **generation day** (date-only), not tomorrow.
2. Add an item with an explicit recording date → generate → that date is preserved.
3. Force a blank-dated item to fail, advance the date, retry successfully → the failed row stayed
   blank and the saved recording receives the later successful day.
   *Expected*: blank → successful generation day; user-set never overwritten (SC-005).

### Cross-cutting — i18n / a11y (SC-007) & accent (SC-010)
- Switch locale en↔hu: every new label is translated (no raw keys). Tab through all new controls and the
  progress-modal confirm — each is keyboard-operable and AT-labelled. The surface shows the `indigo`
  accent and no green; the Figma Account/credits area is absent.

## Cutover verification · SC-009
- Verify navigation targets `/generate`, `/` redirects there, the superseded 005 Generate components
  are absent, and the full suite (`pnpm test`, `pnpm test:component`, `pnpm typecheck`, `pnpm lint`) is green.
