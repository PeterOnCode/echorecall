# Phase 0 Research: Nuxt UI Component Migration

All decisions below are grounded in the installed versions (`@nuxt/ui@4.8.2`, Tailwind v4,
Vitest 4 + `@nuxt/test-utils` over happy-dom) and verified against the current codebase and
`node_modules`. This is a presentation-only migration; no `src/core/` or `server/` research
applies.

---

## D1 — Form-control mapping (inputs, selects, textareas, labels)

**Decision**: Map each raw control to its design-system equivalent, wrapping field groups in
`UFormField` (label + hint + error slot):

| Current raw element | Target component | Notes |
|---|---|---|
| `<label><span/>…</label>` group | `UFormField` (`label`, `help`, `error`) | Replaces the hand-built `flex flex-col gap-1 text-sm` label pattern. |
| `<input type="text/search/url">` | `UInput` | `type` preserved; `placeholder` via prop. |
| `<input type="number">` (speed) | `UInputNumber` | Preserve `min=0.25 max=4 step=0.05`, `v-model.number`. |
| `<select>` + `<option>` | `USelectMenu` (or `USelect`) | Build `items` from existing `VOICES`/`MODELS`/`FORMATS`; preserve empty "All…" option as a nullable item. |
| `<textarea>` | `UTextarea` | Preserve `rows`, `placeholder`, and keydown handlers (`@keydown.ctrl.enter`, `@blur`). |
| disabled state `:disabled="loading||saving"` | `:disabled` prop | Unchanged binding. |

**Rationale**: One-to-one swaps preserve `v-model`, emitted events, and behavior while
adopting design-system theming/focus rings and dark-mode adaptation automatically.

**Alternatives considered**: `USelect` vs `USelectMenu` — `USelectMenu` is preferred for
searchable/typeahead parity and consistent theming, but `USelect` is acceptable where the
list is tiny (formats); either is fine and chosen per-field at implementation. Rejected:
keeping native controls with Tailwind classes (defeats the migration's consistency goal).

---

## D2 — Library results table → `UTable` (FR-010)

**Decision**: Rebuild `LibraryTable.vue` on `UTable`, but keep **sort driven by the existing
`query` model** (server-side `sort`/`order`) and reproduce the two inline expansions via the
`#expanded` slot keyed off a per-row mode:

- Columns: name (with text sub-line + unavailable indicator), voice, format, created, actions
  — rendered through `UTable` column `#<id>-cell` slots so existing cell markup/badges and
  `data-test` hooks survive.
- Sorting: sortable headers render a `UButton` (ghost) in the column `#<id>-header` slot that
  calls the existing `toggleSort(column)`; keep `data-test="sort-title|voice|format|createdAt"`
  and the ▲/▼ indicator. Do **not** hand sorting to TanStack's client sort — the list is
  server-sorted/paginated, so client sort would be wrong.
- Expansion: replace the current "extra `<tr>`" approach with a single `#expanded` region per
  row, driven by a per-row `mode: 'none' | 'player' | 'editor'`. Replay toggles `player`
  (renders `AudioPlayer`), edit toggles `editor` (renders `LibraryItemEditor`). This preserves
  "replay opens a player area / edit opens an editor area," including mutual independence per
  row, within `UTable`'s single-expansion-region model.

**Rationale**: `UTable` (TanStack-based in v4) supports per-row expansion and header/cell
slots, so the custom layout is reproducible without inventing abstractions, while keeping the
authoritative server-driven sort/pagination already in `useLibrary`/`LibraryQuery`.

**Alternatives considered**: (a) Keep semantic `<table>` and only restyle — rejected per the
clarification (adopt the data table). (b) Use `UTable` client-side sorting — rejected: breaks
server pagination/sort correctness. (c) Two separate expansion regions — not supported;
folded into one `#expanded` region with a mode flag.

**Pagination**: the current prev/next are already `UButton`; optionally adopt `UPagination`
for full design-system consistency while preserving `data-test="page-prev|page-next|page-status"`
semantics (decided at implementation; `UButton` retention is acceptable).

---

## D3 — Date-range filters → `UPopover` + `UCalendar` (range) (FR-011)

**Decision**: Replace the two `<input type="date">` controls in `LibrarySearchBar.vue` (and
the pair in `BulkCleanDialog.vue`) with a design-system date picker: a `UButton` trigger in a
`UPopover` containing a `UCalendar` in `range` mode. Map calendar selections to the **existing
inclusive local-day ISO bounds** using `@internationalized/date`:

- `from` → `new Date(`${yyyy-mm-dd}T00:00:00`).toISOString()`
- `to` → `new Date(`${yyyy-mm-dd}T23:59:59.999`).toISOString()`

…i.e. the identical mapping the components already implement, so the produced `LibraryQuery`
`from`/`to` (and `BulkCleanFilter`) values are unchanged and page resets to 1 on change. The
two date inputs collapse into **one range control** per surface, so the former
`filter-from`/`filter-to` and `bulk-from`/`bulk-to` hook pairs become a single
`data-test="filter-range"`/`"bulk-range"` on the picker trigger (consuming tests updated in
the same change, FR-006).

**Dependency**: import `CalendarDate`, `getLocalTimeZone`, `parseDate` from
`@internationalized/date`. This package is **already in the tree** as `@nuxt/ui@4.8.2`'s own
dependency (`3.12.2`) but is not reliably top-level-importable under pnpm; it is therefore
**added as a direct dependency** pinned `^3.12.2` (see plan Complexity Tracking).

**Rationale**: This is the clarified, intentional UX change (calendar popover). Reusing the
existing bound-mapping keeps filter outcomes identical and avoids any change to query/server
behavior. `@internationalized/date` is the picker's native date model, giving fully-typed
conversion (no `any`).

**Alternatives considered**: Keep native date inputs as an FR-009 exception — rejected by the
clarification. A third-party date library — rejected (the picker already ships its date model).

---

## D4 — Bespoke modals → `UModal` (FR-003, FR-004, FR-008)

**Decision**: Replace `ConfirmDialog.vue` and `BulkCleanDialog.vue`'s hand-built
`<div class="backdrop"><div class="dialog">` with `UModal` (`v-model:open` bound to the
existing `open` prop; `#content`/`#body`/`#footer` slots). Delete the scoped `<style>` blocks
(including `background:#fff` / `var(--ui-bg,#fff)`), the manual focus-trap (`onKeydown`, the
`FOCUSABLE` query, focus-restore `watch`), and the `@keydown.esc`/`tabindex="-1"` handling —
`UModal` provides focus trapping, Escape-to-dismiss, backdrop click, and focus return.

- `ConfirmDialog`: keep props (`title`, `message`, `confirmLabel`, `cancelLabel`) and emits
  (`confirm`, `cancel`); footer = `UButton` cancel (neutral) + `UButton` confirm (error).
- `BulkCleanDialog`: same modal shell; body = `USelectMenu` (voice) + date picker (D3); confirm
  stays disabled until `hasFilter`; re-seed filter state on open via the existing `watch`.

**Rationale**: This is the concrete fix for the dark-mode defect (hardcoded white panel) and
removes duplicated bespoke accessibility code that `UModal` already implements correctly — a
net simplification (Principle V) that satisfies FR-003/FR-004/FR-008 at once.

**Alternatives considered**: Keep bespoke modals and only fix colors — rejected: leaves
duplicated focus logic and diverges from the design system. `UDialog`/overlay programmatic
API (`useOverlay`) — heavier than needed for these prop-controlled dialogs; `UModal` with
`v-model:open` matches the current controlled pattern.

---

## D5 — Repeatable/multi-value fields in `MetadataFields` (languages, customText, customUrl)

**Decision**: Keep the existing **input + Add button + chips/list** structure, swapping only
the primitives: `<input>`→`UInput`, the language chip `<span>`→`UBadge` (with a trailing
`UButton` ×), and the add/remove `<button>`→`UButton`. Preserve every `data-test`
(`meta-language-input/add/chip/remove`, `meta-text-*`, `meta-url-*`) and the
`@keydown.enter.prevent` add behavior.

**Rationale**: Preserves the explicit "Add" affordance, the per-row remove, validation
(non-empty description+value), and all test hooks — i.e. zero behavior change beyond styling.

**Alternatives considered**: `UInputTags` for languages — rejected: it folds add/remove into a
single control, removing the explicit Add button and the discrete `data-test` hooks the suite
asserts, i.e. a behavior/UX change not authorized by the clarification.

---

## D6 — Upload control (`UploadDropzone.vue`)

**Decision**: Replace the bare `<input type="file">` with `UFileUpload` wired to the existing
`onChange` logic (`.txt`/`text/plain` accept, `MAX_UPLOAD_BYTES` client-side size guard, read
via `file.text()`, emit `uploaded`, reset to allow re-selecting the same file, never upload to
the server). Preserve `data-test="upload-input"` and the error/summary markup. **Click-to-select
is preserved** (drag-drop is an additive affordance, not a removal of the existing
interaction), so this stays within the "date picker is the sole intentional interaction change"
constraint.

**Rationale**: Removes the last raw control on the Generate surface while keeping the
file-handling behavior and guards identical.

**Alternatives considered**: Keep the native `<input type="file">` as an FR-009 justified
structural exception — acceptable fallback if `UFileUpload` cannot preserve the exact
emit/reset semantics in tests; the migration prefers the design-system control.

---

## D7 — Automated verification of dark-mode (SC-002) and keyboard/focus (SC-004)

**Decision** (per clarification "automated only"): add Vitest `@nuxt/test-utils` tests that
assert observable, deterministic facts rather than pixels:

- **Overlay focus (SC-004)**: `UModal` teleports to `document.body`; tests query the body for
  the dialog, assert focus moves into it on open, that Escape emits `cancel`, and that focus
  returns to the trigger element on close. happy-dom supports `focus()`/`document.activeElement`.
- **Theme correctness (SC-002)**: assert the migrated overlays render via the design-system
  overlay (the bespoke `.backdrop`/`.dialog` with hardcoded background is **gone**), and that
  rendering succeeds with `useColorMode` mocked to `dark` (no crash, no hardcoded panel). This
  is the agreed automated proxy for "renders correctly in dark mode"; true pixel/contrast
  inspection is out of scope by the clarification.
- **Data-table & date picker**: assert sort-header clicks update `query` (`sort`/`order`,
  `page:1`); expanded region shows player vs editor per mode; unavailable row keeps its badge +
  disabled replay; selecting a date range emits identical inclusive ISO bounds; clearing resets.

**Rationale**: Encodes SC-002/SC-004 as the regression gate without a manual step, satisfying
Principle II.

**Known test-harness gotchas to honor** (from prior sessions): mock `useColorMode` via
`mockNuxtImport` (it crashes the nuxt vitest env otherwise); prewarm the i18n catalog in
`beforeAll` and poll with a real delay for locale-dependent assertions; remember a `<textarea>`
`setValue` also fires `change`, so the `QueueItemEditor` text commit must stay on `@blur`
(`trigger('blur')`); auto-import components (don't import via `~`) and import composable types
by relative path to keep `nuxt typecheck` green.

---

## D8 — Delivery & dead-code removal

**Decision**: Ship all three priority slices in **one combined change** (clarification),
building in P1→P2→P3 order with the suite green at each commit. Remove the unused
`LibraryList.vue` **and** `tests/component/LibraryList.test.ts` rather than migrating dead UI
(verified unreferenced by any page/component; only its own test imports it). Confirm
non-reference once more at implementation before deletion.

**Rationale**: Matches the clarified delivery and Principle V (don't migrate dead code).

**Alternatives considered**: Per-priority PRs — rejected by the clarification. Migrating
`LibraryList` for completeness — rejected: it is unreachable and would add maintenance surface.

---

## D9 — Internationalization

**Decision**: Reuse all existing label/placeholder keys; the migration changes presentation,
not copy. Add only the minimal new keys a picker needs that have no existing equivalent (e.g.
date-picker trigger placeholder / "clear" affordance), in both `en.json` and `hu.json` with
parity. No copy rewrites (FR-005, Assumptions).

**Rationale**: Keeps i18n coverage intact with the smallest surface.
