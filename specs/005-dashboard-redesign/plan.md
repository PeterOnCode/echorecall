# Implementation Plan: Dashboard Workspace Redesign

**Branch**: `005-dashboard-redesign` | **Date**: 2026-06-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-dashboard-redesign/spec.md`

## Summary

Rework the **Generate** and **Library** surfaces onto a shared, resizable **two-pane
dashboard workspace** (list pane left, detail pane right) driven by a header **toolbar**, and
move **Settings** into a modal. On Generate: the queue list gains search, per-field filters
(voice/format/album/recording-date/language), a multi-select checkbox column, a source column
("uploaded filename" vs "Text Entered"), and a configurable column-visibility dialog; the
detail pane is the per-item metadata editor with a **recording-date picker** defaulting to
tomorrow; the toolbar exposes upload, previous/next item navigation, generate, save queue, open
queue, and open settings. **Generate** processes checked items if any are checked else the whole
queue, and **removes each successfully generated item** from the queue (failed items remain for
retry). Queues are **saved/opened as local files** the user manages (export/import) — no
server storage. On Library: the same two-pane layout (results table left, audio-tags panel
right with previous/next navigation), plus a bottom **waveform player** (zoom + loop regions)
for the selected recording.

**Technical approach — presentation-layer-only, one new runtime dependency.** Nothing under
`src/core/`, `server/`, the ports, or the SQLite schema changes (FR-018). The resizable
workspace, toolbar, modal, table, and date picker are built **entirely from the already-installed
`@nuxt/ui` v4.8.2** design system — `UDashboardGroup`/`UDashboardPanel`/`UDashboardResizeHandle`
for the two-pane resizable layout (with built-in size persistence), `UDashboardToolbar` for the
header actions, `UModal` for Settings + the column-visibility + delete-confirm dialogs, `UTable`
for both lists, and `UPopover`+`UCalendar` for the recording-date picker (the same combo 004
introduced for the Library date-range filter). The **only new technology** is a **waveform
audio library (`wavesurfer.js` v7 + its regions & zoom plugins)** for US6 — there is no
waveform primitive in `@nuxt/ui` and the existing `AudioPlayer.vue` is a bare `<audio>`. A
waveform library is **outside the constitution's Technology Stack list**, so it engages the
governance amendment clause (see Constitution Check). US6 is **P3 and independently testable**,
so US1–US5 (P1/P2) can ship without it; the waveform work is gated behind a constitution
amendment (recommended) or formal Complexity-Tracking acceptance.

Queue selection, source tracking, save/open serialization, and view preferences (split size,
visible columns) are **client-side only** — added to the `app/` composables (`useQueue`, a new
`useQueueFile`, a new `useViewPreferences`), never to the core or server (Principle IV; the spec
explicitly scopes this feature to the web surface). Per Principle II, every affected component
spec is rewritten **red-first** and new behaviors (toolbar navigation, resize, multi-select
delete, filters, source column, column visibility, queue file round-trip, recording-date
default, settings modal, audio-tags navigation, waveform wiring) get failing tests first;
i18n (en/hu) and keyboard/AT accessibility for all new controls are gated by automated tests
(FR-019/FR-020, SC-009).

## Technical Context

**Language/Version**: TypeScript (latest stable, `strict`) on Node.js 22.22.2 (pinned via mise) / Node ≥ 22.6 in Docker. Run native-binary/test commands through `mise exec node@22.22.2 --` (the bash shell defaults to a newer Node than the pin).

**Primary Dependencies**: Nuxt 4 (Vue 3, Nitro, Vite); `@nuxt/ui` **v4.8.2** (already installed) — the dashboard components (`UDashboardGroup`, `UDashboardPanel`, `UDashboardResizeHandle`, `UDashboardToolbar`, `UDashboardNavbar`), `UModal`, `UTable`, `UPopover`, `UCalendar`, `USelectMenu`, `UInput`, `UTextarea`, `UFormField`, `UCheckbox`, `UButton`, `UBadge`, `UPagination` all ship in it; `@nuxtjs/i18n` (en/hu); `@internationalized/date` (already direct dep, for the date picker). **One new direct dependency**: `wavesurfer.js` `^7` (+ its bundled `regions` and `zoom`/minimap plugins) for the US6 waveform player — **new technology choice, pending constitution amendment** (see Constitution Check & Complexity Tracking). No other new libraries.

**Storage**: N/A for server — **no SQLite schema, migration, or server-route change**. New *client-side* persistence only: the dashboard split size (handled by `@nuxt/ui`'s dashboard storage) and the visible-column set (localStorage via a new `useViewPreferences`). Saved queues are **local files the user owns** (browser download/upload of a versioned JSON document) — not stored by the app.

**Testing**: Vitest 4 with `@nuxt/test-utils` over **happy-dom** for component tests (`vitest.nuxt.config.ts`); no live network. Affected specs (`Generate`, `QueueList`, `QueueItemEditor`, `MetadataFields`, `LibraryTable`, `LibraryItemEditor`, `LibrarySearchBar`, `Settings.*`, `AudioPlayer`) are rewritten red-first. New specs cover the toolbar (actions present, prev/next selection + boundaries, generate-target = checked-else-all, remove-on-success), the resize divider, multi-select delete, queue search/filters, source column, column-visibility dialog, queue file export/import round-trip + malformed-import rejection, recording-date default (tomorrow) + picker, the Settings modal, the audio-tags panel prev/next, and the waveform player **with `wavesurfer.js` mocked** (happy-dom cannot render its canvas/WebAudio — mirror the established `useColorMode` mock pattern). i18n parity (en/hu key coverage) and keyboard/AT operability are asserted by automated tests (SC-009).

**Target Platform**: Dockerized Node.js (Nitro) server serving the SSR/SPA browser client; modern evergreen browsers in light/dark mode.

**Project Type**: Web application — Nuxt full-stack (Vue + Nitro) over a shared framework-agnostic core. This feature touches only the Vue presentation layer (`app/`), tests, i18n catalogs, and one new dependency (waveform).

**Performance Goals**: Item selection renders the detail pane in <1s (SC-001); queue search/filter stays responsive at ≥200 items (SC-003); no regression in generation/tagging outcomes (SC-008). Client-side filtering over the in-memory queue is O(n) per keystroke on a ≤ low-thousands list — adequate without virtualization; `UTable` is used as-is.

**Constraints**: Strict TS, no unjustified `any`. **Zero** changes to `src/core/`, `server/`, ports, or schema (Principle IV, FR-018). New client types (queue `source`, view preferences, queue-file document) live in `app/` only — **not** in `src/core/shared/types.ts`. Every existing `data-test` hook is preserved or its consuming test updated in the same change so the suite stays green. Known `nuxt typecheck` gotchas respected: auto-import components (don't import via `~`), import composable types by relative path, narrow `runtimeConfig.public.*` and i18n composer extras locally. No authentication (single-user). All new user-visible strings localized en/hu (FR-019); all new interactive controls keyboard- and AT-operable, test-gated (FR-020).

**Scale/Scope**: 2 surfaces re-laid-out (Generate, Library), Settings → modal, the standalone Settings page/tab removed; ~6 new components (shared `DashboardWorkspace`, `GenerateToolbar`, `AddTextPanel`, `QueueColumnsDialog`, `AudioTagsPanel`, `WaveformPlayer`, `SettingsModal`); ~6 components adapted (`index.vue`, `library.vue`, `layouts/default.vue`, `QueueList`, `MetadataFields`, `LibraryTable`); ~3 composables touched/added (`useQueue` extended, new `useQueueFile`, new `useViewPreferences`); 1 new dependency (waveform); affected component tests rewritten + new specs; i18n keys added en/hu.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against EchoRecall Constitution **v2.5.0**:

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | New SFCs/composables stay strict `<script setup lang="ts">`; queue `source`, the queue-file document, and view preferences are fully typed in `app/`. `wavesurfer.js` ships its own types — no `any`. |
| II. Test-First (NON-NEGOTIABLE) | ✅ PASS | TDD enforced. Affected specs rewritten red-first to the new structure; every new behavior gets a failing test first; the waveform player is tested against a **mocked** `wavesurfer.js` (canvas/WebAudio unavailable in happy-dom). i18n/a11y gates (SC-009) are new failing tests first. No live network. |
| III. Modular Architecture | ✅ PASS | Confined to `app/`. The resizable two-pane shell is a single shared `DashboardWorkspace` consumed by both surfaces (DRY, ≥3-use threshold met: Generate, Library). No presentation→presentation cross-imports; no domain logic added to components. |
| IV. Shared Core, Multiple Interfaces | ✅ PASS | **Zero** changes to `src/core/`, `server/`, Nitro routes, ports, or schema. New client-only concerns (selection, filters, queue file, view prefs) stay in `app/` composables. The waveform library is constrained by the v2.5.0 stack entry to the `app/` web adapter (never `src/core/`/CLI). The "capability reachable from both interfaces" rule is satisfied by the spec's **explicit single-surface scoping** (web only) — the underlying generation/library capabilities remain in the core and unchanged. |
| V. Simplicity & YAGNI | ✅ PASS | The layout/toolbar/modal/table/date-picker add **no new dependency** (reuse installed `@nuxt/ui` dashboard components) — net-neutral. The **one** new dependency, `wavesurfer.js` for the US6 waveform (zoom + loop regions), is now an **approved Technology Stack entry (constitution v2.5.0)**. There is no `@nuxt/ui` waveform primitive and hand-rolling canvas waveform + region interaction would be *more* complex and bespoke, so the library is the simpler path. Isolated to one component (`WaveformPlayer.vue`), mocked in tests. |

**Technology Stack governance gate — RESOLVED.** The waveform library was outside the prior
(v2.4.0) Technology Stack list, which triggered the "technology choices outside this list MUST be
approved as a constitution amendment" clause. The constitution was **amended to v2.5.0
(2026-06-22)** adding an "Audio visualization (web UI)" entry that permits `wavesurfer.js`
(+ regions/zoom plugins) for web-UI waveform display, zoom, and loop-region playback — scoped to
`app/`, never `src/core/`/CLI, display/playback only. **US6 is therefore unblocked**; no further
governance action is required.

**Result**: All five principles PASS against constitution v2.5.0. The single waveform dependency
is now constitution-approved; the Complexity Tracking entry below is retained as a transparency
record of the amendment.

**Constitution Follow-up TODOs status**:
- `TODO(openai-key-handling)` → resolved earlier; unaffected (no key/secret handling here).
- `TODO(test-http-mocking)` → unaffected: this feature makes no new HTTP calls.

## Project Structure

### Documentation (this feature)

```text
specs/005-dashboard-redesign/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output — layout/persistence/waveform/queue-file decisions
├── data-model.md        # Phase 1 output — client entities & queue-file schema
├── quickstart.md        # Phase 1 output — validation/run guide
├── contracts/
│   └── ui-contracts.md  # Phase 1 output — component props/emits/v-model/data-test/keyboard contracts
├── checklists/
│   └── requirements.md  # from /speckit-specify + /speckit-clarify
├── spec.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
app/
├── pages/
│   ├── index.vue                      # ADAPT: Generate → DashboardWorkspace (QueueList | metadata editor) + GenerateToolbar; wires useQueue/useGeneration/useQueueFile  [US1/US2/US4]
│   ├── library.vue                    # ADAPT: Library → DashboardWorkspace (LibraryTable | AudioTagsPanel) + WaveformPlayer footer  [US5/US6]
│   └── settings.vue                   # REMOVE: standalone Settings page deleted; Settings now a modal (FR-017)  [US7]
├── layouts/
│   └── default.vue                    # ADAPT: tab nav drops "Settings" (Generate | Library only); Settings opens via toolbar modal  [US7]
├── components/
│   ├── common/
│   │   └── AppHeader.vue              # ADAPT: hosts the dashboard toolbar slot / settings trigger as needed
│   ├── dashboard/
│   │   └── DashboardWorkspace.vue     # NEW: shared resizable two-pane shell (UDashboardGroup/UDashboardPanel/UDashboardResizeHandle); #list + #detail slots; size persisted  [US1]
│   ├── generate/
│   │   ├── GenerateToolbar.vue        # NEW: UDashboardToolbar — upload, prev, next, generate, save queue, open queue, open settings  [US2]
│   │   ├── AddTextPanel.vue           # NEW: single ad-hoc text → queue (rejects empty)  [US4]
│   │   ├── QueueList.vue              # ADAPT: UTable list pane — checkbox select column, source column, search, filters, column-visibility trigger  [US1/US3]
│   │   ├── QueueColumnsDialog.vue     # NEW: UModal column-visibility chooser (prevents hiding all)  [US3]
│   │   ├── MetadataFields.vue         # ADAPT: recordedAt → UPopover+UCalendar date picker, default tomorrow  [US1]
│   │   ├── QueueItemEditor.vue        # ADAPT: detail-pane editor for the selected queue item (keep @blur commit)  [US1]
│   │   └── UploadDropzone.vue         # KEEP: upload entry now triggered from toolbar; tags source='upload'+filename
│   ├── library/
│   │   ├── LibraryTable.vue           # ADAPT: becomes the list pane (selectable rows drive the detail pane; row-expansion removed in favor of side panel)  [US5]
│   │   ├── AudioTagsPanel.vue         # NEW: detail pane — tags editor (reuses LibraryItemEditor) + prev/next navigation  [US5]
│   │   ├── LibraryItemEditor.vue      # ADAPT: rendered inside AudioTagsPanel (not inline row)
│   │   ├── LibrarySearchBar.vue       # ADAPT: search/filter controls relocated above the table list pane
│   │   ├── WaveformPlayer.vue         # NEW: wavesurfer.js waveform + zoom + loop regions for the selected recording  [US6]
│   │   └── BulkCleanDialog.vue        # KEEP: unchanged (already UModal-based)
│   ├── settings/
│   │   ├── SettingsModal.vue          # NEW: UModal wrapping Appearance/Language/OpenAiKey/DefaultTags sections  [US7]
│   │   ├── AppearanceSettings.vue     # KEEP
│   │   ├── LanguageSettings.vue       # KEEP
│   │   ├── OpenAiKeySettings.vue      # KEEP
│   │   └── DefaultTagsSettings.vue    # KEEP
│   └── AudioPlayer.vue                # KEEP: bare <audio>, still used where a waveform is unnecessary
├── composables/
│   ├── useQueue.ts                    # ADAPT: add `source`/`sourceName`, selection (checkedIds), removeMany, client-side filters/search, serialize/deserialize  [US1/US3]
│   ├── useQueueFile.ts                # NEW: export queue → local JSON file; import + validate (versioned)  [US2]
│   ├── useViewPreferences.ts          # NEW: persist visible columns (localStorage); split size handled by @nuxt/ui dashboard storage  [US3]
│   ├── useGeneration.ts              # ADAPT: generate checked-else-all; remove successfully-generated items from the queue  [US2]
│   └── useLibrary.ts                  # KEEP: query/load/update/remove/bulkClean unchanged (no server change)

tests/
├── component/                         # rewrite affected specs red-first + new specs (toolbar, workspace, columns dialog, settings modal, audio-tags panel, waveform[mocked], date picker)
├── integration/                       # queue file export/import round-trip; generate→remove-on-success flow
└── unit/                              # useQueueFile (serialize/validate), useViewPreferences, queue filter/select helpers

i18n/locales/
├── en.json                            # ADD keys: toolbar actions, column names, filters, source labels, dialogs, waveform, settings modal
└── hu.json                            # ADD matching Hungarian keys (parity required, FR-019)
```

**Structure Decision**: Single Nuxt web app over the shared core. All work lives in `app/`
(presentation), `tests/`, and `i18n/`, plus one new runtime dependency for the waveform. A
**shared `DashboardWorkspace`** component supplies the resizable two-pane shell to both the
Generate and Library surfaces (Principle III; the ≥3-use abstraction threshold is met by its two
surface consumers plus the layout). No `src/core/`, `server/`, port, or schema files are touched
(Principle IV, FR-018).

## Complexity Tracking

> Filled because Constitution Check has a CONDITIONAL item (Principle V / Technology Stack gate).

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New runtime dependency `wavesurfer.js` (+ regions/zoom plugins) — **resolved**: now an approved Technology Stack entry (constitution v2.5.0, 2026-06-22) | FR-016 (US6) requires a waveform with zoom and loop regions; `@nuxt/ui` has no waveform primitive and the existing `AudioPlayer.vue` is a bare `<audio>` element | Hand-rolling waveform rendering + region/zoom interaction on `<canvas>`/WebAudio would add substantially more bespoke, less-tested code than adopting the de-facto library (violates YAGNI in the opposite direction). Mitigation: dependency is isolated to one component (`WaveformPlayer.vue`), mocked in tests, and constrained by the v2.5.0 stack entry to `app/` (never `src/core/`/CLI). **Resolution applied: constitution amended to v2.5.0** adding an audio-visualization library to the stack. |
