# Feature Specification: Library Tab Redesign (Waveform Tag-Editor)

**Feature Branch**: `006-library-redesign`

**Created**: 2026-06-24

**Status**: Draft

**Input**: User description: "@specs/specs-plan.md — Feature 006: Library tab redesign (waveform tag-editor). A full re-skin of the 005 Library surface into a desktop-style waveform tag-editor: a resizable two-pane file table + tag-editor inspector, a light-theme waveform player with loop + zoom, a filter bar, multi-select file-table management with a Configure Columns modal, inspector controls with a Configure Visible Fields modal and a show/hide toggle, and a status bar. Built at a parallel route and swapped in once proven." Reconciled against the Figma "Library Tab 2" design (file `LSx4m0qJpJRqvp8wCCHKTl`, screen node `66:3`, modals `80:2088` / `81:300`) after a direct design read.

## Clarifications

### Session 2026-06-24

- Q: In the redesigned Library, what should multi-select (select-all + per-row checkboxes) do beyond highlighting rows? → A: Both bulk delete and bulk tag edit — selected recordings can be deleted together behind a confirmation, and a tag change can be applied across the whole selection at once (reusing the existing delete and retag paths).
- Q: How should the waveform "loop section" feature behave? → A: A single A–B loop — one active loop region with a repeat toggle that loops playback over that range only (consistent with 005's playback-aid loop semantics).
- Q: How are inspector tag edits committed (the status bar shows a "save state")? → A: Explicit Save — edits stage locally and an explicit Save commits them via the existing retag/rename path; the status bar shows saved vs. unsaved (dirty).
- Q: How do Previous/Next behave given the server-paginated library — within the page or across the whole result set? → A: Traverse the full filtered result set — Previous/Next auto-load the adjacent page when crossing a page boundary so every recording is reachable without returning to the table; server-side pagination remains underneath.
- Q: Which fields can bulk tag edit set, and does it overwrite existing values? → A: Any single editable tag field, overwriting that field across the entire selection. Name (filename) is excluded, as applying one filename to many recordings would force rename collisions.
- Q: What happens to unsaved inspector edits when the selection changes? → A: Auto-preserve — in-progress edits are retained as a per-recording dirty buffer and restored when the user returns to that recording (no prompt, never silently discarded); an explicit Save still commits them.

#### Design-verified (after reading the Figma "Library Tab 2")

- Q: The design shows extra editable tag fields not stored today (Text/notes, Encoded-By, Album Artist, Composer, BPM, Rating). How are they handled vs. the no-schema-change guard? → A: Make them **editable** by extending the tag `Metadata` type and the taglib read/write mapping to use the **existing `tags_extra` JSON column** (which already stores `languages`/`customText`/`customUrl`). **No SQL migration.** Text/notes maps to a free-form notes value (`customText`). This **supersedes** the earlier decision that made Text/notes + Encoded-By read-only. (Decision **R-TAGS**.)
- Q: The status bar and Configure Columns show audio properties (codec, bitrate, sample rate, duration) that aren't stored. How far should this go? → A: **Read them server-side** via taglib `audioProperties` when listing/serving a recording, exposed **read-only** on the library item (computed on read — **no schema migration**). Powers the status bar (codec/bitrate/sample-rate) and the Duration/Bitrate columns. (Decision **R-AUDIOPROPS**.)
- Verified UI corrections folded into the requirements below: the inspector header is a fixed title **"Tag Editor (ID3v2.4)"** (panel title + tag-version indicator), not the recording title; the inspector toolbar is **Previous · Next · Play Audio · Save** (Save lives in the toolbar); **both** config modals support **drag-reorder** and a **Reset-to-defaults · Cancel · Apply** footer; the accent is the app's existing neutral/indigo primary (confirmed — no green anywhere in the design).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Two-pane file table + tag-editor inspector (Priority: P1)

A user managing previously generated recordings opens the redesigned Library and sees a desktop-style two-pane workspace: the file table on the left, a tag-editor inspector on the right. Selecting a row loads that recording's tags into the inspector. Previous/Next controls in the inspector toolbar move the selection to the adjacent recording and load its tags without returning to the table. The divider between the panes can be dragged to resize them.

**Why this priority**: This is the foundational layout the rest of the feature hangs on — the file list and the tag editor side by side, with in-place navigation. Without it the waveform, filters, and inspector controls have no home. It delivers value on its own as a faster review/edit surface.

**Independent Test**: Open the Library with several recordings; confirm the table and inspector show together, that selecting a row loads its tags on the right, that the divider resizes the two panes (with the split retained), and that Previous/Next in the inspector move through recordings and update the tags shown without focusing the table.

**Acceptance Scenarios**:

1. **Given** the Library with multiple recordings, **When** the user selects a row, **Then** that recording's tags load in the inspector and the row is visibly highlighted as selected.
2. **Given** a recording is active in the inspector, **When** the user activates Previous or Next, **Then** the adjacent recording becomes active and its tags load without returning focus to the table.
3. **Given** the first (or last) recording is active, **When** the user activates Previous (or Next) past the end, **Then** the control behaves predictably (disabled or stops at the boundary) without error.
4. **Given** the workspace is shown, **When** the user drags the divider, **Then** the panes resize and the chosen split is retained on the user's next visit.
5. **Given** no recording is selected, **When** the surface loads, **Then** the inspector shows an empty/placeholder state rather than stale or broken content.

---

### User Story 2 - Waveform player with loop + zoom (Priority: P1)

A user reviewing a recording wants a richer player than a plain play button. A light-theme waveform of the selected recording runs along the bottom of the workspace with: Play (Lejátszás), Add loop section (Ciklusszakasz hozzáadása), a Repeat-section (Szakasz ismétlése) toggle, and a zoom slider (Nagyítás). The user can mark a single A–B loop region on the waveform and toggle repeat so playback loops over just that range, and can zoom the waveform in and out to see more or less detail.

**Why this priority**: The waveform player is the defining feature of the "Library Tab 2" redesign and the primary reason to rebuild this surface; reviewing audio with loop + zoom is core to the editor experience, so it ships alongside the layout as P1.

**Independent Test**: Select a recording; confirm its waveform renders in the light theme and plays, that the zoom slider scales the waveform in and out, that the user can add a loop section, and that enabling repeat loops playback over only the marked A–B range.

**Acceptance Scenarios**:

1. **Given** a recording is selected, **When** the player shows, **Then** the audio is represented as a waveform that plays back from the Play control.
2. **Given** the waveform is shown, **When** the user adjusts the zoom slider, **Then** the waveform scales to show more or less horizontal detail.
3. **Given** the waveform is shown, **When** the user adds a loop section, **Then** a single A–B region is visibly marked on the waveform.
4. **Given** an A–B loop region exists, **When** the user enables the repeat toggle and plays, **Then** playback loops continuously over that range only until repeat is disabled.
5. **Given** a recording with missing or unreadable audio, **When** it is selected, **Then** the player shows an unavailable state instead of failing.

---

### User Story 3 - Library filter bar (Priority: P2)

A user with many recordings needs to narrow the table quickly. A filter bar above the table provides: a search-all-fields input, an audio-format selector, a recording-date range, a genre selector, and a language selector. Applying any filter narrows the table to matching recordings; clearing it restores the full list.

**Why this priority**: Filtering makes a large library manageable, but the two-pane layout (US1) is usable without it for small libraries, so it ranks below the foundational stories.

**Independent Test**: Load a library with mixed formats, genres, languages, and dates; confirm the search input narrows across fields, and that each of the format, recording-date, genre, and language controls narrows the table by its field, with clearing any control restoring the list.

**Acceptance Scenarios**:

1. **Given** the library, **When** the user types in the search-all input, **Then** only recordings matching the text across searchable fields remain visible.
2. **Given** the library, **When** the user selects an audio format, genre, language, or a recording-date range, **Then** only recordings matching that value (for the date range, those whose recording date falls within the selected bounds) remain visible.
3. **Given** one or more filters are applied, **When** the user clears a filter, **Then** the table restores the recordings that filter had hidden.
4. **Given** a filter combination that matches nothing, **When** it is applied, **Then** the table shows an empty-result state rather than an error.

---

### User Story 4 - File table management (Priority: P2)

A user curating the library wants to manage many recordings at once. The file table offers a leading multi-select column (a header select-all plus per-row checkboxes), sortable columns, and a clear selected-row highlight. With recordings selected the user can bulk-delete them (behind a confirmation) or apply a bulk tag edit across the whole selection. A "Configure Columns" control (a gear in the file-panel header) opens a modal to toggle and reorder which columns are visible, with Filename always shown.

**Why this priority**: Bulk management and column configuration make a large library efficient to maintain, but they build on top of the table from US1 rather than being required for it.

**Independent Test**: Select multiple recordings via checkboxes; confirm select-all toggles all rows, that bulk delete removes the selected recordings after a confirmation, that a bulk tag edit applies one tag change across the selection, that sorting a column reorders the table, and that the Configure Columns modal toggles/reorders columns while keeping Filename visible.

**Acceptance Scenarios**:

1. **Given** the file table, **When** the user toggles the header select-all, **Then** all visible rows become selected/deselected together.
2. **Given** several recordings are selected, **When** the user bulk-deletes, **Then** after a confirmation step all selected recordings are removed and the selection clears.
3. **Given** several recordings are selected, **When** the user applies a bulk tag edit, **Then** the chosen tag value is written to every selected recording and the table reflects the change.
4. **Given** the table, **When** the user sorts by a sortable column, **Then** the rows reorder by that column.
5. **Given** the Configure Columns modal, **When** the user hides or reorders columns, **Then** the table reflects the change, Filename cannot be hidden, and the choice persists across sessions.

---

### User Story 5 - Tag-editor inspector controls (Priority: P2)

A user editing a recording's tags works in a focused inspector titled **"Tag Editor (ID3v2.4)"** with a settings gear; its toolbar offers Previous, Next, Play Audio, and Save. Below are the recording's tag fields — Name, Text/notes, Title, Artist, Album, Comment, Date, Track Number, Genre, Encoded-By, Language, Album Artist, Composer, BPM, and Rating — all editable. Edits stage locally and are committed by an explicit Save; the gear opens a "Configure Visible Fields" modal to toggle and reorder which fields appear, and a show/hide control in the file-panel header collapses or expands the inspector to give the table more room.

**Why this priority**: The inspector's controls turn the layout into a real tag editor, but the core select-and-view behavior already lands in US1, so the richer controls are P2.

**Independent Test**: Select a recording; confirm the header reads "Tag Editor (ID3v2.4)" with a gear, the toolbar Play Audio plays it, editing any field (including Text/notes or Encoded-By) then Saving commits the change (and an unsaved edit is reflected as dirty until saved), the Configure Visible Fields modal toggles and reorders which fields show, and the show/hide control collapses and restores the inspector.

**Acceptance Scenarios**:

1. **Given** a selected recording, **When** the inspector loads, **Then** its fields (Name, Text/notes, Title, Artist, Album, Comment, Date, Track Number, Genre, Encoded-By, Language, Album Artist, Composer, BPM, Rating) show the recording's current values and are editable.
2. **Given** the user edits one or more fields, **When** they activate Save (in the toolbar), **Then** the changes are committed to the recording and the inspector reflects a saved (non-dirty) state.
3. **Given** the user has edited a field but not saved, **When** they navigate to another recording and back, **Then** the unsaved (dirty) state was indicated throughout and the staged edits are restored intact (not silently discarded).
4. **Given** the Configure Visible Fields modal, **When** the user toggles a field off or reorders fields, **Then** the inspector reflects the change, Name stays visible, and the choice persists across sessions.
5. **Given** the file-panel header, **When** the user activates the show/hide inspector control, **Then** the inspector collapses (giving the table more room) and can be restored.
6. **Given** the inspector toolbar, **When** the user activates Play Audio, **Then** the selected recording plays.

---

### User Story 6 - Status bar (Priority: P3)

A user wants at-a-glance context about the library and the current edit. A status bar along the bottom shows the save state (e.g. "All changes saved" vs. unsaved/dirty), the count of files loaded, the current selection, and the selected recording's encoding info — the tag character encoding (UTF-8) and the audio codec, bitrate, and sample rate (e.g. "MPEG-1 Layer 3 (320 kbps, 44100 Hz)").

**Why this priority**: The status bar is informational polish that improves orientation but is not required to view, filter, edit, or play recordings, so it is the lowest-priority addition.

**Independent Test**: With a library loaded and a recording selected, confirm the status bar shows the loaded-file count, the current selection, the save state (which flips to unsaved after an edit and back after Save), and the codec/bitrate/sample-rate + UTF-8 for the selection.

**Acceptance Scenarios**:

1. **Given** a loaded library, **When** the user views the status bar, **Then** it shows the number of files loaded and the current selection.
2. **Given** a recording is selected, **When** the status bar updates, **Then** it shows the recording's audio properties (codec, bitrate, sample rate) and tag encoding (UTF-8) where available.
3. **Given** the user edits a field, **When** the edit is unsaved, **Then** the status bar shows an unsaved/dirty state, and after Save it shows a saved state.

---

### Edge Cases

- **Empty library**: the workspace shows an empty-state prompt rather than a broken layout; Previous/Next, bulk actions, and the player are disabled or no-op.
- **No recording selected**: the inspector and player show placeholder/unavailable states; the status bar shows zero selection.
- **Navigation at boundaries**: Previous on the first recording and Next on the last do not error.
- **Deleting the active recording** (single or within a multi-select): the selection resolves to a sensible neighbor or clears, and the inspector/player/status update accordingly.
- **Unsaved edits when changing selection**: navigating to another recording retains the unsaved inspector edits as a per-recording staged buffer and restores them on return (no prompt, never silently discarded); more than one recording may be in an unsaved state at once.
- **Bulk tag edit across a mixed selection**: applying one tag value to many recordings reports how many succeeded and surfaces any that failed, without leaving partial ambiguity.
- **Recording with missing or unreadable audio**: the waveform player shows an unavailable state instead of failing; the status bar omits any audio properties it cannot read.
- **Loop region with no audio / zero-length range**: adding a loop section is prevented or ignored when there is nothing to loop.
- **No columns visible / all fields hidden**: the Configure Columns modal keeps Filename visible and prevents hiding every column; the Configure Visible Fields modal keeps Name visible and prevents an empty inspector.
- **Audio properties unavailable for a format**: when a recording's codec/bitrate/sample-rate or duration can't be read, those status-bar items and the Duration/Bitrate columns show a blank/placeholder rather than failing.
- **Filter combination matching nothing**: the table shows an empty-result state, not an error.
- **Very large library**: search, filter, sort, and rendering remain responsive at the high end of expected library sizes.

## Requirements *(mandatory)*

### Functional Requirements

**Parallel build & cutover**

- **FR-001**: The redesigned Library MUST be built at a parallel route (distinct from the existing Library route) so the current Library keeps working untouched while the new surface is verified.
- **FR-002**: Once the redesigned surface is verified, the Library navigation target MUST point at the new surface, the old Library page/components MUST be removed, and the new surface MUST take over the canonical Library route so existing links continue to work. (Cutover is a final, separable step.)

**Two-pane workspace layout**

- **FR-003**: The Library surface MUST present a single resizable two-pane workspace — the file table on the left and the tag-editor inspector on the right — sharing the established dashboard interaction model.
- **FR-004**: Users MUST be able to resize the split between the two panes by dragging a divider, and the chosen split position MUST persist across sessions.
- **FR-005**: Selecting a row in the file table MUST load that recording into the inspector and visibly highlight the selected row; when no recording is selected the inspector MUST show an empty/placeholder state.
- **FR-006**: The inspector toolbar MUST provide Previous/Next navigation that changes the active recording and loads its tags without returning focus to the table. Navigation MUST traverse the entire filtered result set — when the adjacent recording lies on another page, the system MUST load that page automatically — and MUST behave predictably at the first/last boundaries of the whole set (disabled or stop, never error).

**Waveform player**

- **FR-007**: The Library surface MUST present the selected recording's audio as a light-theme waveform that supports playback.
- **FR-008**: Users MUST be able to zoom the waveform in and out via a zoom control.
- **FR-009**: Users MUST be able to mark a single A–B loop region on the waveform and toggle repeat so that playback loops over that range only. The loop region MUST act only as a playback aid — it MUST NOT modify, trim, transcode, or export the underlying audio.
- **FR-010**: When the selected recording's audio is missing or unreadable, the player MUST show an unavailable state instead of failing.

**Filter bar**

- **FR-011**: The Library surface MUST provide a filter bar above the table with: a search-all-fields input, an audio-format selector, a **recording-date range** (start/end calendar days narrowing to recordings whose recording date falls within the inclusive bounds; either bound alone forms an open-ended range), a genre selector, and a language selector.
- **FR-012**: Applying any filter MUST narrow the table to matching recordings, and clearing a filter MUST restore the recordings it had hidden; a filter combination matching nothing MUST show an empty-result state rather than an error.

**File table management**

- **FR-013**: The file table MUST provide a leading multi-select column with a header select-all and per-row checkboxes, and MUST visibly highlight selected rows.
- **FR-014**: The file table MUST support sorting by Filename, Title, Artist, Album, Year, Track, Genre, Comment, and Date — each backed by a stored/queryable column (Filename sorts by the stored filename; Year and Date both sort by the recording date). Columns derived from audio properties (Duration, Bitrate) and the JSON-stored Composer tag are display-only and NOT sortable.
- **FR-015**: With one or more recordings selected, users MUST be able to bulk-delete them behind a confirmation step, reusing the application's existing delete behavior; after deletion the selection MUST clear and counts/pagination MUST stay correct.
- **FR-016**: With one or more recordings selected, users MUST be able to apply a bulk tag edit: the user picks one editable tag field (any inspector-editable tag field except Name/filename) and a value, and the system overwrites that field across the entire selection via the existing retag behavior, then reports how many succeeded and surfaces any failures. Name/filename is excluded, as applying one filename to many recordings would force rename collisions.
- **FR-017**: Users MUST be able to toggle and reorder which file-table columns are visible via a "Configure Columns" modal (gear in the file-panel header). The toggleable column set MUST include at least Filename, Title, Artist, Album, Year, Track, Genre, Comment, Date, Composer, Duration, and Bitrate. Filename MUST always remain visible, the modal MUST NOT allow hiding every column, and the visibility/order choice MUST persist across sessions.

**Tag-editor inspector**

- **FR-018**: The inspector MUST present the recording's tag fields, all **editable**: Name (the recording filename, committed via the existing rename), Notes (free-form `notes` tag — distinct from the read-only Source text of FR-018a), Title, Artist, Album, Comment, Date, Track Number, Genre, Encoded-By, Language, Album Artist, Composer, BPM, and Rating. Fields without an existing dedicated stored column (Notes, Encoded-By, Album Artist, Composer, BPM, Rating) MUST be persisted via the existing `tags_extra` JSON store (per decision R-TAGS) — no new SQL column or migration.
- **FR-018a**: The inspector MUST also show a read-only "Source text" field beside Name, displaying the recording's immutable `Generation.text` (the synthesized text) — distinct from the editable Notes tag, which is a separate, empty-by-default free-form value.
- **FR-019**: Inspector edits MUST stage locally and be committed only by an explicit Save action in the toolbar (reusing the existing retag/rename path); until Save, the edit MUST be reflected as an unsaved (dirty) state. Changing the selection with unsaved edits MUST retain those edits as a per-recording staged (dirty) buffer and restore them when the user returns to that recording — without a prompt and without silently discarding them; an explicit Save commits the staged edits for that recording.
- **FR-020**: Users MUST be able to toggle **and reorder** which inspector fields are visible via a "Configure Visible Fields" modal (gear in the inspector header). The choice MUST persist across sessions, Name MUST always remain visible, and the modal MUST prevent hiding every field.
- **FR-021**: The file-panel header MUST provide a show/hide control that collapses and restores the inspector pane.
- **FR-022**: The inspector toolbar MUST provide a Play Audio control that plays the selected recording, alongside Previous, Next, and Save.
- **FR-032**: The inspector header MUST display a fixed panel title indicating the tag editor and tag version (e.g. "Tag Editor (ID3v2.4)"), not the recording's title.

**Status bar**

- **FR-023**: The Library surface MUST present a status bar showing the save state (e.g. "All changes saved" vs. unsaved/dirty), the count of files loaded, the current selection, the tag character encoding (UTF-8), and the selected recording's audio properties (codec, bitrate, sample rate) where available.

**Extra tag fields & audio properties (verified scope)**

- **FR-029** (R-TAGS): The tag set MUST be extended to support editing Text/notes, Encoded-By, Album Artist, Composer, BPM, and Rating by extending the tag metadata model and the tag read/write mapping. Each extra field MUST be written to the audio file as its native ID3 frame (Encoded-By→TENC, Album Artist→TPE2, Composer→TCOM, BPM→TBPM, Rating→POPM, Text/notes→a user-text/`customText` frame) and mirrored in the **existing `tags_extra` JSON store** for the SQLite row. Field formats: BPM is a non-negative integer; **Rating is a 0–5 integer (stars) mapped to the ID3 POPM 0–255 scale**; the others are free text. This MUST NOT add a SQL column or require a migration, MUST NOT change generation behavior, and MUST remain reachable from the shared core (not introduced in the presentation layer).
- **FR-030** (R-AUDIOPROPS): The system MUST surface read-only audio properties (codec, bitrate, sample rate, duration) for a recording by reading them server-side from the audio file (computed on read), exposed on the library item for the status bar (FR-023) and the Duration/Bitrate columns (FR-017). This MUST NOT add a SQL column or migration and MUST NOT alter generation behavior.
- **FR-031**: The Configure Columns and Configure Visible Fields modals MUST each support reordering rows (drag handle) in addition to visibility toggles, and MUST provide a footer with a Reset-to-defaults action plus Cancel and Apply, honoring the always-on (Filename / Name) and not-all-hidden guards.

**Visual, accessibility & localization**

- **FR-024**: The redesigned surface MUST use the application's existing primary accent (the configured `indigo` primary) and neutral controls as in the rest of the app; it MUST NOT introduce the source design kit's green accent.
- **FR-025**: All user-visible text introduced by this feature MUST be available in both supported languages (English and Hungarian, Hungarian default), with no hardcoded display strings.
- **FR-026**: All new interactive controls (the resize divider, table multi-select and sorting, the Configure Columns and Configure Visible Fields modals incl. reorder, the inspector show/hide and Save, the filter bar, and the waveform player including loop and zoom) MUST be operable by keyboard and exposed to assistive technologies, and these behaviors MUST be covered by automated tests.

**Scope guard**

- **FR-027**: This feature MUST be limited to the Library web surface and MUST NOT alter the generation/TTS engine or require a SQL schema migration. It reuses existing capabilities (library read/filter, retag, delete, view preferences) and is permitted **three explicitly justified, migration-free core extensions**: (1) **R-FILTER** — an additive, read-only extension of the library list query (genre/language/recording-date filters + extra sort keys over already-existing columns) for the filter bar (FR-011/FR-012) and sort (FR-014); (2) **R-TAGS** — extending the tag metadata model + read/write to persist extra editable fields in the existing `tags_extra` JSON column (FR-029); (3) **R-AUDIOPROPS** — reading audio properties server-side for display (FR-030). None of these may add a SQL column/migration or change generation behavior.
- **FR-028**: This feature MUST NOT change the Generate surface; it is Library-only.

### Key Entities *(include if feature involves data)*

- **Recording (Library Item)**: a previously generated audio artifact with its filename, its audio, its tags, and (read-only) its audio properties. Listed in the file table, loaded into the inspector, and played in the waveform player.
- **Audio Tags**: the recording's editable tag fields shown in the inspector. Backed by existing dedicated storage: Name (filename), Title, Artist, Album, Comment, Date, Track Number, Genre, Language. Backed by the existing `tags_extra` JSON store (R-TAGS): Notes, Encoded-By, Album Artist, Composer, BPM, Rating. Editable individually or, for non-filename fields, via bulk tag edit. The read-only Source text (FR-018a) is shown alongside but is not an Audio Tag — it is the recording's immutable `Generation.text`.
- **Audio Properties**: read-only, derived-on-read attributes of a recording's audio — codec, bitrate, sample rate, duration — surfaced in the status bar and as optional columns; never edited (R-AUDIOPROPS).
- **Table Selection**: the set of recordings checked in the file table; drives bulk delete and bulk tag edit, plus the single active recording shown in the inspector/player.
- **Loop Region**: a single A–B range marked on the selected recording's waveform; a playback aid only, never altering the audio.
- **View Preferences**: per-user persisted UI choices — the pane split position, the set/order of visible file-table columns, and the set/order of visible inspector fields.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the Library, a user can select a recording and have its tags ready to edit in under 1 second, without a page or tab change.
- **SC-002**: A user can step through every recording in the filtered library using only the inspector's Previous/Next controls — including across page boundaries — never needing to return to the table to reach any recording.
- **SC-003**: In a library of at least 200 recordings, a user can narrow to a target recording using the search or any filter in under 5 seconds, with the table updating responsively.
- **SC-004**: A user can delete multiple recordings, or apply one tag change to multiple recordings, in a single confirmed action rather than one at a time.
- **SC-005**: A user can review a recording on the waveform — play it, zoom in/out, and loop a marked A–B range — without leaving the workspace.
- **SC-006**: Persisted view preferences (split position, visible/ordered columns, visible/ordered inspector fields) are restored on the user's next visit at least 95% of the time.
- **SC-007**: The redesign introduces no regressions in tagging, deletion, or library listing outcomes (identical results to the pre-redesign Library for the same inputs and actions); previously-stored tags continue to round-trip unchanged.
- **SC-008**: 100% of new user-visible strings are available in both supported languages, and every new interactive control is operable by keyboard and exposed to assistive technologies — both verified by automated tests.
- **SC-009**: After cutover, the canonical Library route renders the redesigned surface and the old Library page/components are gone, with existing Library links still resolving.
- **SC-010**: Editing and saving an extra tag field (e.g. Album Artist, Composer, BPM, Rating, Encoded-By, or Text/notes) persists it and round-trips on reload, with no SQL migration applied; the status bar shows the recording's real codec/bitrate/sample-rate.

## Assumptions

- The filter bar and multi-column sort are powered by **R-FILTER**: an additive, read-only, migration-free extension of the existing server library query (new optional `genre`, `language`, `recordedAt`-range filters and sort keys over already-existing columns). No schema change. Chosen so filter/sort cover the whole library and Prev/Next can cross pages (per clarification).
- Extra editable tag fields are persisted via **R-TAGS**: the existing `tags_extra` JSON column (which already holds `languages`/`customText`/`customUrl`) plus a tag read/write mapping extension in the shared core. No SQL column or migration. Text/notes maps to a free-form notes value (`customText`).
- Audio properties shown in the status bar / columns are **R-AUDIOPROPS**: read server-side from the audio file on demand (codec/bitrate/sample-rate/duration), exposed read-only. No SQL column or migration; not editable.
- Previous/Next traversal keeps the existing server-side pagination: crossing a page boundary loads the adjacent page rather than loading the whole library at once.
- Column visibility/order and inspector field visibility/order are stored as client-side per-user view preferences (reusing the established view-preferences mechanism), with no server or schema change.
- Bulk delete reuses the existing per-recording delete + confirmation pattern; bulk tag edit reuses the existing retag path to overwrite one chosen editable tag field across the selection, excluding the filename.
- Inspector edits use an explicit Save (toolbar); the status bar's "save state" tracks the inspector's saved vs. unsaved (dirty) condition.
- The waveform loop is a single A–B playback-aid region; it never modifies, trims, transcodes, or exports audio. The waveform player operates on already-generated audio and is mocked in automated tests.
- The new surface is built at a parallel Library route; on cutover the navigation points to it, the old page/components are deleted, and the new surface takes over the canonical Library route so existing links/tests keep working.
- This is a Library-only web-surface feature; it does not change the Generate surface, the generation engine, or require a SQL migration. Filter/sort, the extra-tag mapping, and audio-property reading live in the shared core (reachable from a future CLI), not the presentation layer.
- The "Library Tab 2" Figma file was read directly and is the visual reference; the 005 spec/data-model remain the source of truth for pre-existing behavior. The accent is the app's existing `indigo` primary (no green).
