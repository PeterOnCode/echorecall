# Feature Specification: Generate Tab Redesign (Figma) + Generation-Flow Enhancements

**Feature Branch**: `007-generate-redesign`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "@specs/specs-plan.md — Feature 007: Generate-tab redesign (Figma) + generation-flow enhancements. Rebuild the Generate tab to match its Figma 'Generate Tab — Nuxt UI' design as a single scrolling page (page intro → three-column generation editor → generation action bar → Library-style file table + Tag Editor inspector → status bar), replacing the 005 two-pane QueueList + metadata editor and reusing the 006 Library components. Layer in four generation-flow enhancements the design invites: persisted Voice/Model/Format/Speed settings defaults + last-selected, a generation progress modal with cancel, a per-item cost estimate + queue total, and recording-date-defaults-to-today. Built at a parallel route and swapped in once proven (006 precedent). Accent = the app's existing indigo primary, not the Figma kit's green."

## Clarifications

### Session 2026-07-04

- Q: The Figma design embeds a Library-style workspace (filter bar + file table + Tag Editor inspector + status bar) below the generation editor. How functional is that lower half on the Generate tab? → A: **Full reuse (functional)** — the lower half embeds the fully-functional 006 Library components (filter, sort, multi-select, tag inspector + edit, bulk actions, status bar) operating over the same library data as the Library tab, not a read-only preview and not omitted. The Generate page reuses the 006 components rather than rebuilding them. (Decision **G-EMBED**.)
- Q: Voice/Model/Format/Speed each need a persisted default. Where does the configurable default live, and what wins when both a configured default and a remembered last-selected value exist? → A: **Server default + last-selected** — a configurable default per field is server-persisted alongside the existing Default Tags (a new Settings field group); a per-field last-selected value is remembered in client storage. On load the last-selected value wins, falling back to the configured default, then to a hardcoded fallback; a per-field reset restores the configured default. (Decision **G-DEFAULTS**.)
- Q: The Generate progress modal cancels the run when closed. Given TTS calls are paid and run sequentially, how should cancel behave? → A: **Confirm then graceful stop** — closing the modal (X / Esc / backdrop) first asks for confirmation to guard against accidentally cancelling a paid run; on confirm, the file currently generating finishes, then the run stops before the next item. Already-generated files are kept; remaining items are reported as "not generated / cancelled." (Decision **G-CANCEL**.)
- Q: Does the embedded Library workspace on Generate include the 006 waveform player? → A: **No** — the embed is the filter bar + file table + Tag Editor inspector + status bar only; the 006 waveform player (loop + zoom) stays exclusive to the Library tab, matching the Figma Generate screen (which has no player node). (Refines **G-EMBED**.)
- Q: What is the action bar's neutral secondary button (Figma node `113:1206`)? → A: **Upload .txt batch** — it imports a `.txt` batch file to populate the queue, reusing the existing batch-upload path (`MAX_UPLOAD_BYTES`); it is not a Clear-queue action.
- Q: In the queue cost total, how are items whose price can't be known up front (e.g. `gpt-4o-mini-tts`, "unavailable") treated? → A: **Sum estimable + note** — the total sums only the estimable items and, when any item is unavailable, shows a "+ N items unavailable" note so it is never mistaken for complete; unavailable items are never counted as an amount (not even $0).
- Q: Up to what queue size must the editor and per-item cost rendering stay responsive (measurable target)? → A: **100 items**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Three-column generation editor + action bar rebuilt to Figma (Priority: P1)

A user preparing recordings opens the redesigned Generate tab and sees a single scrolling page: a page intro at the top, then a three-column generation editor — **Script entry** (a titled panel with a badge, a large text area, a Clear control, a character hint, and an "Add to queue" action), **Generation settings** (Voice, Model, Format, and Speed selectors), and **Metadata** (Title, Artist, Album, Genre, Language, Recording date) — followed by a **generation action bar** summarizing the queue (with a count badge) and offering Save queue, Load queue, Upload .txt batch, and Generate. The user types a script, sets the voice and metadata, adds it to the queue, and repeats, watching the queue count grow.

**Why this priority**: This is the core surface the whole feature rebuilds — entering text, choosing generation settings and metadata, and building a queue is the fundamental Generate workflow. Without it there is nothing to generate. It replaces the 005 two-pane QueueList + metadata editor and delivers value on its own.

**Independent Test**: Open the redesigned Generate page; confirm the page intro, the three editor columns (Script, Generation settings, Metadata), and the action bar all render on one scrolling page; type a script, set voice/format/metadata, and "Add to queue"; confirm the item enters the queue, the queue count badge increments, and Clear empties the script field.

**Acceptance Scenarios**:

1. **Given** the redesigned Generate page, **When** it loads, **Then** the page intro, the Script / Generation settings / Metadata columns, and the action bar are all present on a single scrolling page (no resizable split for the editor).
2. **Given** the Script column, **When** the user types text, **Then** a character hint reflects the length, and "Add to queue" adds the entry to the queue.
3. **Given** the Script column with text, **When** the user activates Clear, **Then** the text area empties without affecting the existing queue.
4. **Given** items in the queue, **When** the user views the action bar, **Then** it shows a queue summary and a count badge that matches the number of queued items.
5. **Given** the action bar, **When** the user activates Save queue or Load queue, **Then** the current queue is saved / a saved queue is loaded (reusing the existing queue save/load behavior).

---

### User Story 2 - Embedded Library-style workspace on the same page (Priority: P1)

Below the generation editor the same page embeds the fully-functional Library workspace from Feature 006 — a filter bar, a multi-select file table with sortable, configurable columns, a Tag Editor (ID3v2.4) inspector two-pane with a show/hide toggle and Configure Visible Fields, and a status bar — operating over the same recordings as the Library tab. Right after generating, the user sees the new recordings appear in this table, can filter/sort to find them, select rows, edit their tags in the inspector, and bulk-delete or bulk-edit — without leaving the Generate page. The 006 waveform player is **not** part of this embed; it stays on the Library tab.

**Why this priority**: The Figma design makes the library workspace an integral part of Generate: the user generates and immediately reviews/edits the results in place. Reusing the 006 components (rather than rebuilding) is essential to the design and to consistency, so it ships alongside the editor as P1.

**Independent Test**: On the redesigned Generate page, generate (or already have) several recordings; confirm the embedded workspace shows the file table + Tag Editor inspector + filter bar + status bar identical to the Library tab, that selecting a row loads its tags, that filtering/sorting/multi-select/bulk actions work, and that tag edits saved here are the same edits the Library tab would make (same data).

**Acceptance Scenarios**:

1. **Given** the redesigned Generate page, **When** it loads, **Then** the embedded Library workspace (filter bar, file table, Tag Editor inspector, status bar) renders below the editor and lists the existing recordings.
2. **Given** a just-completed generation run, **When** it finishes, **Then** the newly generated recordings are present in the embedded file table.
3. **Given** the embedded workspace, **When** the user filters, sorts, multi-selects, edits a tag in the inspector and saves, or bulk-deletes, **Then** each behaves exactly as it does on the Library tab, over the same recordings.
4. **Given** the embedded inspector, **When** the user activates the show/hide toggle, **Then** the inspector collapses/restores (as on the Library tab), giving the table more room.
5. **Given** a recording edited in the embedded workspace, **When** the user opens the Library tab, **Then** the same change is reflected there (single shared data source, no divergence).

---

### User Story 3 - Persisted generation settings (Voice / Model / Format / Speed) (Priority: P2)

A user who mostly generates with the same voice, model, format, and speed no longer re-picks them every time. Each of the four settings has a configurable **default** (set in Settings, alongside Default Tags) and remembers the user's **last-selected** value. When the Generate page loads, each field shows the last-selected value if one exists, otherwise the configured default, otherwise a built-in fallback. A per-field reset restores the field to its configured default.

**Why this priority**: This removes repetitive setup on the most-used controls and makes the redesigned editor faster in daily use, but the editor (US1) is fully usable without persistence, so it ranks below the foundational rebuild.

**Independent Test**: Configure a default voice/model/format/speed in Settings; open Generate and confirm those defaults apply; change a field, generate, revisit Generate later, and confirm the changed (last-selected) value is restored; use per-field reset and confirm it returns to the configured default.

**Acceptance Scenarios**:

1. **Given** no prior use, **When** the Generate page loads, **Then** Voice/Model/Format/Speed each show their configured Settings default (or a built-in fallback if none is configured).
2. **Given** the user changes a field and generates, **When** they return to Generate later (including a new session), **Then** that field shows the last-selected value rather than the default.
3. **Given** a configured default and a different last-selected value both exist for a field, **When** the page loads, **Then** the last-selected value takes precedence.
4. **Given** a field showing a last-selected value, **When** the user activates that field's reset, **Then** the field returns to its configured Settings default.
5. **Given** the Settings surface, **When** the user changes a generation default, **Then** it persists and applies as the fallback for future sessions where no last-selected value exists.

---

### User Story 4 - Generation progress modal with cancel (Priority: P2)

When the user activates Generate over a multi-item queue, a progress modal opens showing the file currently generating, a per-file succeeded/failed tally, and (because failures are skipped so the run continues) which items failed. The rest of the page is disabled while the modal is open. If the user closes the modal (X / Esc / backdrop), a confirmation asks whether to cancel the remaining run; on confirm, the in-progress file finishes and the run stops before the next item. When the run ends — completed or cancelled — the modal shows a summary of how many succeeded, failed, and (if cancelled) were not generated.

**Why this priority**: Long multi-item runs are opaque today; visible progress and a safe cancel materially improve the experience and protect against runaway paid generation. It builds on the existing sequential generation, so it is P2 rather than foundational.

**Independent Test**: Queue several items and Generate; confirm the modal shows the current file and running succeeded/failed counts, that a failing item is skipped and reported without stopping the run, that closing the modal prompts for confirmation, that confirming finishes the current file then stops, and that the modal shows a final summary (including not-generated items when cancelled).

**Acceptance Scenarios**:

1. **Given** a queue with multiple items, **When** the user activates Generate, **Then** a progress modal opens showing the current file and a per-file succeeded/failed tally, with the rest of the page disabled.
2. **Given** a run in progress, **When** one item fails, **Then** it is recorded as failed and the run continues to the next item rather than aborting.
3. **Given** a run in progress, **When** the user closes the modal, **Then** a confirmation is shown before anything is cancelled.
4. **Given** the cancel confirmation, **When** the user confirms, **Then** the file currently generating finishes, the run stops before the next item, already-generated files are kept, and remaining items are reported as not generated.
5. **Given** the cancel confirmation, **When** the user declines, **Then** the run continues uninterrupted.
6. **Given** a run that completes or is cancelled, **When** it ends, **Then** the modal shows a summary of succeeded, failed, and (if cancelled) not-generated counts.

---

### User Story 5 - Per-item cost estimate + queue total (Priority: P3)

Before generating, the user sees an estimated cost for each queued item (derived from its model and the size of its text) and a total for the whole queue, so there are no surprises. For models whose price cannot be known before generation, the estimate is clearly shown as unavailable rather than guessed. The estimate is informational only and never blocks Generate.

**Why this priority**: Cost visibility is a helpful guardrail that builds on the existing character hint, but generation works without it, so it is a P3 enhancement.

**Independent Test**: Queue items using a model with known per-character pricing and confirm each shows a plausible per-item estimate and that the queue total is their sum; queue an item using a model that cannot be estimated up front and confirm it shows "unavailable"; confirm the estimate never prevents Generate.

**Acceptance Scenarios**:

1. **Given** a queued item using a model with known pricing, **When** the queue is shown, **Then** the item displays an estimated cost based on its model and text length.
2. **Given** multiple estimable items, **When** the queue is shown, **Then** a queue total equal to the sum of the per-item estimates is displayed.
3. **Given** a queued item using a model whose cost cannot be known before generation, **When** the queue is shown, **Then** its estimate reads "unavailable", is excluded from the total, and the total shows a "+ N items unavailable" note — never a fabricated number and never counted as $0.
4. **Given** any estimate state, **When** the user activates Generate, **Then** generation proceeds — the estimate never blocks it.

---

### User Story 6 - Recording date defaults to today (Priority: P3)

When a user adds an item without setting a recording date, the recording date defaults to the day the item is generated (a date-only value), captured at generation time. If the user has set a recording date, it is never overwritten.

**Why this priority**: This is a small correctness fix (the current default is tomorrow) that improves metadata accuracy, but it is a minor behavior tweak, so it is P3.

**Independent Test**: Add an item leaving the recording date blank, generate it, and confirm the stored recording date equals the generation day; add another item with an explicit recording date, generate it, and confirm that date is preserved unchanged.

**Acceptance Scenarios**:

1. **Given** a queued item with no recording date set, **When** it is generated, **Then** its recording date is set to the generation day (date-only) rather than to tomorrow.
2. **Given** a queued item with a user-set recording date, **When** it is generated, **Then** that date is preserved and not overwritten.
3. **Given** several items generated in one run, **When** they complete, **Then** each blank-dated item takes the generation day and each user-dated item keeps its own date.

---

### Edge Cases

- **Empty queue**: Generate is disabled or no-ops; the action bar shows a zero count and the progress modal does not open.
- **Empty script on "Add to queue"**: adding an item with no text is prevented or clearly flagged rather than creating an empty item.
- **All items fail during a run**: the run completes and the summary reports zero succeeded / N failed, without a crash.
- **Cancel with no item currently generating** (between items): the run stops immediately with nothing in-flight to finish.
- **Closing the modal after the run already finished**: closes normally with no cancel prompt (nothing left to cancel).
- **No configured generation defaults and no last-selected value**: each field falls back to a built-in default so the editor is never left with an unset control.
- **Cost estimate for a mixed queue** (some estimable, some not): the total covers the estimable items and clearly indicates that unavailable items are excluded.
- **Model with unknown/token-based pricing**: shown as "unavailable," never as $0 or a guess.
- **Recording date left blank and generation deferred/failed then retried**: the date is snapshotted at the moment of successful generation, not at add-to-queue time.
- **Embedded workspace with an empty library**: shows the same empty-state as the Library tab, not a broken layout.
- **Editing a recording in the embedded workspace while a generation run is active**: edits and the run operate over the shared data without corrupting each other (the run only adds new recordings).
- **Large queue (up to ~100 items)**: the editor, action bar, and progress modal remain responsive; per-item cost and progress rendering do not degrade the page.

## Requirements *(mandatory)*

### Functional Requirements

**Parallel build & cutover**

- **FR-001**: The redesigned Generate surface MUST be built at a parallel route (distinct from the existing Generate route) so the current Generate tab keeps working untouched while the new surface is verified.
- **FR-002**: Once the redesigned surface is verified, the Generate navigation target MUST point at the new surface, the old Generate page/components MUST be removed, and the new surface MUST take over the canonical Generate route so existing links continue to work. (Cutover is a final, separable step.)

**Three-column generation editor**

- **FR-003**: The redesigned Generate surface MUST be a single scrolling page laid out as: page intro → three-column generation editor (Script entry, Generation settings, Metadata) → generation action bar → embedded Library-style workspace → status bar. The editor MUST NOT use a resizable split (replacing the 005 two-pane layout).
- **FR-004**: The Script entry column MUST provide a titled panel (with a badge), a multi-line text area for the script, a Clear control that empties the text area without affecting the queue, a character hint reflecting the text length, and an "Add to queue" action that adds the current entry to the generation queue.
- **FR-005**: The Generation settings column MUST provide selectors for Voice, Model, Format, and Speed.
- **FR-006**: The Metadata column MUST provide fields for Title, Artist, Album, Genre, Language, and Recording date; these fields MUST be visible in the editor (not hidden behind a collapsed accordion by default).
- **FR-007**: The generation action bar MUST show a queue summary and an item-count badge that matches the number of queued items, and MUST provide Save queue, Load queue, an **Upload .txt batch** action, and Generate. Save/Load queue MUST reuse the existing queue save/load behavior, and Upload .txt batch MUST import a `.txt` batch file to populate the queue via the existing batch-upload path (`MAX_UPLOAD_BYTES`).

**Embedded Library-style workspace (G-EMBED)**

- **FR-008**: Below the editor, the page MUST embed the Feature 006 Library workspace — the filter bar, the multi-select file table with sortable and configurable (Configure Columns) columns, the Tag Editor (ID3v2.4) inspector two-pane with its show/hide toggle and Configure Visible Fields modal, and the status bar — as **fully-functional** controls (filter, sort, multi-select, tag inspect + edit + Save, bulk delete, bulk tag edit), not a read-only preview. The embed MUST NOT include the 006 waveform player (loop + zoom); the player remains exclusive to the Library tab.
- **FR-009**: The embedded workspace MUST operate over the same recordings and the same edit/delete behavior as the Library tab (a single shared data source): a change made in the embedded workspace MUST be reflected on the Library tab and vice-versa. The 006 components MUST be **reused**, not reimplemented.
- **FR-010**: Recordings produced by a generation run MUST appear in the embedded file table once the run completes.

**Persisted generation settings (G-DEFAULTS)**

- **FR-011**: Each of Voice, Model, Format, and Speed MUST have a configurable default value, persisted alongside the existing Default Tags settings, and MUST remember the user's last-selected value per field.
- **FR-012**: On load, each field MUST resolve its value in the order: last-selected value, else configured default, else a built-in fallback. The last-selected value MUST take precedence over the configured default when both exist.
- **FR-013**: Each field MUST offer a reset that restores it to its configured default. Configured defaults MUST persist across sessions; last-selected values MUST persist across sessions in client storage.

**Generation progress modal + cancel (G-CANCEL)**

- **FR-014**: Activating Generate over a non-empty queue MUST open a progress modal showing the file currently generating, a running per-file succeeded/failed tally, and which items failed; the rest of the page MUST be disabled while the modal is open.
- **FR-015**: The run MUST remain sequential and continue past individual failures (a failed item is recorded and skipped, not fatal), reusing the existing generation behavior.
- **FR-016**: Closing the modal (X / Esc / backdrop) MUST first ask for confirmation before cancelling. On confirm, the file currently generating MUST finish, the run MUST stop before the next item, already-generated files MUST be kept, and remaining items MUST be reported as not generated. On decline, the run MUST continue uninterrupted.
- **FR-017**: When the run ends (completed or cancelled), the modal MUST show a summary of succeeded, failed, and (when cancelled) not-generated counts.

**Per-item cost estimate + queue total**

- **FR-018**: Before generation, each queued item using a model with known pricing MUST display an estimated cost derived from its model and text size, and the queue MUST display a total that sums only the estimable items. When any queued item is unavailable, the total MUST show an accompanying "+ N items unavailable" note so it is never mistaken for complete. For a model whose cost cannot be known before generation, the estimate MUST be shown as "unavailable" rather than fabricated, and MUST NOT be counted as an amount (not even $0) in the total.
- **FR-019**: The cost estimate MUST be informational only and MUST NOT block or gate Generate.

**Recording date default**

- **FR-020**: When an item has no recording date set, its recording date MUST default to the generation day (a date-only value) captured at generation time; a user-set recording date MUST never be overwritten. This replaces the current tomorrow default.

**Visual, accessibility & localization**

- **FR-021**: The redesigned surface MUST use the application's existing primary accent (the configured `indigo` primary) and neutral controls; it MUST NOT introduce the source design kit's green accent.
- **FR-022**: All user-visible text introduced by this feature MUST be available in both supported languages (English and Hungarian, Hungarian default), with no hardcoded display strings.
- **FR-023**: All new interactive controls (the Script/Generation-settings/Metadata inputs, the action bar and its queue save/load/Generate actions, the generation-settings reset, the progress modal and its cancel/confirm, and the cost display) MUST be operable by keyboard and exposed to assistive technologies, and these behaviors MUST be covered by automated tests. The embedded 006 controls retain their existing accessibility coverage.

**Scope guard**

- **FR-024**: This feature MUST be limited to the Generate web surface plus the embedded reuse of the Library workspace. It MUST reuse the existing generation engine, storage layout, audio-tag schema, and composables, and MUST NOT change the TTS engine, storage layout, or audio-tag schema beyond the minimum these enhancements require. Any core/server touch MUST be explicitly justified (as 006's R-FILTER was). The single anticipated server touch is **G-DEFAULTS** — persisting the four generation-settings defaults alongside the existing Default Tags settings, additive and migration-free.
- **FR-025**: The cancellation mechanism (G-CANCEL) and the cost estimate MUST be introduced without server or schema change: cancellation is a client-side control over the existing sequential generation, and pricing is a hand-maintained client pricing reference. The recording-date default (FR-020) MUST be a client-side change to the generation flow with no server or schema change.
- **FR-026**: This feature MUST NOT add an account/credit area (the Figma app-header Account region is design chrome and is omitted — accounts/credits and authentication are out of scope), MUST NOT embed source text into audio tags, and MUST NOT introduce a CLI adapter — these remain deferred to their own future specs.

### Key Entities *(include if feature involves data)*

- **Queue Item**: a pending generation entry — its script text, its generation settings (voice, model, format, speed), its metadata (title, artist, album, genre, language, recording date), its source (text-entered), and its derived cost estimate. Built in the editor, listed in the action-bar summary, and consumed by a generation run.
- **Generation Settings**: the four per-item controls — Voice, Model, Format, Speed — each with a configurable default and a remembered last-selected value.
- **Generation Settings Defaults**: the server-persisted default values for Voice/Model/Format/Speed, configured in Settings alongside Default Tags (G-DEFAULTS).
- **Generation Run**: a sequential execution over the queue that produces recordings, continues past individual failures, and can be cancelled (confirm-then-graceful-stop); it reports succeeded/failed/not-generated outcomes.
- **Cost Estimate**: a per-item and queue-total monetary estimate derived from a hand-maintained client pricing reference and text size; "unavailable" for models that cannot be estimated before generation; informational only.
- **Recording (Library Item)**: a previously generated audio artifact — reused from Feature 006 — listed, inspected, edited, and managed in the embedded Library workspace; the same entity the Library tab operates on.
- **View Preferences**: per-user persisted UI choices — the last-selected generation settings (this feature) plus, via the reused 006 workspace, the visible/ordered file-table columns and inspector fields and the inspector show/hide state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the redesigned Generate page, a user can enter a script, choose generation settings and metadata, add the item to the queue, and start generation — all within one scrolling page, without a tab or page change.
- **SC-002**: Voice/Model/Format/Speed are restored to the user's last-selected value (or the configured default when none) on the next visit at least 95% of the time.
- **SC-003**: During a multi-item generation run, the user can see per-file progress and cancel; on a confirmed cancel, every already-generated file is retained and every remaining item is reported as not generated (no partial/ambiguous loss).
- **SC-004**: Before generating, a user sees a per-item and total estimated cost for every item whose model has known pricing, and a clear "unavailable" indication for every item whose model cannot be estimated — with no fabricated amounts.
- **SC-005**: A recording generated with a blank recording date is stored with the generation day as its recording date, and a recording generated with a user-set date keeps that date unchanged, in 100% of cases.
- **SC-006**: The embedded Library workspace performs the same filter, sort, multi-select, tag-edit, bulk-delete, and bulk-tag-edit actions as the Library tab, over the same recordings, with edits visible identically on both surfaces (no divergence).
- **SC-007**: 100% of new user-visible strings are available in both supported languages, and every new interactive control is operable by keyboard and exposed to assistive technologies — both verified by automated tests.
- **SC-008**: The redesign introduces no regression in generation outcomes: for the same inputs and actions, the generated audio and its stored tags are identical to the pre-redesign Generate tab (apart from the intended recording-date default change).
- **SC-009**: After cutover, the canonical Generate route renders the redesigned page and the old Generate page/components are gone, with existing Generate links still resolving.
- **SC-010**: The redesigned surface shows the app's existing indigo accent and no green anywhere, and omits the Figma app-header Account/credits area.
- **SC-011**: With a queue of up to 100 items, the editor, action bar, per-item cost rendering, and progress modal stay responsive (no perceptible lag when adding items, editing fields, or viewing the cost total).

## Assumptions

- **Rollout** follows the 006 precedent: the redesign is built at a parallel Generate route (e.g. `/generate-next`); on cutover the Generate nav points to it, the old page/components are deleted, and it takes over the canonical Generate route (`/`) so existing links/tests keep working.
- **Embedded workspace (G-EMBED)**: the lower half is the fully-functional 006 Library workspace, reused (not rebuilt), over the same library data — per the Session 2026-07-04 clarification. It reuses 006's filter bar, file table + Configure Columns, Tag Editor inspector + Configure Visible Fields + show/hide, and status bar, along with 006's already-justified read-only server extension (R-FILTER) and tag/audio-property behavior (R-TAGS / R-AUDIOPROPS). The 006 **waveform player (loop + zoom) is excluded** from the embed and stays exclusive to the Library tab (per the Session 2026-07-04 clarification). No new server capability is required for the embed itself.
- **Generation settings defaults (G-DEFAULTS)**: configurable defaults for Voice/Model/Format/Speed are server-persisted alongside the existing Default Tags settings (additive, migration-free), and last-selected values are remembered in the existing client view-preferences store. Last-selected wins over the configured default, which wins over a built-in fallback; a per-field reset restores the configured default — per the Session 2026-07-04 clarification. Today the queue hardcodes voice/model/format/speed with no persistence; this feature replaces those hardcoded values with the resolved defaults.
- **Selector catalogs**: the Voice, Model, and Format selectors reuse the existing generation catalogs (Voices; Models = `tts-1` / `tts-1-hd` / `gpt-4o-mini-tts`; Formats = mp3 / wav / flac / opus / aac / pcm), and Speed reuses the existing numeric speed control (range 0.25–4.0, default 1.0). No new option sets are introduced, and the cost-estimate pricing reference is keyed to these same model ids.
- **Cancel semantics (G-CANCEL)**: closing the progress modal confirms first, then does a graceful stop — the in-flight file finishes and the run stops before the next item — per the Session 2026-07-04 clarification. The existing generation loop is already sequential with isolated failures; this feature adds the modal UI and a client-side cancellation flag checked between items (no request-level abort, no server change).
- **Cost estimate**: pricing is a hand-maintained client-side reference keyed by model (e.g. character-priced models such as `tts-1` ≈ $15 / 1M characters and `tts-1-hd` ≈ $30 / 1M characters). Token-priced models that cannot be known before generation (e.g. `gpt-4o-mini-tts`) are shown as "unavailable." Estimates are in USD, shown to sub-cent precision, computed from the item's text length, display-only, and never block Generate. The queue total sums only estimable items and shows a "+ N items unavailable" note whenever any item is unavailable; unavailable items are never counted as an amount (not even $0). The pricing reference may drift from provider prices and is maintained by hand.
- **Recording date default**: the recording date defaults to the generation day (date-only `YYYY-MM-DD`), snapshotted at generation time and applied only when the field is still empty — never overwriting a user-set value. This replaces the current tomorrow default in the queue flow.
- **Metadata layout**: the Metadata column's fields are shown inline in the editor (not collapsed behind an accordion by default); the exact grouping is verified against the Figma design at plan time.
- **Action-bar neutral button**: the action bar's neutral secondary button (Figma node `113:1206`) is an **Upload .txt batch** action — it imports a `.txt` batch file to populate the queue, reusing the existing batch-upload path (`MAX_UPLOAD_BYTES`) — per the Session 2026-07-04 clarification.
- **Design source**: the Figma "Generate Tab — Nuxt UI" screen (`112-3273`) in file `LSx4m0qJpJRqvp8wCCHKTl` is the visual reference and is re-extracted with the Figma MCP `get_design_context` at implementation/plan time; the 005 and 006 specs remain the source of truth for reused behavior. The accent is the app's existing indigo primary (no green).
- **Out of scope**: the app-header Account area (Plan / Credits / avatar), embedding source text into audio tags, a CLI adapter, and authentication all remain deferred to their own future specs and are not built here.
- **Testing**: new behavior is test-gated red-first, and `wavesurfer.js` is mocked in automated tests (as in 006); the reused 006 components keep their existing test coverage.
