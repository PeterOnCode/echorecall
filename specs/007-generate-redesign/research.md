# Phase 0 Research: Generate Tab Redesign (Figma) + Generation-Flow Enhancements

**Feature**: 007-generate-redesign · **Date**: 2026-07-04 · **Spec**: [spec.md](./spec.md)

All spec clarifications are already resolved (Clarifications §Session 2026-07-04: G-EMBED, G-DEFAULTS,
G-CANCEL, no-embed-player, Upload-.txt button, cost-total note, 100-item scale). This document records
the **implementation decisions** that flow from them, each grounded in the current codebase. No open
`NEEDS CLARIFICATION` remains.

---

## R1 — Parallel route + cutover (FR-001/FR-002)

- **Decision**: Build the redesigned Generate surface at **`app/pages/generate-next.vue`** while the
  current `app/pages/index.vue` (canonical `/`) keeps working. Cutover is a final, separate step:
  repoint the Generate nav target to the new surface, then move the new page into `index.vue` and
  **delete** the superseded 005 Generate components (`AddTextPanel`, `GenerateForm`, `GenerateToolbar`,
  `QueueList`, `QueueColumnsDialog` if unused), so the new surface owns `/`.
- **Rationale**: Mirrors the proven 006 `/library-next` → `/library` cutover; keeps `main` shippable
  throughout and lets the redesign be verified live before it replaces the primary page.
- **Alternatives considered**: *In-place rebuild of `index.vue`* — breaks the working page during the
  build and complicates rollback; rejected (006 precedent).

## R2 — Single scrolling layout, not the resizable dashboard (FR-003)

- **Decision**: The Generate page is a **single vertically-scrolling page**: page intro → a responsive
  **3-column grid** editor (Script / Generation settings / Metadata) → generation action bar → the
  embedded Library workspace → status bar. It does **not** use `DashboardWorkspace`'s resizable
  two-pane shell for the editor.
- **Rationale**: The Figma "Generate Tab" is one scrolling column of stacked regions, not a split
  pane; FR-003 explicitly drops the resizable split. A CSS grid (collapsing to one column on narrow
  viewports) matches the design and is simpler than the dashboard shell.
- **Alternatives considered**: *Reuse `DashboardWorkspace`* — wrong interaction model for a scrolling
  page and would fight the embedded Library workspace below; rejected.

## R3 — Pending-queue display + per-item cost (R-QUEUEVIEW, FR-018)

- **Decision**: Replace the 005 two-pane `QueueList` with a **compact `QueuePanel`** that lists the
  pending queue rows with a text preview, per-row status, and a **per-item cost estimate**, plus the
  **queue total** surfaced near the action bar (count badge in the bar, total adjacent). The exact
  placement/styling of the pending list vs. the action-bar summary is **verified against the Figma
  nodes at implementation time** (editor columns `120:223`, action bar `116:57`); the behavioral
  contract (each pending item shows a cost or "unavailable", the total sums estimable items + "+ N
  unavailable") is fixed here.
- **Rationale**: FR-018 requires per-item *and* total estimates before Generate, so pending items must
  be individually represented; the design removed the heavy two-pane list, so a compact list is the
  smallest representation that still carries per-item cost + status for the progress modal to mirror.
- **Alternatives considered**: *Only a count + total in the action bar (no per-item)* — violates
  FR-018's per-item requirement; *keep the full 005 QueueList two-pane* — contradicts FR-003. Rejected.

## R4 — G-DEFAULTS storage: new `app_config` key (FR-011, migration-free)

- **Decision**: Persist configurable Voice/Model/Format/Speed defaults as a JSON blob
  `{ voiceId?, model?, format?, speed? }` under a **new `app_config` key `generation_defaults`**, via a
  new core module `src/core/settings/generation-defaults.ts` that **mirrors `default-tags.ts`**:
  `getGenerationDefaults` / `setGenerationDefaults` (sanitize + clear-on-empty) / `clearGenerationDefaults`.
  Sanitization validates against the existing catalogs (`isKnownVoice`, `isKnownModel`, `isKnownFormat`,
  `normalizeSpeed`), dropping unknown/blank values. Exposed via three routes
  `GET/PUT/DELETE /api/settings/generation-defaults`.
- **Rationale**: The `app_config` repository is a **generic key/value store** (`get/set/delete(key)`),
  already holding `default_tags` — adding one more key is fully **migration-free** and keeps defaults
  resolution in the core (Principle IV, CLI-reachable). Validating against the existing catalogs means a
  hand-edited/stale value can never poison a selector.
- **Alternatives considered**: *New SQLite columns/table* — needs a migration (rejected); *client-only
  localStorage default* — can't sit "alongside Default Tags" as clarified and isn't CLI-reachable
  (rejected); *extend the `default_tags` blob* — conflates unrelated concerns and complicates the
  clear-on-empty semantics (rejected in favor of a separate key).

## R5 — Last-selected persistence + resolution order (FR-012/FR-013)

- **Decision**: Store the per-field **last-selected** Voice/Model/Format/Speed in `localStorage` under
  a new `useViewPreferences` key **`echorecall:viewprefs:genSettings`** (`{ voiceId?, model?, format?,
  speed? }`), following the composable's existing read-merge-sanitize pattern. On page load each field
  resolves as **last-selected → configured default → built-in fallback** (fallbacks:
  `voiceId=''`→first catalog voice, `model='gpt-4o-mini-tts'`, `format='mp3'`, `speed=1`). A per-field
  **reset** clears that field's last-selected and restores the configured default.
- **Rationale**: `useViewPreferences` is the established client-persistence home (queue columns,
  library columns, inspector fields) with SSR-safe fallback; reusing it avoids a new mechanism. The
  resolution order and reset are exactly the G-DEFAULTS clarification.
- **Alternatives considered**: *Persist last-selected server-side* — over-couples ephemeral UI choice
  to shared settings (rejected); *default wins over last-selected* — contradicts the clarification
  (rejected).

## R6 — Generation progress modal + cancel mechanism (FR-014–FR-017, G-CANCEL)

- **Decision**: Extend `useGeneration.generateAll` with (a) a reactive **progress** object
  (`{ total, index, current, succeeded[], failed[] }`) updated per item, and (b) a **`cancelRequested`
  ref checked between items** — before starting each `generateItem`. On Generate, `GenerationProgressModal`
  opens, shows the current file + running succeeded/failed tally, and **disables the rest of the page**
  (backdrop/`inert`). Closing the modal (X / Esc / backdrop) first shows a **confirm** ("cancel the
  remaining run?"); on confirm, `cancelRequested` is set — the in-flight `generateItem` **finishes**
  (it is awaited), then the loop **breaks before the next item**; on decline the run continues. At the
  end the modal shows a **summary** of succeeded / failed / **not-generated** counts. No
  `AbortController`.
- **Rationale**: The loop is already sequential with isolated failures; a between-items flag is the
  smallest addition that yields the clarified **confirm-then-graceful-stop** semantics without
  cancelling (and wasting) the paid in-flight call. "Not-generated" = target items neither `done` nor
  `failed` when the loop broke.
- **Alternatives considered**: *`AbortController` mid-request abort* — discards a paid in-flight call and
  needs request plumbing through `$fetch`/Nitro; contradicts the "finish the in-flight file"
  clarification (rejected). *Immediate close = cancel with no confirm* — contradicts the confirm
  clarification and risks accidental loss of a paid run (rejected).
- **Interaction with the existing remove-on-success (FR-005b, 005)**: successful rows are still removed
  from the queue as they complete (they become library recordings and appear in the embedded table,
  FR-010); the summary counts come from the progress object, not from the surviving queue rows.

## R7 — Cost estimate (G-PRICING, FR-018/FR-019)

- **Decision**: A pure core module `src/core/tts/pricing.ts` exports a hand-maintained per-model
  reference and a pure function `estimateCost(model, charCount): { amountUsd: number } | 'unavailable'`.
  Character-priced models use `USD per 1e6 chars` (`tts-1 ≈ 15`, `tts-1-hd ≈ 30`); token-priced models
  (`gpt-4o-mini-tts`) return **`'unavailable'`**. The client computes per-item estimates from the item's
  **text length** and a **queue total** that sums only the estimable items, appending a **"+ N items
  unavailable"** note when any item is unavailable. USD, sub-cent precision, **display-only** — never
  gates Generate.
- **Rationale**: Estimate logic in the core is unit-testable and CLI-reachable (Principle IV); a pure
  constant + function is the smallest thing meeting FR-018 and avoids fabricating a token-price number.
- **Alternatives considered**: *Client-only constant* — not CLI-reachable, harder to unit-test the char
  math (rejected); *live/runtime pricing* — network + staleness + scope (YAGNI, rejected); *approximate
  `gpt-4o-mini-tts` per-char* — the clarification requires "unavailable", not a guess (rejected).

## R8 — Recording date defaults to today (FR-020) — resolves the 005 clobber

- **Decision**: Remove the `tomorrowIso()` default from `useQueue.makeItem` (stop stamping a date at
  add-to-queue time). Instead, **at generation time**, stamp each target item's `metadata.recordedAt`
  with **`todayIso()` only when it is still empty**, never overwriting a user-set value. Implement in
  the generate flow (a small helper applied to the generate target, alongside/within the existing
  `applyMetadataToPending` path) so the "only when empty" rule is honored per item.
- **Rationale**: Directly implements the FR-020 clarification (generation-day, date-only, only-when-empty)
  and resolves the documented **005 recordedAt clobber** (add-time default then full-replace by
  `applyMetadataToPending`) by not seeding a default at add-time at all.
- **Alternatives considered**: *Keep add-time default, change to today* — still clobbers and dates by add
  day (rejected); *configurable +N-day offset setting* — unrequested scope (YAGNI, rejected).

## R9 — Embedded Library workspace: reuse 006, no player (FR-008/FR-009/FR-010, G-EMBED)

- **Decision**: Embed the **existing 006 Library components** (`LibraryFilterBar`, `LibraryFileTable`,
  `LibraryColumnsDialog`, `BulkTagEditDialog`, `TagInspector`, `InspectorFieldsDialog`,
  `LibraryStatusBar`) fully-functional on the Generate page, driven by the same **`useLibrary`** +
  `useViewPreferences` + `useTagDrafts` state as the Library tab. **`WaveformPlayer.vue` is NOT
  embedded.** After a run, `useLibrary` reloads so new recordings appear (FR-010).
- **Rationale**: The Figma Generate screen lists filter bar `119:66`, file-list+inspector `119:73`,
  status bar `119:251` — **no player node**; the clarification confirms the player stays Library-only.
  Reuse (not rebuild) keeps a single shared data source (FR-009) and satisfies Simplicity/YAGNI.
- **Alternatives considered**: *Include the player* — contradicts the clarification and the design
  (rejected); *read-only preview / rebuilt components* — contradicts G-EMBED "fully-functional reuse"
  (rejected).
- **Note (view-preferences sharing)**: columns/inspector-field prefs are shared between the two
  surfaces by design (same `useViewPreferences` keys) — the same library, same layout choices. No new
  keys are introduced for the embed.

## R10 — Action-bar "Upload .txt batch" (FR-007)

- **Decision**: The action bar's neutral secondary button is **Upload .txt batch**, wired to the
  existing batch-upload path: a file input → read text → `useQueue.addFromUpload(content, filename)`
  (via `useQueueFile`/`parseUploadText`, honoring `MAX_UPLOAD_BYTES` / `MAX_INPUT_LENGTH`). Save queue
  / Load queue reuse `useQueue.serialize` / `loadDocument` + `useQueueFile` unchanged.
- **Rationale**: The clarification fixed this button as Upload .txt; the batch-upload capability already
  exists — the redesign only relocates its trigger into the action bar.
- **Alternatives considered**: *Clear-queue / Add-entry* — superseded by the clarification (rejected).

## R11 — Localization, accessibility, testing (FR-022/FR-023, SC-007)

- **Decision**: All new strings added to `i18n/locales/en.json` + `hu.json` with **parity** (Hungarian
  default). Every new control (script textarea + Clear + Add, the four selects + resets, Save/Load/Upload
  /Generate, the progress modal + cancel-confirm, per-item/total cost) is keyboard-operable and
  AT-labeled, asserted by component tests. `wavesurfer.js` is **not** used here, so no waveform mock is
  needed; existing `@nuxt/ui` component-test strategies (USelectMenu emit trick, UInputNumber clamp,
  UModal `#body` scroll, textarea `@blur` commit, `useColorMode` mock, i18n prewarm) are reused per the
  team's recorded gotchas.
- **Rationale**: Matches the constitution's Test-First + the app's en/hu parity requirement, and reuses
  the established test patterns rather than inventing new ones.
- **Alternatives considered**: none — this is the standing project standard.

## R12 — Figma extraction items deferred to implementation

- **Decision**: Re-extract with the Figma MCP `get_design_context` at implementation time for the exact
  visual details that do not change scope: the **Metadata field grouping/layout** (spec assumes inline,
  non-accordion), the precise **pending-queue vs. action-bar** arrangement (R3), spacing/badges, and the
  page-intro copy. Screen `112-3273` "Generate Tab — Nuxt UI" (1440×1688); sub-nodes app header
  `112:3274` (Account area **omitted**, FR-026), page intro `112:3302`, editor columns `120:223`
  (Script `113:1191`, Gen settings `112:3305`, Metadata `115:39`), action bar `116:57`.
- **Rationale**: These are pixel-level details, not behavioral unknowns; the spec's functional contracts
  are fixed. Extracting at build time (as 006 did) keeps the plan stable and the visuals faithful.
- **Alternatives considered**: *Extract everything now* — heavier, and the behavior is already fixed by
  the spec (deferred).
