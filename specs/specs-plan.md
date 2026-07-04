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

## Next implementation — Feature 007: Generate-tab redesign (Figma) + generation-flow enhancements

> Self-contained brief for `/speckit-specify`. Mirrors how 006 rebuilt the Library tab from
> Figma. Consumes the backlog's "Generate tab redesign" item plus four Generate-tab
> enhancements (Voice/Format/Model/Speed defaults, Date-to-now, per-item cost estimate,
> progress-modal + cancel). Embed-source-text stays in backlog with Library **Import**; CLI
> adapter and Auth remain deferred.

### Intent

Rebuild the **Generate** tab to match its Figma **"Generate Tab — Nuxt UI"** design exactly, the
same way 006 rebuilt Library — a **single scrolling page** (page intro → three-column generation
editor → generation action bar → Library-style file table + Tag Editor inspector → status bar),
replacing the 005 two-pane QueueList + metadata editor. Primarily a **UX/interaction redesign over
existing generation capabilities**, layered with four **generation-flow enhancements** the
design's own controls invite. Build at a **parallel route** (e.g. `/generate-next`); cut over and
delete the old page once proven (mirrors 006). Accent = existing **indigo** primary, not the Figma
kit's green (006 FR-024 precedent).

### User journeys (priority hints for `/speckit-specify`)

**P1 — Three-column generation editor rebuilt to Figma.**
Single scrolling page. **Script entry** (title + badge, textarea, Clear, character hint, "Add to
queue"), **Generation settings** (Voice / Model / Format / Speed selects), **Metadata** (Title /
Artist / Album / Genre / Language / Recording date), then a **Generation action bar** (queue
summary + count badge + Save queue / Load queue / [neutral action] / Generate). No resizable split
for the editor.

**P1 — Library-style workspace on the same page (reuse 006 components).**
Below the editor the design embeds a filter bar + file-table + Tag Editor (ID3v2.4) inspector
two-pane (show/hide toggle, sortable columns, per-row checkboxes) + status bar — visually
identical to 006. Reuse the 006 components rather than rebuild.

**P2 — Persisted Generation settings.**
Voice / Model / Format / Speed each get a configurable **Settings default** (alongside Default
Tags) and a **last-selected** value persisted in `localStorage` (`echorecall:viewprefs:*`). Today
`useQueue.ts` hardcodes `voiceId=''`/`model='gpt-4o-mini-tts'`/`format='mp3'`/`speed=1` with no
persistence.

**P2 — Generation progress modal with cancel.**
On Generate: current file, per-file succeeded/failed, failures skipped (loop continues), other UI
disabled while open, **closing the modal cancels the run**, completion/cancellation summary.
`generateAll()` already does sequential + isolated failures; new = the modal UI + a cancellation
mechanism (no `AbortController` anywhere today).

**P3 — Per-item cost estimate + queue total.**
Per-item price from model + text size, plus a queue total, shown before Generate (builds on the
character hint). `tts-1` ≈ $15/1M chars, `tts-1-hd` ≈ $30/1M chars; **`gpt-4o-mini-tts` is
token-priced and unknowable before generation** — approximate or show "unavailable." New
hand-maintained client pricing constant.

**P3 — Recording date defaults to today (not tomorrow).**
`recordedAt` defaults to **today** (date-only `YYYY-MM-DD`), snapshotted at **generation time**,
**only when still empty** — never overwriting a user-set value. Replaces `useQueue.ts`'s
`tomorrowIso()` add-time default.

### In scope

- Parallel `/generate-next` route; three-column editor + action bar + lower Library-style
  workspace + status bar rebuilt to Figma; swap the Generate nav target and delete the old
  page/components once proven.
- Reuse 006 Library components (filter bar, file table + Configure Columns, Tag Editor inspector +
  Configure Visible Fields + show/hide, status bar).
- Voice/Model/Format/Speed Settings defaults + remembered last-selected.
- Generation progress modal + cancel (new cancellation mechanism).
- Per-item cost estimate + queue total (new client pricing constant).
- Recording-date-to-today default.
- New strings localized **en/hu** (Hungarian default); controls keyboard/AT-accessible;
  test-gated **red-first**; `wavesurfer.js` **mocked**.
- Accent = **indigo** primary (not Figma green).

### Out of scope (do **not** spec here)

- The App-header **Account area** (Plan / Credits / avatar) in the Figma — **design chrome,
  omitted**: it implies account/credit tracking that doesn't exist and **Auth is deferred**.
- **Embed source text into audio tags** — stays in backlog with Library **Import**.
- **CLI adapter** and **Auth** — remain in Later / backlog.
- TTS-engine / storage-layout / audio-tag-schema changes beyond the minimum these enhancements
  require — reuse existing core/server + composables (justify any core/server touch explicitly, as
  006's R-FILTER did).

### References (visual — 005/006 specs remain source of truth for reused pieces)

Figma file `LSx4m0qJpJRqvp8wCCHKTl`: entry `0-1`; screen **`112-3273`** "Generate Tab — Nuxt UI"
(1440×1688). Sub-nodes: app header `112:3274`, page intro `112:3302`, editor columns `120:223`
(Script `113:1191`, Generation settings `112:3305`, Metadata `115:39`), action bar `116:57`
(neutral button `113:1206`), filter bar `119:66`, file-list + inspector `119:73`, status bar
`119:251`. Re-extract with Figma MCP `get_design_context` at implementation time.

### Open questions

- **[NEEDS CLARIFICATION]** Rollout — parallel `/generate-next` + cutover (006 precedent, assumed)
  or in-place rebuild?
- **[NEEDS CLARIFICATION]** Lower-half scope — is the embedded Library-style workspace truly part
  of Generate (reuse 006 components), or shown only for context, making scope the upper generation
  area only?
- **[NEEDS CLARIFICATION]** Metadata column — collapsible ("Metadata accordion content") or always
  visible?
- **[NEEDS CLARIFICATION]** Action-bar neutral button (`113:1206`) — what action? (extract at spec
  time.)
- **[NEEDS CLARIFICATION]** Settings-defaults home — fifth field group alongside
  `DefaultTagsSettings`/`useDefaultTags` (server-persisted) or a client-only Settings section?
  Precedence when a Settings default *and* a remembered last-selected both exist? Per-field reset?
- **[NEEDS CLARIFICATION]** Cost estimate — pricing source of truth (hardcoded / Settings-editable
  / runtime) + staleness; `gpt-4o-mini-tts` handling (per-char approx / min–max / "unavailable");
  character basis; currency + sub-cent precision; display-only or ever **block** Generate over
  budget?
- **[NEEDS CLARIFICATION]** Cancel semantics — finish in-flight file then stop (flag between
  iterations) or abort via `AbortController`? Does closing (X/Esc/backdrop) cancel immediately or
  need a confirm first (paid calls)? Modal + inline per-row status coexist or modal replaces it?
  How are cancelled/not-started items reported in the summary?
- **[NEEDS CLARIFICATION]** Date default — replace `tomorrowIso()` outright, or make the offset a
  configurable Settings default-tag value (0 vs. +1 day)?

---

## Later / backlog — deferred for a future spec

> Recorded so they aren't lost. **Not part of the active feature (007 above)**; each gets its own spec when picked up.

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

Bundled feature candidate. Suggested as a later feature (008+).

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

---

## Shipped — Feature 006: Library tab redesign (waveform tag-editor)

*(branch `006-library-redesign`; merged to master via **PR #73** — kept for reference; not yet
cut as a numbered release)*

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
