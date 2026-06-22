# Feature Specification: Dashboard Workspace Redesign

**Feature Branch**: `005-dashboard-redesign`

**Created**: 2026-06-22

**Status**: Draft

**Input**: User description: "@specs/specs-plan.md — Dashboard workspace redesign: rework the Generate and Library tabs onto a shared resizable two-panel layout (list left, detail/metadata right) plus a header toolbar that centralizes primary actions; add queue-list curation, a library audio-tags panel with item navigation, a waveform review player, and move Settings into a modal."

## Clarifications

### Session 2026-06-22

- Q: What does the toolbar "Generate" action operate on? → A: Checked items if any are checked, otherwise the entire queue.
- Q: What localization/accessibility bar must the new UI meet? → A: Full parity — all new strings localized (en/hu) and all new interactions keyboard- and screen-reader-accessible, gated by automated tests.
- Q: After Generate runs, what happens to processed items in the queue? → A: Successfully generated items are removed from the queue (failed items remain).
- Q: Where do the form-level voice/model/format/speed controls live in the redesign? → A: A "defaults bar" on the Generate surface sets them for newly added items; per-item voice/model/format stay editable in the detail editor (FR-021).
- Q: What happens to the batch ".zip download-all" once successful items leave the queue? → A: Preserved as a post-run "download this batch" of the run's successful items, independent of the queue (FR-022).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Side-by-side generation workspace (Priority: P1)

A user preparing a batch of recordings wants to see the list of items they are about to generate on one side and edit the details of the selected item on the other, without switching screens. The Generate surface presents a single resizable two-pane workspace: the queue of items on the left, the metadata editor for the currently selected item on the right. Selecting any item in the list loads its details into the editor. New items default their recording date to the next day, with a date picker for changing it.

**Why this priority**: This is the foundational layout that the rest of the feature builds on and the core daily workflow (curate a queue, edit per-item details). Without it none of the other panels have a home. It delivers immediate value on its own.

**Independent Test**: Open the Generate surface with at least two queued items; confirm the list and the metadata editor are visible together, that selecting a different list item swaps the editor contents, that the divider can be dragged to resize the two panes, and that a newly added item shows the next day's date pre-filled and editable.

**Acceptance Scenarios**:

1. **Given** a queue with multiple items, **When** the user selects an item in the list, **Then** that item's metadata appears in the editor pane and edits apply to that item.
2. **Given** the workspace is shown, **When** the user drags the divider between the two panes, **Then** the panes resize and the new split is retained when returning to the surface.
3. **Given** a new item is added to the queue, **When** the user opens its metadata, **Then** the recording date is pre-filled with the next calendar day and can be changed with a date picker.
4. **Given** no item is selected, **When** the surface loads, **Then** the editor pane shows an empty/placeholder state rather than stale data.
5. **Given** the defaults bar, **When** the user sets a default voice/model/format/speed and adds a new item, **Then** the new item inherits those defaults while remaining individually editable in the detail editor.

---

### User Story 2 - Centralized action toolbar (Priority: P1)

A user wants all primary actions in one predictable place. A header toolbar exposes: upload a file, move to the previous item, move to the next item, generate, save the current queue, open a saved queue, and open settings. Previous/next move the active selection through the queue so the user can step through items without returning to the list.

**Why this priority**: Consolidating actions into one toolbar is essential to the redesign's promise of a faster workflow and is needed for the workspace (US1) to be operable. It is small but high-value and ties the surfaces together.

**Independent Test**: With a queue loaded, confirm every listed action is reachable from the toolbar, that previous/next change which item is active (and wrap or stop at the ends predictably), and that generate, save, open, and settings each trigger their respective behavior.

**Acceptance Scenarios**:

1. **Given** the Generate surface, **When** the user views the header, **Then** upload, previous, next, generate, save queue, open queue, and open settings actions are all present.
2. **Given** an item is selected, **When** the user activates next (or previous), **Then** the adjacent item becomes the active selection and its details load in the editor.
3. **Given** the first (or last) item is active, **When** the user activates previous (or next) past the end, **Then** the system behaves predictably (the control is disabled or the selection stops at the boundary) without error.
4. **Given** some queue items are checked, **When** the user activates Generate, **Then** only the checked items are processed; **and given** no items are checked, **When** the user activates Generate, **Then** the entire queue is processed.
5. **Given** a generation run produced one or more successful items, **When** the run completes, **Then** the user can download those items as a single archive even though they have left the queue.

---

### User Story 3 - Queue list curation (Priority: P2)

A user with a long queue needs to find and prune items quickly. The queue list supports free-text search across the source filename and the item text, plus filters by voice, format, album, recording date, and language. A leading checkbox column lets the user select one or many items and delete them together. A source column shows where each item came from — an uploaded filename, or "Text Entered" for ad-hoc text. A per-list settings control opens a small dialog to choose which columns are visible.

**Why this priority**: Curation makes large queues manageable, but the workspace (US1) is usable without it for small batches, so it ranks below the foundational stories.

**Independent Test**: Load a queue with mixed sources and metadata; confirm search narrows the list by filename and by text, each filter narrows by its field, multiple items can be checked and deleted in one action (with confirmation), the source column distinguishes uploaded vs entered items, and toggling column visibility shows/hides columns.

**Acceptance Scenarios**:

1. **Given** a queue, **When** the user types in search, **Then** only items whose filename or text matches remain visible.
2. **Given** a queue, **When** the user applies a voice / format / album / recording-date / language filter, **Then** only items matching the selected value(s) remain visible, and clearing the filter restores the list.
3. **Given** several items are checked, **When** the user deletes, **Then** after a confirmation step all checked items are removed and the selection clears.
4. **Given** items from different sources, **When** the list renders, **Then** uploaded items show their filename and ad-hoc items show "Text Entered" in the source column.
5. **Given** the column settings dialog, **When** the user hides a column, **Then** that column disappears from the list and the choice persists across sessions.

---

### User Story 4 - Add an ad-hoc text item (Priority: P2)

A user wants to add a single piece of text to the queue without preparing and uploading a file. A panel at the top of the Generate surface lets them enter text and add it as a new queue item, which then appears in the list with a "Text Entered" source.

**Why this priority**: A convenient shortcut that complements file upload; valuable but not required for the core curate-and-generate loop.

**Independent Test**: Enter text in the add panel, add it, and confirm a new item appears in the queue with the entered text and a "Text Entered" source, ready to have its metadata edited.

**Acceptance Scenarios**:

1. **Given** the add-text panel, **When** the user enters text and adds it, **Then** a new queue item is created with that text and a "Text Entered" source.
2. **Given** the add-text panel is empty, **When** the user attempts to add, **Then** the system prevents creating an empty item and indicates why.

---

### User Story 5 - Library workspace parity (Priority: P2)

A user reviewing previously generated recordings wants the same efficient layout in the Library. The Library surface adopts the identical resizable two-pane layout: the library table on the left and an audio-tags panel on the right for the selected recording. The tags panel includes previous/next navigation so the user can move through recordings and edit their tags without returning to the table.

**Why this priority**: Brings the Library to parity with the new Generate workflow; high value for editing tags in sequence, but independent of the Generate-side stories.

**Independent Test**: Open the Library with several recordings; confirm the table and tags panel show together, selecting a row loads its tags, the divider resizes the panes, and previous/next in the panel move through recordings updating the tags shown.

**Acceptance Scenarios**:

1. **Given** the Library surface, **When** a recording row is selected, **Then** its audio tags load in the right-hand panel for viewing and editing.
2. **Given** a recording is active in the tags panel, **When** the user activates previous/next, **Then** the adjacent recording becomes active and its tags load without returning to the table.
3. **Given** the Library workspace, **When** the user drags the divider, **Then** the table and tags panel resize and the split is retained.

---

### User Story 6 - Waveform review player (Priority: P3)

A user listening back to a generated recording wants a richer review than a plain play button. The Library surface shows a waveform of the selected recording's audio along the bottom, with the ability to zoom into the waveform and to mark regions on it.

**Why this priority**: A meaningful enhancement to review, but playback already exists, so it is the lowest-priority new capability.

**Independent Test**: Select a recording, confirm its waveform renders and plays, that the user can zoom the waveform in and out, and that regions can be marked on the waveform.

**Acceptance Scenarios**:

1. **Given** a recording is selected, **When** the Library surface shows the player, **Then** the audio is represented as a waveform that plays back.
2. **Given** the waveform is shown, **When** the user zooms, **Then** the waveform scales to show more or less detail.
3. **Given** the waveform is shown, **When** the user marks a region, **Then** the region is visibly indicated on the waveform.

---

### User Story 7 - Settings in a modal (Priority: P3)

A user adjusting application settings opens them as a modal dialog from the toolbar rather than navigating to a separate tab, keeping their place in the workspace.

**Why this priority**: An information-architecture refinement; the existing settings are already reachable, so this is a presentation improvement rather than new capability.

**Independent Test**: Activate "open settings" from the toolbar, confirm settings appear in a modal over the current surface, that changes save as before, and that closing the modal returns the user to where they were.

**Acceptance Scenarios**:

1. **Given** any primary surface, **When** the user opens settings from the toolbar, **Then** settings appear in a modal without leaving the current surface.
2. **Given** the settings modal is open, **When** the user saves changes and closes it, **Then** the changes persist and the user returns to their prior context.

---

### Edge Cases

- **Empty queue**: the workspace shows an empty-state prompt rather than a broken layout; previous/next and generate are disabled or no-op.
- **Deleting the active item**: when the selected item (or one in a multi-select) is deleted, the selection resolves to a sensible neighbor or clears, and the editor updates accordingly.
- **Navigation at boundaries**: previous on the first item and next on the last item do not error.
- **Unsaved queue changes when importing a saved queue**: the user is warned before in-progress queue contents are replaced by an imported queue file.
- **Malformed or incompatible queue file on import**: the system rejects the file with a clear message and leaves the current queue untouched.
- **Recording with missing or unreadable audio**: the waveform player shows an unavailable state instead of failing.
- **Very large queue / library**: search, filter, and rendering remain responsive at the high end of expected list sizes.
- **Invalid or cleared recording date**: the field prevents or flags an invalid date rather than saving it.
- **Partial generation failure**: when only some items generate successfully, the successful items leave the queue while the failed items remain, and the user is told which failed. The batch download (FR-022) covers the run's successful items; when a run yields zero successes, no batch download is offered.
- **No columns visible**: the column-visibility dialog prevents hiding every column.

## Requirements *(mandatory)*

### Functional Requirements

**Shared workspace layout**

- **FR-001**: The Generate and Library surfaces MUST each present a single resizable two-pane workspace — a list pane and a detail pane — sharing the same interaction model.
- **FR-002**: Users MUST be able to resize the split between the two panes by dragging a divider, and the chosen split position MUST persist across sessions.
- **FR-003**: Selecting an item in the list pane MUST load that item into the detail pane; when no item is selected the detail pane MUST show an empty/placeholder state.

**Action toolbar**

- **FR-004**: The Generate surface MUST provide a header toolbar exposing, at minimum: upload a file, previous item, next item, generate, save queue, open queue, and open settings.
- **FR-005**: Previous/next controls MUST move the active selection to the adjacent queue item and load it into the detail pane, and MUST behave predictably at the first/last boundaries (disabled or stop, never error).
- **FR-005a**: The Generate action MUST process the checked queue items when one or more are checked, and otherwise MUST process the entire queue.
- **FR-005b**: After generation, each successfully generated item MUST be removed from the queue; any item that fails to generate MUST remain in the queue so the user can retry it. The just-generated batch MUST remain downloadable per FR-022.

**Generate workspace & queue**

- **FR-006**: The queue list MUST display the items pending generation, including a column indicating each item's source: the uploaded filename, or "Text Entered" for ad-hoc text.
- **FR-007**: Users MUST be able to add a single ad-hoc text item to the queue from a dedicated input area, and the system MUST reject empty text.
- **FR-008**: The metadata/detail editor MUST pre-fill the recording date of a new item with the next calendar day and MUST allow changing it via a date picker.
- **FR-009**: Users MUST be able to search the queue by free text matching the source filename and the item text.
- **FR-010**: Users MUST be able to filter the queue by voice, format, album, recording date, and language, and to clear filters to restore the full list.
- **FR-011**: The queue list MUST provide a leading selection (checkbox) column allowing one or many items to be selected and deleted together, with a confirmation step before deletion.
- **FR-012**: Users MUST be able to choose which queue columns are visible via a settings control, the choice MUST persist across sessions, and the system MUST prevent hiding all columns.
- **FR-013**: Users MUST be able to save the current queue by exporting it as a local file they manage, and to open a previously saved queue by importing such a file. The application MUST NOT store queues server-side and MUST NOT provide in-app saved-queue naming, listing, or deletion (out of scope for this release).
- **FR-021**: The Generate surface MUST provide controls (a "defaults bar") to set the default voice, model, audio format, and speed applied to newly added queue items; each item's voice/model/format MUST remain individually editable in the detail editor.
- **FR-022**: After a generation run, the Generate surface MUST allow downloading that run's successfully generated items as a single archive, independent of the queue (whose successful items have been removed per FR-005b). When a run produces no successful items, no batch download is offered.

**Library workspace**

- **FR-014**: The Library surface MUST use the same two-pane workspace, with the library table in the list pane and an audio-tags panel in the detail pane for the selected recording.
- **FR-015**: The audio-tags panel MUST provide previous/next navigation that changes the active recording and loads its tags without returning focus to the table.
- **FR-016**: The Library surface MUST present the selected recording's audio as a waveform that supports playback, zooming, and marking regions on the waveform. A marked region MUST act only as a playback loop aid — it defines a range that playback can loop over — and MUST NOT modify, trim, or export the underlying audio.

**Settings**

- **FR-017**: Settings MUST be openable as a modal dialog from the toolbar, over the current surface, preserving the user's context, with existing save behavior unchanged. The standalone Settings tab MUST be removed so the toolbar modal is the only entry point.

**Accessibility & localization**

- **FR-019**: All user-visible text introduced by this feature MUST be available in both supported languages (English and Hungarian), with no hardcoded display strings.
- **FR-020**: All new interactive controls (toolbar actions, the resize divider, queue/list selection, the column-visibility dialog, the Settings modal, and the waveform player including region marking) MUST be operable by keyboard and exposed to assistive technologies, and these behaviors MUST be covered by automated tests.

**Scope guard**

- **FR-018**: This feature MUST be limited to presentation and interaction changes on the web surfaces; it MUST NOT alter generation behavior, stored data structures, or audio-tag semantics.

### Key Entities *(include if feature involves data)*

- **Queue**: the collection of items the user intends to generate; can be exported to and imported from a local queue file the user manages. Ordered, supports selection and an active item.
- **Queue Item**: one pending generation, with its text, source (uploaded filename vs "Text Entered"), and metadata (voice, format, album, recording date, language, and other tag fields). An item leaves the queue once it generates successfully; a failed item stays for retry.
- **Recording (Library Item)**: a previously generated audio artifact with its associated audio tags and the audio itself.
- **Audio Tags**: the editable tag fields associated with a recording.
- **View Preferences**: per-user, persisted UI choices — the workspace split position and the set of visible queue columns.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the Generate surface, a user can select a queued item and have its details ready to edit in under 1 second, without a page or tab change.
- **SC-002**: A user can step through every item in a queue using only the previous/next controls, never needing to return to the list to reach any item.
- **SC-003**: In a queue of at least 200 items, a user can narrow to a target item using search or filters in under 5 seconds, with the list updating responsively.
- **SC-004**: A user can select and delete multiple queue items in a single confirmed action rather than one at a time.
- **SC-005**: Every primary action (upload, navigate, generate, save/open queue, open settings) is reachable from the single header toolbar without entering a separate screen.
- **SC-006**: In the Library, a user can review consecutive recordings — view waveform and edit tags — moving between them without returning to the table.
- **SC-007**: Persisted view preferences (split position, visible columns) are restored on the user's next visit at least 95% of the time.
- **SC-008**: The redesign introduces no regressions in generation or tagging outcomes (identical results to the pre-redesign flow for the same inputs).
- **SC-009**: 100% of new user-visible strings are available in both supported languages, and every new interactive control is operable by keyboard and exposed to assistive technologies — both verified by automated tests.

## Assumptions

- The five filterable/editable fields (voice, format, album, recording date, language) already exist on queue items and library recordings; this feature surfaces and filters them but does not introduce new stored fields.
- "Recording date defaults to the next day" means today + 1 calendar day at item creation, always editable via the date picker; if a default is configured elsewhere it does not override the per-item edit.
- Multi-select deletion reuses the application's existing confirmation pattern for destructive actions.
- The resizable split position and visible-column choices are stored as client-side per-user preferences (no server schema change).
- The waveform player operates on already-generated audio; it does not change how audio is produced or stored.
- This is a web-surface (Generate/Library/Settings) feature; it does not add or change any command-line capability, and no domain logic moves out of the shared core.
- Search and filtering follow the existing library's server-driven behavior where applicable; no new query semantics are introduced beyond the listed fields.
- Saving/opening a queue is a client-side local-file export/import; queues are not stored server-side and there is no in-app saved-queue library (per Q1).
- Waveform regions are a playback loop aid only and never modify, trim, or export audio (per Q2); the scope guard against audio-processing changes therefore holds.
- The standalone Settings tab is removed; the toolbar modal becomes the sole entry point to settings (per Q3).
