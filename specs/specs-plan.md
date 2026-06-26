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
