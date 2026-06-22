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

## Next implementation — Feature 005: Dashboard workspace redesign

*(suggested branch `005-dashboard-redesign`; supersedes the presentation-only 004 migration)*

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
