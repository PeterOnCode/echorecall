# Specification Plan

> **How to use this file.** The **"Next implementation"** section is a self-contained
> feature brief written to be fed directly to `/speckit-specify` (paste it as the feature
> description, or point the skill at this section). It is intentionally phrased as *intent +
> prioritized user journeys + scope boundaries* so the generated `spec.md` maps cleanly onto
> the template (user stories → P1/P2/P3, functional requirements, key entities, success
> criteria). The **"Later / backlog"** section is a holding area for ideas that are
> deliberately **out of scope for the next feature** and are recorded only so they aren't
> forgotten when their own spec is written later.
>
> Open questions are marked **[NEEDS CLARIFICATION]** so `/speckit-specify` surfaces them
> instead of inventing answers.

---

## Next implementation — Feature 006: Library tab redesign (waveform tag-editor)

*(suggested branch `006-library-redesign`; a presentation-layer re-skin of the 005 Library
surface, built at a **parallel route** and swapped in once proven)*

### Intent

Rebuild the **Library** tab to match the Figma **"Library Tab 2"** design — a desktop-style
**waveform tag-editor** — as a full re-skin of the 005 Library surface. Same data and stack as
005 (`@nuxt/ui` v4 + `wavesurfer.js` + `taglib-wasm`); this is a **UX/interaction redesign**,
not new domain behavior. Build it at a **parallel route** (e.g. `/library-next`) so the existing
`/library` keeps working untouched; once verified, point the Library nav tab at the new page and
**delete the old Library page/components** (a final, separate step).

### User journeys (priority hints for `/speckit-specify`)

**P1 — Two-pane file table + tag-editor inspector.**
Resizable `DashboardPanel`: **left** = the file-list table, **right** = the tag-editor
inspector. Selecting a row loads its tags on the right; **Previous/Next** in the inspector
toolbar change the selection without leaving the panel.

**P1 — Waveform player with loop + zoom.**
Light-theme `wavesurfer.js` player along the bottom: **Play** (Lejátszás), **Add loop section**
(Ciklusszakasz hozzáadása), **Repeat-section / loop toggle** (Szakasz ismétlése), and a **zoom**
slider (Nagyítás). Loop **regions** + **zoom** per constitution v2.5.0 / US6.

**P2 — Filter bar.**
Above the table: search-all-fields input, audio-format select, recording-date input, genre
select, language select.

**P2 — File table management.**
Multi-select **checkboxes** (header select-all + per-row), sortable columns (Filename, Title,
Artist, Album, Year, Track, Genre), selected-row highlight, and a **"Configure Columns"** modal
(gear in the file-panel header) to toggle/reorder visible columns (**Filename always-on**).

**P2 — Tag-editor inspector controls.**
Header title + settings gear; toolbar Previous / Next / Play Audio; editable fields (Name,
Text/notes, Title, Artist, Album, Comment, Date, Track Number, Genre, Encoded-By, Language); a
**"Configure Visible Fields"** modal (gear) to toggle which fields show; and a **show/hide
inspector** toggle in the file-panel header.

**P3 — Status bar.**
Save state, files-loaded count, current selection, and encoding info (UTF-8, codec/bitrate).

### In scope

- Parallel `/library-next` route; swap the Library nav target and delete the old Library
  page/components once proven.
- Two-pane resizable layout (reuse 005's `UDashboard` pattern), filter bar, file table
  (multi-select + Configure Columns), tag-editor inspector (+ Configure Visible Fields +
  show/hide toggle), waveform player (loop + zoom), status bar.
- All new strings localized **en/hu** (Hungarian default); controls keyboard/AT-accessible;
  test-gated **red-first**; `wavesurfer.js` **mocked** in tests.
- Accent color = the app's **violet primary** (NOT the Figma kit's green).

### Out of scope (do **not** spec here)

- Changes to `src/core/`, the TTS engine, storage layout, or audio-tag schema — reuse existing
  `taglib-wasm` read/write and app composables (`useViewPreferences`, `useQueueFile`, …); no
  server/schema changes unless explicitly justified (FR-018 spirit).
- **Generate**-tab changes (this feature is Library-only).
- Anything in the **Later / backlog** section below.

### References (visual only — 005 `spec.md`/`data-model.md` remain the source of truth)

Figma file `LSx4m0qJpJRqvp8wCCHKTl`, page **"Library Tab 2"** — screen node `66:3`,
"Configure Visible Fields" modal `80:2088`, "Configure Columns" modal `81:300`.

### Open questions

- **[NEEDS CLARIFICATION]** Configure Columns / Configure Visible Fields persistence — reuse
  005's `useViewPreferences`, and persist across sessions?
- **[NEEDS CLARIFICATION]** Loop **regions** — a single A–B repeat region, or multiple named
  regions?
- **[NEEDS CLARIFICATION]** Filter bar — are format/genre/language/date all present on library
  rows, or derived from tags at read time?
- **[NEEDS CLARIFICATION]** Multi-select in Library — what bulk action(s) beyond selection
  (delete, batch tag edit)?
- **[NEEDS CLARIFICATION]** Status-bar "save state" — does the inspector autosave tag edits, or
  is there an explicit Save?
- **[NEEDS CLARIFICATION]** On old-tab deletion, does the route revert to `/library` (rename
  `/library-next`) so existing links/tests keep working?

---

## Shipped — Feature 005: Dashboard workspace redesign

*(branch `005-dashboard-redesign`; released **v0.5.0** — kept for reference; superseded as
next-up by Feature 006 above)*

### Intent

Rework the **Generate** tab (called "General" in earlier notes) and the **Library** tab onto
a shared, resizable **two-panel dashboard layout** — a list on the left, a detail/metadata
panel on the right — plus a header **toolbar** that centralizes the primary actions. The goal
is a faster, IDE-like batch workflow: build and curate a generation queue, edit per-item
metadata side-by-side, and review generated audio on a waveform — all without leaving the
panel. This is a **UX/interaction redesign**, not a change to the generation engine or
storage; it builds on the `@nuxt/ui` v4 controls delivered in 004.

### User journeys (priority hints for `/speckit-specify`)

**P1 — Side-by-side generation workspace (Generate tab).**
A resizable `DashboardPanel`: **left** = the QueueList of items to generate, **right** = the
metadata fields for the selected item. Selecting an item in the list loads its metadata on the
right. The recording-date field is pre-filled with **tomorrow's date** (sourced from the
Settings default-tag values) and offers a date picker.

**P1 — Dashboard toolbar in the header.**
A `DashboardToolbar` exposing: Upload file, Previous item, Next item (navigation across the
queue selection), Generate, Save QueueList, Open QueueList, and Open Settings.

**P2 — Queue list management.**
The QueueList supports: free-text search (in filename and in item text); filters by voice,
format, album, recording date, and language; a leading **checkbox column** for multi-select +
delete; a **source column** showing the item origin (uploaded filename *or* "Text Entered");
and a per-list settings button opening a modal to choose which columns are visible.

**P2 — Add a single text item.**
A top panel on the Generate tab to add one ad-hoc text entry directly into the QueueList.

**P2 — Library tab on the same layout.**
The Library tab adopts the identical resizable two-panel layout: **left** = the library table,
**right** = an Audio Tags panel. The Audio Tags panel has Previous/Next navigation buttons that
change the selected item without returning to the table.

**P3 — Waveform audio player (Library tab).**
A bottom audio player for the selected file using **wavesurfer-vue**
(https://github.com/meer-sagor/wavesurfer-vue) with the **zoom** and **regions** plugins.

**P3 — Settings as a modal dialog.**
Convert the Settings *tab* into a Settings **modal** opened from the toolbar.

### In scope

- Resizable two-panel dashboard layout shared by the Generate and Library tabs.
- Header toolbar and the actions listed above.
- QueueList filtering, multi-select delete, source column, and configurable column visibility.
- Library Audio Tags panel with item navigation; waveform player with zoom + regions.
- Settings surfaced as a modal.

### Out of scope (do **not** spec here)

- Anything in the **Later / backlog** section below.
- Changes to `src/core/`, the generation/TTS engine, storage layout, or audio-tag schema
  (this is an interaction redesign over existing capabilities).
- New authentication / multi-user concerns.

### Open questions

- **[NEEDS CLARIFICATION]** Save/Open QueueList — persist where and in what format? (Local file
  download/upload as JSON, vs. server-side saved queues?)
- **[NEEDS CLARIFICATION]** Does the Settings *tab* go away entirely once Settings is a modal,
  or do both entry points coexist?
- **[NEEDS CLARIFICATION]** Waveform **regions** — what are regions used for (trim ranges,
  markers, segment export)? Or are they display-only for now?
- **[NEEDS CLARIFICATION]** Recording date "tomorrow" — always today+1, or a configurable
  default in the Settings default-tag values?
- **[NEEDS CLARIFICATION]** Should the resizable split position persist across sessions?
- **[NEEDS CLARIFICATION]** Filter fields (album, language, voice, format) — confirm these are
  all present on queue items and on library rows.
- **[NEEDS CLARIFICATION]** Multi-select delete — reuse the existing `ConfirmDialog`/`UModal`
  confirmation flow from 004?

---

## Later / backlog — deferred for a future spec

> Recorded so they aren't lost. **Not part of feature 005**; each gets its own spec when picked up.

### CLI adapter

- A CLI adapter — the plan deliberately put OpenAI-key resolution in `src/core` "so a future CLI
  honors the same precedence." A CLI over the framework-agnostic core is the most natural next
  adapter.
- Verify `gpt-4o-mini-tts` honors `speed` — flagged here as an unverified implementation note.
- Wire the optional live-OpenAI adapter test — `vitest.adapters.config.ts` mentions it as a
  "later" addition.

### Auth

- The README explicitly notes there's no built-in authentication; only relevant if this ever
  goes multi-user.

### Library file management: Copy, Move, Import

Bundled feature candidate. Suggested feature **007**.

- **Copy** — toolbar action to copy selected recordings' audio files to a user-specified
  destination folder. Library records and working-folder files untouched. Opens a modal for
  destination + options.
- **Move** — same copy, then remove the recordings: database record deleted *and* working-folder
  file deleted. Guarded by a confirmation.
- **Import** — toolbar action to bring existing mp3 files into the project: copy into working
  folder, read existing tags via `taglib-wasm` to populate the library record, appear in the
  file table.
- [NEEDS CLARIFICATION] Destination folder specification (browser can't browse server; typed
  path? pre-configured export locations?).
- [NEEDS CLARIFICATION] Import mechanism (browser upload `UFileUpload` vs. server-side folder
  path, or both?).
- [NEEDS CLARIFICATION] Collision handling (overwrite / rename / skip).
- [NEEDS CLARIFICATION] Move atomicity (failure recovery if copy succeeds but delete fails).
- [NEEDS CLARIFICATION] Multi-file progress/error reporting.

### Embed source text into the audio file's tags at generation time

Idea: when a recording is generated, automatically save `GenerationInput.text` (the
source text sent to TTS) into the audio file's own tags as a **Custom text** entry
(`metadata.customText`, `{ description: 'Audio text', value: <text> }`) — the same
mechanism already used for entries like the existing "chapter" custom text. Today the
source text lives only in the `Generation.text` DB column (surfaced read-only in the
006 inspector's new Source-text field, FR-018a); it is **not** embedded in the file's
own ID3/Vorbis tags, so it's lost if the file is copied/exported outside the app or
re-imported elsewhere (see the Copy/Move/Import backlog item above — likely related).

- [NEEDS CLARIFICATION] Automatic for every generation, or an opt-in Settings toggle?
- [NEEDS CLARIFICATION] Exact custom-text `description` label ("Audio text" as named,
  or something else to avoid colliding with other customText entries like "chapter")?
- [NEEDS CLARIFICATION] Retroactive backfill for existing recordings, or new
  generations only?
- [NEEDS CLARIFICATION] Overlap with the Import feature above — should imported files'
  existing "Audio text" custom-text entry (if present) populate `Generation.text`, or
  are the two kept independent?

### Default the tag Date to now at generation time (not tomorrow)

Idea: when generating audio, the tag Date field (`metadata.recordedAt`) should default
to the current moment (`Date.now()` / today), not tomorrow. Today `useQueue.ts` (line
~106) defaults an un-edited queue row's `recordedAt` to **tomorrow** via `tomorrowIso()`
— see [[005-recordedat-default-clobber]] and the still-open 005 question "Recording
date 'tomorrow' — always today+1, or a configurable default?". This idea answers that
question in favor of **now**.

**Resolved:**
- Format stays **date-only** (`YYYY-MM-DD`, same shape `tomorrowIso()` already
  produces) — not a full timestamp.
- Snapshot at **actual generation time** (when Generate is pressed), not when the row
  is added to the queue — so a row left sitting in the queue overnight still gets the
  date it was actually generated on, not a stale date captured at add-time.
- Only fill today's date when `recordedAt` is **still empty** at generation time —
  never overwrite a value the user explicitly set or edited. This mirrors the existing
  add-time guard (`if (itemMetadata.recordedAt === undefined) …`) but the check must
  now run at generation time instead: since the default no longer fires at row-add,
  a row can reach Generate with `recordedAt` genuinely unset, and only then does today
  get filled in.

- [NEEDS CLARIFICATION] Does this replace `tomorrowIso()`/the row-add default outright,
  or become a configurable Settings default-tag value (offset 0 vs. +1 day)? Given the
  "actual generation time" + "only if empty" resolutions above, the add-time default in
  `useQueue.ts` likely goes away entirely and the empty-check + fill both move into the
  generate/save path — worth confirming when this is specified.

### Voice/Format/Model/Speed: Settings defaults + remembered last-selected

Idea: Voice, Format, Model, and Speed should each have a configurable default in the
Settings panel (like the existing Default Tags section for artist/album/genre/comment/
languages), **and** the user's last-selected value for each should persist across
sessions in `localStorage` (following the existing `echorecall:viewprefs:*` key
convention used by `useViewPreferences`).

Today neither exists: `useQueue.ts` hardcodes `voiceId=''`, `model='gpt-4o-mini-tts'`,
`format='mp3'`, `speed=1` as in-memory refs — there is no Settings-level default for
any of the four, and nothing is persisted, so every fresh session/reload resets to
those hardcoded values regardless of what the user picked last time.

- [NEEDS CLARIFICATION] Precedence when both exist — does a remembered last-selected
  value in `localStorage` override the Settings default, or does the Settings default
  only apply the *first* time (before anything has been selected)?
- [NEEDS CLARIFICATION] Does this live alongside `DefaultTagsSettings.vue`/
  `useDefaultTags` (server-persisted like the other default tags) as a fifth field
  group, or is it purely a new Settings section since Voice/Format/Model/Speed aren't
  `Metadata` tag fields?
- [NEEDS CLARIFICATION] Per-field or all-four-together — can a user reset just Speed's
  remembered value without losing Voice/Format/Model?
- [NEEDS CLARIFICATION] Does "last selected" mean last selected in the Generate form
  (before adding to queue), or last selected per-row in `QueueItemEditor`?

### Detect + resolve DB/file tag drift ("sync" check)

Idea: detect when a recording's audio-tag values on disk (the file's actual ID3/Vorbis
tags) disagree with the `Metadata` stored in the SQLite row, and let the user resolve
it in either direction.

- **Detection**: an out-of-sync recording shows an **error icon** next to its filename
  in the file table's Filename column; in the Tag Editor, each individual field that
  disagrees renders **in red**.
- **Per-item fix**: a **Synchronize** button in the Tag Editor for the active recording.
- **Bulk fix**: a bulk-sync button next to the existing bulk-delete button
  (`data-test="bulk-delete"` in `LibraryFileTable.vue`) — acts on the current selection.
- **Both** open a confirm modal asking the sync **direction**: DB → file (overwrite the
  file's tags with the DB row) or File → DB (overwrite the DB row with the file's tags).

Today the app's own edit path (`PATCH /api/generations/:id` → `LibraryService.update`)
already retags the file and updates the DB row **atomically in one request**, so drift
shouldn't occur from normal in-app edits — it would come from the file being edited
directly on disk outside the app, or (see the Import backlog item above) an imported
file whose tags don't match what gets written to the DB row at import time. Likely
related/sequenced with that Import feature.

- [NEEDS CLARIFICATION] When is the check run — on every Library load/page (a taglib
  read per row could be costly at scale, unlike the existing on-read `AudioProperties`
  pattern which is cheap header data), on-demand via an explicit "Check sync" action, or
  lazily only when a row is selected into the inspector?
- [NEEDS CLARIFICATION] Field scope — compare all `Metadata` fields (incl. the R-TAGS
  extras in `tags_extra`), or only the dedicated-column fields?
- [NEEDS CLARIFICATION] Does File→DB also need to re-derive `skippedTags`/audio
  properties, or only the tag fields?
- [NEEDS CLARIFICATION] Bulk sync direction — one direction applied uniformly to every
  selected row, or does the modal need to handle rows individually (e.g. some need
  DB→file, others File→DB)?
- [NEEDS CLARIFICATION] Does filename/path drift (file renamed on disk outside the app)
  fall under this same sync mechanism, or is it explicitly out of scope (tag values
  only)?

### Generation progress modal (with cancel)

Idea: when generating audio, show a **process indicator modal** instead of (or in
addition to) today's inline per-row status. While it's open:

- Shows **which file is currently generating**, and per-file **succeeded/failed**
  status as the batch progresses.
- A file that fails is **skipped**, and generation continues with the next one (not
  aborted).
- **Other UI elements are disabled** while the modal is showing.
- If the user **closes the modal while processing**, the run is **cancelled**.
- On completion (or cancellation), a **summary**: what was processed vs. what was
  skipped.

Grounding in current behavior: `useGeneration.generateAll()`
(`app/composables/useGeneration.ts`) **already** does sequential per-item generation
with isolated failures — a failing item is already skipped and the loop continues to
the next (FR-006/007 per its own doc comment). That part needs no behavior change.
What's missing is the **UI**: today progress is only inline per-row status text/color
in the `QueueList` table (no modal), only specific `GenerateToolbar` buttons are
disabled via `:disabled="generating"` (not a page-wide lock), and there is **no
cancellation mechanism at all** — no `AbortController` use anywhere in the codebase, so
"cancel" is a genuinely new capability, not just new UI over existing behavior.

- [NEEDS CLARIFICATION] Cancel semantics — does closing the modal (a) let the
  in-flight request for the *current* file finish and then stop before starting the
  next (a simple flag check between loop iterations, straightforward given
  `generateAll`'s `for` loop), or (b) actually abort the in-flight HTTP request via
  `AbortController` (new plumbing, not used anywhere today)?
- [NEEDS CLARIFICATION] Does closing (X / Esc / backdrop click) cancel immediately, or
  does it need its own confirm step first — given each generation is a paid OpenAI TTS
  call, an accidental close silently discarding an in-progress/queued run could be
  costly?
- [NEEDS CLARIFICATION] Scope of "other UI elements disabled" — the whole page (modal
  as a blocking overlay), or just the Generate tab's toolbar/queue controls (matching
  today's partial `:disabled="generating"` usage)?
- [NEEDS CLARIFICATION] Does the modal replace the existing inline per-row queue status
  entirely, or do both coexist (modal while open, inline status remains after it
  closes/for history)?
- [NEEDS CLARIFICATION] What happens to a cancelled run's in-flight/not-yet-started
  items — do they count as "skipped" in the summary alongside genuine failures, or are
  they reported in a separate "cancelled" bucket?

### Generate tab redesign to the Figma "Generate Tab — Nuxt UI" design

Rebuild the **Generate** tab to match its Figma design **exactly**, the same way 006
rebuilt the Library tab from its Figma screen. Strong candidate for the next major
feature; the Figma MCP server is available for extracting the design during
specify/plan/implement.

**Design references** (Figma file `LSx4m0qJpJRqvp8wCCHKTl`, "EchoRecall Web Design"):
- File/page entry: node `0-1`
  (https://www.figma.com/design/LSx4m0qJpJRqvp8wCCHKTl/EchoRecall-Web-Design?node-id=0-1)
- **The screen to match**: node `112-3273` — frame "Generate Tab — Nuxt UI", 1440×1688
  (https://www.figma.com/design/LSx4m0qJpJRqvp8wCCHKTl/EchoRecall-Web-Design?node-id=112-3273)

**Structure of the design** (read via Figma MCP `get_metadata` on `112:3273` —
re-extract with `get_design_context` at implementation time):
- **App header** (`112:3274`): EchoRecall brand mark + name; nav buttons; an **Account
  area with a Plan label, Credits line, and user avatar** (none of which exists in the
  app today).
- **Page intro** (`112:3302`): heading + description line.
- **Generation editor — three columns** (`120:223`): **Script entry** (`113:1191`:
  title + badge, large textarea, Clear action, character hint, "Add to queue" primary
  button), **Generation settings** (`112:3305`: Voice / Model / Format / Speed
  selects), **Metadata** (`115:39`, named "Metadata accordion content": Title / Artist /
  Album / Genre / Language / Recording date inputs).
- **Generation action bar** (`116:57`): queue summary (title + detail line) + count
  badge + actions: Save queue, Load queue, one more neutral action, **Generate**
  primary.
- **Below the generation area, on the same page**: a **filter bar** (`119:66`), a
  **file-list panel + Tag Editor (ID3v2.4) inspector** two-pane (`119:73`, with
  show/hide-inspector toggle, sortable Filename/Title/Artist/Album/Year/Track/Genre
  columns, per-row checkboxes), and a **status bar** (`119:251`) — i.e. the design
  embeds a Library-style workspace directly in the Generate tab, visually identical to
  006's components.

Grounding in the current app: today's Generate tab (`app/pages/index.vue`) is the 005
two-pane QueueList + metadata editor with a `DashboardToolbar`; the Figma design is a
**single scrolling page** (intro → three-column editor → action bar → file table +
inspector → status bar) with no left/right resizable split for the editor part. The
006 components (filter bar, file table, TagInspector, status bar) exist and could be
reused for the lower half. Per 006's FR-024 precedent, accent = the app's existing
**indigo** primary, not the Figma kit's green — re-confirm at specify time.

- [NEEDS CLARIFICATION] The lower half (filter bar + file table + inspector + status
  bar) duplicates the Library tab — is it really part of the Generate tab (reusing the
  006 components), or does the design just show it for context and the feature scope is
  only the upper generation area?
- [NEEDS CLARIFICATION] App header Account area (Plan / Credits / avatar) — real scope
  (implies account/credit tracking that doesn't exist) or design chrome to omit?
- [NEEDS CLARIFICATION] "Metadata accordion content" — is the metadata column
  collapsible (accordion) or always visible?
- [NEEDS CLARIFICATION] The action bar's third neutral button (`113:1206`) — what
  action is it (label not in metadata; check via `get_design_context` at spec time)?
- [NEEDS CLARIFICATION] Same rollout strategy as 006 (parallel route, e.g.
  `/generate-next`, cutover once proven), or in-place rebuild?
- [NEEDS CLARIFICATION] Does this feature absorb the related Generate-tab backlog items
  above (progress modal + cancel; Date-to-now default; Voice/Format/Model/Speed
  defaults + last-selected; embed source text) or do they stay separate follow-ups?
