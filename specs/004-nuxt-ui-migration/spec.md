# Feature Specification: Nuxt UI Component Migration

**Feature Branch**: `004-nuxt-ui-migration`

**Created**: 2026-06-21

**Status**: Draft

**Input**: User description: "change html for nuxt ui components, the roadmap's Nuxt-UI migration."

## Overview

Several of the application's interactive surfaces are still built from hand-written HTML
controls (raw text inputs, selects, date pickers, buttons, tables, and a bespoke modal),
even though the rest of the app already uses the shared design-system component library
(Nuxt UI) introduced in the Studio Enhancements release. This inconsistency produces
visibly mismatched controls, at least one screen that renders incorrectly in dark mode,
and duplicated hand-rolled accessibility logic.

This feature completes the migration: every remaining raw HTML control on the Generate,
Library, and Settings surfaces is replaced with the equivalent shared design-system
component, so the whole application looks consistent, respects light/dark mode, and behaves
identically to today — with no new features and no change to what users can do.

## Clarifications

### Session 2026-06-21

- Q: How should the Library's native date-range filters be migrated, given a design-system date picker changes the picking UX? → A: Replace them with the design-system date picker, accepting the calendar-popover interaction as a deliberate, user-visible change; the resulting filter values stay identical.
- Q: How should the Library results table (custom inline expandable rows + per-column sort) be migrated? → A: Adopt the design-system data-table component, reproducing the expandable audio-player/editor rows and the sort behavior on it.
- Q: How should the three priority slices (P1 Generate, P2 Library, P3 Overlays/Settings) be delivered? → A: As one combined change covering all three surfaces; the P1/P2/P3 priorities indicate build order, not separate releases.
- Q: What acceptance evidence gates dark-mode (SC-002) and keyboard/focus (SC-004), which the current unit tests don't cover? → A: Automated tests only — extend the suite to assert theme adaptation (no hardcoded colors) and focus-trap/Escape/focus-restore behavior.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consistent, theme-correct controls on the Generate workflow (Priority: P1)

A user creating speech spends most of their time on the Generate tab: entering text,
choosing voice/format/metadata, queueing items, editing queued items, and uploading
scripts. Today this surface mixes design-system components with raw HTML inputs, selects,
textareas, and buttons, so controls look and behave inconsistently and don't all adapt to
the active theme.

After this change, every control on the Generate workflow is a shared design-system
component, so the most-used screen looks uniform, adapts correctly to light/dark mode, and
keeps working exactly as before.

**Why this priority**: The Generate workflow is the primary job the product exists to do
and the screen users touch most. Migrating it delivers the largest consistency and polish
improvement and is a self-contained, demonstrable slice on its own.

**Independent Test**: Open the Generate tab, generate an item, queue and edit a queued
item, and upload a script — in both light and dark mode. All controls render in the
design-system style, adapt to the theme, and every existing action produces the same
result as before.

**Acceptance Scenarios**:

1. **Given** the Generate tab in light mode, **When** the user fills in text, voice,
   format, and metadata and starts generation, **Then** all inputs/selects/buttons appear
   as design-system controls and generation succeeds exactly as before.
2. **Given** the Generate tab, **When** the user switches to dark mode, **Then** every
   control on the tab (form fields, queue items, queue-item editor, upload dropzone)
   renders with correct, readable colors and no light-mode remnants.
3. **Given** a queued item, **When** the user opens its inline editor and edits a field,
   **Then** validation, save, and cancel behave identically to the pre-migration behavior.
4. **Given** required-field validation on the form, **When** the user submits with invalid
   input, **Then** the same validation feedback is shown using design-system styling.

---

### User Story 2 - Consistent, theme-correct controls on the Library (Priority: P2)

A user managing their generated audio uses the Library tab to search, filter, sort,
paginate, replay, download, edit metadata, delete, and bulk-clean items. Today this surface
has the largest concentration of raw HTML — a hand-built table, raw search/filter/date
inputs and selects — which looks unlike the rest of the app and does not consistently
follow the design system.

After this change, the search/filter bar, results table, pagination, and inline editor are
all shared design-system components, so browsing the library looks consistent and adapts to
the theme while preserving every search, sort, filter, and row action.

**Why this priority**: The Library is the second most-used surface and holds the most raw
HTML, so migrating it yields the next-largest consistency gain. It is independent of the
Generate work and is independently testable.

**Independent Test**: Open the Library tab, run a text search, filter by voice/format/date
range, sort by each column, page through results, replay/download/edit/delete a row — in
both themes. Results match pre-migration behavior and all controls follow the design
system.

**Acceptance Scenarios**:

1. **Given** a populated library, **When** the user searches, filters by voice/format/date,
   and sorts a column, **Then** the same result set and ordering are produced as before,
   with design-system controls.
2. **Given** more results than one page, **When** the user moves to the next/previous page,
   **Then** pagination works as before and the prev/next controls disable correctly at the
   bounds.
3. **Given** a row whose stored audio is missing, **When** the list renders, **Then** the
   row still shows its "unavailable" state and the replay control is disabled, as today.
4. **Given** the Library in dark mode, **When** the table and filter bar render, **Then**
   all controls and the table adapt to the theme with readable colors.

---

### User Story 3 - Consistent confirmation/overlay and remaining settings controls (Priority: P3)

A user performing a destructive action (deleting an item, bulk-cleaning the library) sees a
confirmation overlay. Today that overlay is a bespoke modal with hand-written focus
handling and hardcoded colors, so it renders with a white panel and gray text even in dark
mode and duplicates accessibility logic the design system already provides. A few Settings
controls (default-tag fields) also still use raw HTML.

After this change, confirmation/bulk overlays and the remaining Settings controls use the
shared design-system overlay and form components, fixing the dark-mode rendering of the
confirmation dialog and unifying focus/keyboard behavior across the app.

**Why this priority**: It fixes a concrete dark-mode defect and removes duplicated bespoke
accessibility code, but affects lower-traffic surfaces than the primary workflows, so it
follows P1 and P2. It is independently testable.

**Independent Test**: Trigger a delete confirmation and a bulk-clean confirmation in dark
mode; the overlay renders with correct theme colors, traps focus, closes on Escape, and
returns focus to the trigger. Edit and save a default-tag value in Settings; behavior is
unchanged.

**Acceptance Scenarios**:

1. **Given** dark mode, **When** the user opens the delete confirmation overlay, **Then**
   the overlay panel and text render with correct, readable dark-mode colors (no hardcoded
   white background).
2. **Given** an open confirmation overlay, **When** the user presses Escape or activates
   cancel/confirm, **Then** the overlay dismisses and focus returns to the element that
   opened it, as today.
3. **Given** the Settings tab, **When** the user edits and saves a default-tag value,
   **Then** the value persists and the success/feedback behavior is unchanged, using
   design-system controls.

---

### Edge Cases

- **Test selectors**: Existing automated tests target controls by their `data-test`
  attributes; migrated controls MUST keep those hooks (or the tests are updated in lockstep)
  so the suite remains a valid regression gate.
- **Disabled/bounded states**: Controls that are conditionally disabled today (pagination
  prev/next at first/last page; replay on an unavailable row) MUST remain disabled under the
  same conditions.
- **Unavailable audio row**: A library row whose stored audio fails to load MUST keep its
  "unavailable" indicator and disabled replay after migration.
- **Focus return on dismissal/unmount**: An overlay that is dismissed — or unmounted by its
  parent while open — MUST return focus to the previously focused element, as the current
  bespoke dialog does.
- **Keyboard submit**: Forms that can be submitted via the keyboard (e.g., Enter) MUST
  continue to do so.
- **Long content/overflow**: Long item text and long field values MUST wrap/truncate in the
  table and editors as they do today, without breaking layout.
- **Validation states**: Field-level validation feedback (e.g., metadata, default tags)
  MUST still appear, using design-system styling.
- **Both languages**: All visible text MUST continue to come from the i18n catalogs and
  render correctly in both English and Hungarian.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All interactive controls on the Generate, Library, and Settings surfaces
  (buttons, text inputs, textareas, selects, date inputs, the results table, and
  confirmation/overlay dialogs) MUST be rendered using the shared design-system component
  library rather than hand-written HTML controls. The Library date-range filters are replaced
  with the design-system date picker (FR-011), and the Library results table is rebuilt on
  the design-system data-table component (FR-010).
- **FR-002**: Every migrated control MUST preserve its existing behavior with no functional
  regression — including data binding, value formatting, emitted events, validation,
  enable/disable conditions, and any local interactions (sorting, paging, inline editing,
  replay, download). The sole intentional interaction-level exception is the date-picker
  change defined in FR-011.
- **FR-003**: Every migrated surface and overlay MUST render correctly in both light and
  dark mode, with no hardcoded colors that fail to adapt to the active theme. In particular,
  the confirmation overlay's current dark-mode defect MUST be resolved.
- **FR-004**: Migrated controls MUST preserve or improve accessibility: each control keeps
  its label/association, overlays remain dialog-role with focus trapped while open, Escape
  dismisses an overlay, and focus returns to the triggering element on close.
- **FR-005**: All user-visible text on migrated controls MUST continue to be sourced from
  the existing i18n catalogs (English and Hungarian) with no loss of translation coverage.
- **FR-006**: The automated test hooks the suite relies on (control `data-test` selectors)
  MUST be preserved on the migrated controls, or the corresponding tests MUST be updated in
  the same change so the full suite continues to pass. The Library data-table migration
  (FR-010) is expected to change some control selectors; the affected tests MUST be updated
  in the same change.
- **FR-007**: The migration MUST be limited to the presentation layer; it MUST NOT change
  application behavior, copy (beyond what a like-for-like control swap requires), data
  models, persistence, server endpoints, or the framework-agnostic core.
- **FR-008**: Bespoke markup, styling, and hand-rolled control logic that the design-system
  component supersedes (e.g., the custom modal's scoped styles and manual focus trap) MUST
  be removed when its responsibility moves to the shared component, leaving no dead duplicate
  logic.
- **FR-009**: The complete migration MUST leave no remaining raw HTML interactive control
  (input, select, textarea, button, table, or custom dialog) on the in-scope surfaces; any
  intentionally retained raw element MUST be explicitly justified (e.g., a structural
  wrapper with no design-system equivalent).
- **FR-010**: The migrated Library results table MUST be implemented with the design-system
  data-table component and MUST reproduce today's behavior: per-column sort toggling with
  ascending/descending indicators, and inline expandable rows (an audio-player row and an
  inline metadata-editor row, each spanning the full row) that open and close per item.
- **FR-011**: The migrated Library date-range filters MUST use the design-system date
  picker. The picking interaction (a calendar popover) intentionally differs from the prior
  native date input, but the produced filter values MUST remain identical — inclusive
  local-day start/end bounds, resetting to the first page on change.

### Key Entities

Not applicable — this feature changes only how existing controls are presented; it
introduces no new data entities, fields, or persisted state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of interactive controls on the Generate, Library, and Settings surfaces
  are rendered from the shared design-system library; an inventory of those surfaces finds
  zero remaining raw HTML controls (input/select/textarea/button/table/custom dialog) except
  any explicitly justified structural exception.
- **SC-002**: Every migrated screen and overlay renders correctly in both light and dark
  mode — 0 controls with unreadable or non-adapting colors, verified specifically on the
  confirmation overlay that is currently broken in dark mode. Verification is automated: the
  test suite asserts theme adaptation (no hardcoded colors) on the migrated surfaces.
- **SC-003**: 0 functional regressions — every pre-existing user task (generate, queue,
  edit, upload, search, sort, filter, paginate, replay, download, delete, bulk-clean,
  edit/save settings) produces the same outcome as before, evidenced by the full existing
  automated test suite passing.
- **SC-004**: 100% of interactive controls and overlays remain fully operable by keyboard
  alone — reachable in a logical tab order, with focus trapped in open overlays, Escape
  dismissing them, and focus restored to the trigger on close. These are verified by
  automated tests covering focus trapping, Escape-to-dismiss, and focus restoration.
- **SC-005**: No regression in perceived responsiveness — primary tasks complete in the same
  time as before, with no added loading or interaction delay introduced by the migration.

## Scope

**In scope** — replacing remaining raw HTML controls with shared design-system components on:

- **Generate**: the generation form, metadata fields, queue list, queue-item editor, and
  upload dropzone.
- **Library**: the search/filter bar, results table (and its sortable headers/pagination),
  and the inline item editor/list.
- **Settings**: the remaining raw controls (default-tag fields) not yet on the design
  system.
- **Shared overlays**: the confirmation dialog and bulk-clean dialog.

**Out of scope**:

- Any new feature, screen, or capability.
- Redesigning layouts, restructuring information architecture, or changing copy beyond what
  a like-for-like control swap requires.
- Changes to behavior, validation rules, data models, persistence, server endpoints,
  provider/tagger ports, or the framework-agnostic core.
- Controls already implemented with design-system components (only residual raw elements
  alongside them are cleaned up).

**Delivery**: All three priority slices ship together in a single change. The P1/P2/P3
priorities indicate build/implementation order within that change, not separate releases.

## Assumptions

- The shared design-system component library (Nuxt UI v4) and color-mode support are already
  installed and configured (shipped in the Studio Enhancements release); this feature adds no
  new runtime dependency.
- This is a presentation-layer migration only; the framework-agnostic core, server routes,
  persistence, and ports are untouched.
- Existing `data-test` attributes are preserved on migrated controls (or the affected tests
  are updated in the same change) so the automated suite remains the regression gate.
- The i18n catalogs (English/Hungarian) remain the single source of all visible text; copy
  is not rewritten as part of this migration.
- Visual appearance is expected to shift to match the design system's look and feel — that is
  the intent — while information architecture, control order, labels, and behavior are
  preserved.
- The roadmap's "Nuxt-UI migration" item refers to converting the app's remaining
  hand-written HTML controls to the shared design-system components (inferred from the
  current mixed state of the codebase); no separate written roadmap entry enumerates the
  exact component list.
- Behavior is preserved across the migration, with one intentional exception: the Library
  date-range filter adopts a design-system date picker (calendar UX) per FR-011 — its
  resulting filter values and outcomes stay identical.
