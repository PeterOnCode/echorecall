# Phase 0 Research: Dashboard Workspace Redesign

All decisions resolve the Technical Context unknowns. No `[NEEDS CLARIFICATION]` markers remain
in the spec (resolved during `/speckit-specify` + `/speckit-clarify`). This phase fixes the
*how*: which already-installed components implement each requirement, the one new dependency, and
the client-side persistence/serialization approaches.

---

## R1. Resizable two-pane workspace

**Decision**: Build the shared shell from `@nuxt/ui` v4.8.2's dashboard components:
`UDashboardGroup` (wraps the panels and owns persisted sizing) → two `UDashboardPanel`s
(list, detail) split by a `UDashboardResizeHandle`. Expose it as one app component
`DashboardWorkspace.vue` with `#list` and `#detail` slots, consumed by both Generate and
Library.

**Rationale**: These components ship in the **already-installed** `@nuxt/ui` (verified in
`node_modules/@nuxt/ui/dist/runtime/components/`: `DashboardGroup`, `DashboardPanel`,
`DashboardResizeHandle`, `DashboardToolbar`, `DashboardNavbar`). They provide the drag-to-resize
handle, accessible separator semantics, and **built-in size persistence** keyed by a stable
`storage-key`/panel `id` — so FR-002 (persist split across sessions) needs no custom code. Zero
new dependency; consistent with the 004 design-system direction.

**Alternatives considered**:
- *Custom flexbox + pointer-drag + manual localStorage* — rejected: reinvents what the
  dashboard components already do (incl. keyboard-resizable handle and ARIA), more code, worse
  a11y, violates YAGNI.
- *`splitpanes` / `@vueuse` `useResizeObserver` DIY* — rejected: a new dependency or bespoke code
  for something the installed design system covers.

**Open detail for Phase 1**: confirm the exact prop names for the persistence key and default
ratio against the installed version's `DashboardPanel.vue.d.ts`; the contract records the props
we depend on so a minor API difference is caught by a typed test rather than at runtime.

---

## R2. Waveform player (zoom + loop regions) — the one new dependency

**Decision**: Add `wavesurfer.js` `^7` as a direct dependency and wrap it in a single
`WaveformPlayer.vue`, using its official **Regions** plugin (loop regions) and **Zoom**
(or minimap/timeline) plugin. Instantiate `WaveSurfer.create(...)` in `onMounted`, destroy in
`onBeforeUnmount`, point it at the recording's `audioUrl`. Regions are **loop aids only**
(FR-016 / Q2): a region sets a playback loop range; no trim/export/mutation.

**Rationale**: There is **no waveform primitive in `@nuxt/ui`**, and the existing
`AudioPlayer.vue` is a bare `<audio controls>`. `wavesurfer.js` v7 is the de-facto, actively
maintained, TypeScript-typed library; its first-party regions + zoom plugins map directly onto
FR-016. The source brief named the `wavesurfer-vue` wrapper, but wrapping `wavesurfer.js`
ourselves in one small component avoids a thin third-party maintenance layer and keeps the
lifecycle explicit. **This is a new technology choice → constitution amendment (see plan
Constitution Check / Complexity Tracking).**

**Testing**: happy-dom cannot render the canvas or run WebAudio, so component tests **mock**
`wavesurfer.js` (factory returning a stub exposing `load`/`zoom`/`on`/`destroy` and a regions
plugin stub) — the same mocking pattern already used for `useColorMode`. Tests assert our wiring
(loads the right `src`, zoom control calls `zoom`, adding a region marks a loop), not
wavesurfer's internals.

**Alternatives considered**:
- *`wavesurfer-vue` wrapper (meer-sagor)* — viable, but adds a second dependency over
  `wavesurfer.js` for little benefit; our wrapper is ~30 lines.
- *Native `<canvas>` + WebAudio Analyser DIY* — rejected: re-implements regions/zoom/interaction;
  far more bespoke code and worse a11y than the library.
- *Keep bare `<audio>` only* — rejected: cannot satisfy FR-016 (waveform/zoom/regions).

---

## R3. Header toolbar

**Decision**: Use `UDashboardToolbar` for the Generate toolbar (`GenerateToolbar.vue`),
populated with `UButton`s for upload / previous / next / generate / save queue / open queue /
open settings. Upload and "open queue" trigger hidden file inputs (reuse the existing
`UploadDropzone` accept/size guards; keep the hidden input out of the tab order per the 004
fix). Previous/Next bind to the active-selection index in `useQueue`; disabled at the
boundaries (FR-005).

**Rationale**: Installed component; gives consistent toolbar layout and slots. Keeps all primary
actions in one accessible row (SC-005).

**Alternatives considered**: a hand-built header `<div>` — rejected (reinvents toolbar
spacing/overflow/ARIA already in the component).

---

## R4. Saved-queue file format (export/import)

**Decision**: "Save queue" serializes the queue to a **versioned JSON document** and triggers a
browser download (`<filename>.echoqueue.json`); "Open queue" reads a user-picked file, parses
and **validates** it, and replaces the in-memory queue (after warning if the current queue is
non-empty). Document shape: `{ schema: "echorecall.queue", version: 1, items: QueueFileItem[] }`,
where each item carries `text`, `voiceId`, `model`, `format`, `instructions?`, `metadata`,
`source`, `sourceName?` — i.e. the regeneratable inputs, **not** transient `status`/`result`/
`clientId`. Implemented in a new `useQueueFile` composable using the browser Blob/File APIs.

**Rationale**: Q1 fixed this as a local-file export/import with no server storage and no in-app
saved-queue management. JSON is human-inspectable, round-trips losslessly, and needs **no new
dependency** and **no server/schema change** (Principle IV, FR-018). A `schema`+`version`
envelope lets import reject malformed/incompatible files cleanly (edge case) and leaves room for
future migration without committing to it now (YAGNI).

**Alternatives considered**:
- *Server-side named queues* — rejected by Q1 (would add persistence + schema, breaking the
  scope guard).
- *Plain array JSON (no envelope)* — rejected: no version handle for the malformed/incompatible
  import edge case.
- *CSV/`.txt`* — rejected: can't faithfully carry nested metadata (languages/customText/customUrl).

---

## R5. Client-side view preferences (visible columns; split size)

**Decision**: Split/pane size is persisted by `@nuxt/ui`'s dashboard storage (R1) — no custom
code. **Visible-column** selection is persisted via a new `useViewPreferences` composable backed
by `localStorage` under a namespaced key (e.g. `echorecall:viewprefs:queueColumns`), with a
typed default and a guard that **prevents hiding every column** (FR-012). `UTable` column
visibility is driven from this reactive state.

**Rationale**: Per-device client preferences with no auth and no server schema (matches the
spec's assumption). `localStorage` is the standard, dependency-free choice; SSR-safe access is
guarded (`import.meta.client`) to avoid hydration issues. Hitting persistence ≥95% of the time
(SC-007) is trivially met by synchronous localStorage.

**Alternatives considered**:
- *Cookie-backed (`useCookie`)* — unnecessary; these prefs never need to reach the server.
- *Server-stored prefs* — rejected: adds schema/route, breaks scope guard, and there are no user
  accounts to key them to.

---

## R6. Recording-date picker (default tomorrow)

**Decision**: Render `Metadata.recordedAt` in the detail-pane editor as a `UPopover`+`UCalendar`
date picker (the exact combo 004 added for the Library date-range filter), mapping
`CalendarDate` ↔ the stored `recordedAt` string via `@internationalized/date` (already a direct
dep). New queue items default `recordedAt` to **tomorrow** (today + 1 calendar day, local) at
creation; the field stays fully editable and clearable.

**Rationale**: `recordedAt` already exists on `Metadata` (`src/core/shared/types.ts:46`,
"Full timestamp OR year-only") — **no schema change**. Reusing the established date-picker
pattern keeps the UI consistent and the mapping typed (no `any`). "Tomorrow" matches Q1-era
assumption; defaulting at creation (not via a server default) keeps it client-side.

**Alternatives considered**:
- *Raw `<input type="date">`* — rejected: 004 deliberately moved off native date inputs to the
  design-system picker; regressing would be inconsistent.
- *Storing recording date as a new first-class field* — rejected: `recordedAt` already models it.

---

## R7. Multi-select delete & generate target

**Decision**: The queue gains a leading `UCheckbox` selection column tracked as `checkedIds` in
`useQueue`. **Delete** removes all checked items after a confirmation step reusing the existing
`ConfirmDialog`/`UModal` pattern (FR-011). **Generate** (FR-005a) targets the checked items when
any are checked, otherwise the whole queue. After generation, **each successfully generated item
is removed** from the queue; failed items remain (FR-005b) — `useGeneration` filters them out on
success.

**Rationale**: Reuses the queue's existing identity (`clientId`) and the app's existing
destructive-action confirmation (consistency, no new modal pattern). Generate-target and
remove-on-success are the `/speckit-clarify` decisions, encoded as testable composable behavior.

**Alternatives considered**:
- *Generate-active-item-only / generate-all-always* — rejected by the clarify answer (B).
- *Keep generated items with a "done" badge* — rejected by the clarify answer (queue is a
  worklist; successful items leave).

---

## R8. Source tracking ("uploaded filename" vs "Text Entered")

**Decision**: Extend the **app-level** `QueueItem` (in `useQueue.ts`) with
`source: 'upload' | 'text'` and optional `sourceName` (the uploaded filename). `addItem(text)`
sets `source:'text'`; `addFromUpload(content, filename)` sets `source:'upload'` + `sourceName`.
The source column shows `sourceName` for uploads and the localized "Text Entered" label
otherwise (FR-006).

**Rationale**: `QueueItem` is ephemeral and lives in the `app/` composable, so this is **not** a
core/persisted type change (the core `ListItem` stays untouched — honoring FR-018/Principle IV).
Upload parsing currently flattens multi-line `.txt` into rows; each row inherits the file's
`sourceName`.

**Alternatives considered**:
- *Add `source` to core `ListItem`* — rejected: would touch `src/core/shared/types.ts`,
  breaking the scope guard for a presentation-only concern.

---

## R9. Information architecture — Settings modal & tab removal

**Decision**: Delete `app/pages/settings.vue`; remove the "Settings" tab from
`layouts/default.vue` (leaving Generate | Library). Add `SettingsModal.vue` (a `UModal`) that
mounts the existing `AppearanceSettings`, `LanguageSettings`, `OpenAiKeySettings`, and
`DefaultTagsSettings` sections unchanged; open it from the toolbar's "open settings" action
(FR-017 / Q3). Closing returns focus to the trigger.

**Rationale**: Q3 chose "remove the tab; modal is the sole entry point." The four settings
sections are already self-contained components, so the modal is pure composition — no settings
logic changes. `UModal` supplies focus trap/return and Escape handling (the 004 dark-mode-safe
overlay).

**Alternatives considered**: keep both tab and modal — rejected by Q3 (two entry points to the
same state).

---

## Summary of dependencies & gates

- **No new dependency** for: resizable workspace, toolbar, modal(s), table, date picker, queue
  file, view preferences (all from installed `@nuxt/ui` + `@internationalized/date` + browser
  APIs).
- **One new dependency**: `wavesurfer.js` `^7` (+ regions/zoom plugins) for US6 — **gated by the
  constitution Technology-Stack amendment** (plan Constitution Check). US1–US5 carry no new
  dependency and are unblocked.
