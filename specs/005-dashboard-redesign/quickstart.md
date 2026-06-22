# Quickstart & Validation Guide: Dashboard Workspace Redesign

A run/validation guide proving the feature works end-to-end. Implementation details live in
`tasks.md` (Phase 2) and the source; contracts/entities are in
[contracts/ui-contracts.md](./contracts/ui-contracts.md) and [data-model.md](./data-model.md).

## Prerequisites

- Node **22.22.2** via mise (the bash shell may default to a newer Node — run native/test
  commands through `mise exec node@22.22.2 --`).
- Dependencies installed: `pnpm install`. **US6 only** also requires `wavesurfer.js` — pending the
  constitution Technology-Stack amendment (see plan Constitution Check). US1–US5 need no new dep.

## Setup / run

```bash
mise exec node@22.22.2 -- pnpm install
mise exec node@22.22.2 -- pnpm dev          # app on http://localhost:3000
```

Test commands:

```bash
mise exec node@22.22.2 -- pnpm test          # Vitest (unit + component + integration)
mise exec node@22.22.2 -- pnpm test:nuxt      # @nuxt/test-utils component specs (happy-dom)
mise exec node@22.22.2 -- pnpm typecheck      # nuxt typecheck (respect ~ / relative-type gotchas)
mise exec node@22.22.2 -- pnpm lint
```

> Red-first (Principle II): the affected/new specs below are written to **fail** first, then
> implemented to green. Do not implement a behavior before its failing test exists.

---

## Scenario validation (by user story)

### US1 — Side-by-side generation workspace (P1)
1. Open Generate. **Expect**: a two-pane workspace — queue list (left), metadata editor (right);
   a resize divider between them.
2. Add ≥2 items; click one row. **Expect**: its metadata loads in the right pane; edits apply to
   that row only.
3. Drag the divider; reload the page. **Expect**: the split position is restored (FR-002).
4. With nothing selected. **Expect**: the detail pane shows an empty/placeholder state (FR-003).
5. Add a new item and open its metadata. **Expect**: recording date pre-filled with **tomorrow**,
   changeable via the calendar picker (FR-008).
- **Automated**: `DashboardWorkspace`, `QueueList`, `MetadataFields` specs (`dashboard-*`,
  `queue-row`, `meta-recordedAt-*`).

### US2 — Centralized action toolbar (P1)
1. **Expect**: toolbar shows upload, prev, next, generate, save queue, open queue, open settings
   (`toolbar-*`).
2. Select an item, click next/prev. **Expect**: active selection moves; detail pane follows; prev
   disabled on first, next disabled on last (FR-005).
3. Check 2 of 4 items, click generate. **Expect**: only the 2 checked generate; with none checked,
   generate processes all (FR-005a).
4. After a successful generate. **Expect**: generated items **leave** the queue; a failed item
   stays (FR-005b). Save queue → a `.echoqueue.json` downloads; Open queue → re-imports it.
- **Automated**: `GenerateToolbar` spec; `useGeneration` remove-on-success; `useQueueFile`
  round-trip + malformed-import rejection.

### US3 — Queue list curation (P2)
1. Type in search. **Expect**: list narrows by filename and item text (FR-009).
2. Apply voice/format/album/recording-date/language filters; clear them. **Expect**: list narrows
   per field and restores (FR-010).
3. Check several rows → delete. **Expect**: a confirmation, then all checked removed; selection
   clears (FR-011).
4. **Expect**: source column shows the filename for uploads, "Text Entered" for ad-hoc rows
   (FR-006).
5. Open the columns dialog, hide a column; reload. **Expect**: column hidden and the choice
   persists; the last visible column cannot be hidden (FR-012).
- **Automated**: `QueueList` + `QueueColumnsDialog` specs; `useViewPreferences` unit.

### US4 — Add an ad-hoc text item (P2)
1. Enter text in the add panel → add. **Expect**: a new row with that text and "Text Entered"
   source. 2. Add with empty text. **Expect**: rejected (FR-007).
- **Automated**: `AddTextPanel` spec (`add-text-*`).

### US5 — Library workspace parity (P2)
1. Open Library. **Expect**: two-pane workspace — results table (left), audio-tags panel (right);
   resize divider. 2. Select a row. **Expect**: its tags load in the panel (FR-014). 3. Use the
   panel prev/next. **Expect**: active recording changes and tags update without returning to the
   table (FR-015).
- **Automated**: `LibraryTable` (list-pane), `AudioTagsPanel` specs.

### US6 — Waveform review player (P3, behind amendment gate)
1. Select a recording. **Expect**: a waveform renders and plays. 2. Zoom in/out. **Expect**: the
   waveform scales. 3. Mark a region. **Expect**: a visible loop region; playback can loop it
   (FR-016, loop-only). 4. A missing-audio item. **Expect**: an unavailable state, no crash.
- **Automated**: `WaveformPlayer` spec with **mocked** `wavesurfer.js` (assert wiring:
  load/zoom/add-region; `waveform-unavailable` on error).
- **Gate**: do not start until the constitution amendment (or accepted Complexity-Tracking
  deviation) is in place.

### US7 — Settings in a modal (P3)
1. Click open settings in the toolbar. **Expect**: settings appear in a modal over the current
   surface; the standalone Settings tab/page is gone (FR-017). 2. Change + save + close. **Expect**:
   changes persist; focus returns to the trigger.
- **Automated**: `SettingsModal` spec; `layouts/default.vue` tab-list (Generate, Library only);
  removal of `pages/settings.vue` reflected in routing tests.

---

## Cross-cutting gates (every story)

- **i18n (FR-019)**: every new visible string resolves in **both** en and hu; an automated test
  asserts key parity for the new namespaces (no hardcoded strings).
- **Accessibility (FR-020/SC-009)**: toolbar actions, resize handle, row selection, column dialog,
  settings modal, audio-tags nav, and waveform controls are keyboard-operable and exposed to AT —
  asserted by automated tests (focus order, roles/labels, Escape/focus-return on modals).
- **No regression (SC-008)**: generation and tagging produce identical results to pre-redesign for
  the same inputs (existing core/integration tests stay green; no `src/core/`/server/schema diff).

## Done = green

All affected specs rewritten red-first now pass; new specs pass; `typecheck`, `lint`, and the full
Vitest suite are green; manual scenarios above behave as described. US6 remains gated until the
waveform dependency is constitution-approved.
