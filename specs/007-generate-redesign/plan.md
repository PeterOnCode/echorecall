# Implementation Plan: Generate Tab Redesign (Figma) + Generation-Flow Enhancements

**Branch**: `007-generate-redesign` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-generate-redesign/spec.md`

> **Implemented-plan amendment (2026-07-19):** The post-implementation amendment in
> [spec.md](./spec.md) is authoritative. The shipped page is a focused queue builder at `/generate`
> (`/` redirects), with two top editor columns plus a full-width configurable Metadata row and no
> embedded Library. Speed is fixed at 1× and is absent from defaults/preferences. Title/Track are
> derived; queue selection, bulk actions, reorder, and first-track configuration were added.
> `gpt-4o-mini-tts` uses an approximate duration/token estimate. Recording dates are retained only
> after successful per-item attempts. Historical design detail below documents the original plan
> and is superseded wherever it conflicts with this amendment.

## Summary

Rebuild the **Generate** surface to match the Figma **"Generate Tab — Nuxt UI"** design — the same
way 006 rebuilt Library. It becomes a **single scrolling page** (page intro → three-column
generation editor → generation action bar → embedded Library-style workspace → status bar),
replacing the 005 two-pane `QueueList` + metadata editor. Built at a **parallel route**
(`/generate-next`) so today's Generate page (`/`, `app/pages/index.vue`) keeps working untouched,
then swapped in and the old page/components deleted as a final step (FR-001/FR-002). Accent stays
the app's existing `indigo` primary — never the Figma kit's green (FR-021).

The **upper editor** is three columns: **Script entry** (title + badge, textarea, Clear, character
hint, Add to queue), **Generation settings** (Voice / Model / Format / Speed — reusing the existing
`VOICES`/`MODELS`/`FORMATS` catalogs and the numeric speed control), and **Metadata** (Title /
Artist / Album / Genre / Language / Recording date, reusing `MetadataFields.vue`), followed by a
**generation action bar** (queue summary + count badge + **Save queue / Load queue / Upload .txt
batch / Generate**). The **lower workspace** embeds the **fully-functional 006 Library components**
(filter bar, file table + Configure Columns, Tag Editor inspector + Configure Visible Fields +
show/hide, status bar) over the same `useLibrary` data — **without** the 006 waveform player, which
stays exclusive to the Library tab (Clarifications, decision G-EMBED).

Layered on top are four **generation-flow enhancements** the design invites:

1. **G-DEFAULTS** — persisted per-field **defaults** for Voice/Model/Format/Speed, server-side
   alongside the existing Default Tags, plus a per-field **last-selected** value in `localStorage`.
   Resolution order on load: last-selected → configured default → built-in fallback; per-field
   reset restores the configured default.
2. **G-CANCEL** — a **generation progress modal** (current file, per-file succeeded/failed, page
   disabled while open) whose close **confirms then gracefully stops** the run (finish the in-flight
   file, stop before the next), with a succeeded/failed/not-generated summary.
3. **Per-item cost estimate + queue total** — a per-item price from model + text size and a queue
   total; token-priced models (`gpt-4o-mini-tts`) show **"unavailable"**; the total sums only
   estimable items and shows a "+ N items unavailable" note. Display-only, never blocks Generate.
4. **Recording date → today** — the recording date defaults to the **generation day** (date-only),
   snapshotted **at generation time, only when still empty** — replacing `useQueue`'s
   `tomorrowIso()` add-time default (resolving the long-standing 005 recordedAt clobber).

**Technical approach — presentation-layer-first, plus three additive, migration-free core touches.**
Most work lands in `app/` (Vue components, composables, i18n) on the already-installed `@nuxt/ui`
v4.8.2 primitives. **No new technology** is introduced (this feature has no waveform player, so it
does not even use `wavesurfer.js`), and **no governance gate is engaged**. Three deliberate core
touches — all additive, all **migration-free**, none altering generation behavior — keep domain
logic in the shared core (Principle IV) so a future CLI inherits them:

1. **G-DEFAULTS** — a new core module `src/core/settings/generation-defaults.ts` storing a
   `{ voiceId?, model?, format?, speed? }` JSON blob under a **new `app_config` key**
   (`generation_defaults`), sanitized against the existing catalogs (`isKnownVoice`/`isKnownModel`/
   `isKnownFormat`/`normalizeSpeed`), exposed via three new `/api/settings/generation-defaults`
   routes. Mirrors the existing `default-tags.ts` pattern exactly — the `app_config` store is a
   generic key/value table, so **no SQL column or migration** is added.
2. **G-PRICING** — a pure, dependency-free core module `src/core/tts/pricing.ts` mapping
   `(model, charCount) → { amountUsd } | 'unavailable'` from a hand-maintained per-model reference,
   consumed by the client for the per-item/total estimate. No storage, no route, no generation
   change — pure logic placed in the core so the estimate is unit-testable and CLI-reachable.
3. **Recording-date-today** — a client-only change to `useQueue`/the generate flow (drop the
   `tomorrowIso()` default; stamp `todayIso()` at generation time only when empty). No core/server
   change.

The embedded Library workspace reuses **006's already-shipped, already-justified** core surface
(R-FILTER query, R-TAGS tag mapping, R-AUDIOPROPS audio properties) through the existing
`useLibrary`/`LibraryService` — this feature adds **nothing** to those.

Per Principle II every new/forked component and the two new core modules are built **red-first**:
failing tests first for the script-entry panel, generation-settings panel (with per-field reset +
resolution order), the action bar (Save/Load/Upload .txt/Generate + count badge), the queue panel
(per-item cost + status), the progress modal (progress display, confirm-then-stop cancel, summary),
the cost total ("+ N unavailable"), the recording-date-today stamping, and the Settings
generation-defaults section; plus core unit tests for `generation-defaults` (sanitize/round-trip)
and `pricing` (per-model estimate + "unavailable"). The embedded 006 components keep their existing
tests; a thin integration test proves they render and operate on the Generate page over shared
data. i18n (en/hu) parity and keyboard/AT operability for every new control are test-gated
(FR-022/FR-023, SC-007).

## Technical Context

**Language/Version**: TypeScript (latest stable, `strict`) on Node.js 22.22.2 (pinned via mise). Run native-binary/test commands through `mise exec node@22.22.2 --` (the bash shell defaults to a newer Node than the pin).

**Primary Dependencies**: Nuxt 4 (Vue 3, Nitro, Vite); `@nuxt/ui` **v4.8.2** (already installed) — `UModal`, `UTable`, `USelectMenu`, `UInput`, `UInputNumber`, `UTextarea`, `UFormField`, `UButton`, `UBadge`, `UProgress`, `UFileUpload`/native file input (existing upload path), plus the 006 Library components as-is; `@nuxtjs/i18n` (en/hu, Hungarian default). **No new runtime dependency.** `wavesurfer.js` is **not** used by this feature (no player in the Generate embed).

**Storage**: **No SQLite schema, migration, or new table.** G-DEFAULTS adds one **new key** (`generation_defaults`) to the existing generic `app_config` key/value store (same mechanism as `default_tags`); G-PRICING persists nothing (pure compute); recording-date-today is client-only. New *client-side* persistence: the per-field **last-selected** Voice/Model/Format/Speed values in `localStorage` (`echorecall:viewprefs:genSettings`) via an extended `useViewPreferences`. Generated recordings and their tags flow through the unchanged generation/library paths.

**Testing**: Vitest 4 with `@nuxt/test-utils` over **happy-dom** for component tests (`vitest.nuxt.config.ts`); core/repository unit tests run in the node project. No live network — generation and settings routes are exercised against mocked `$fetch`/in-memory `app_config`. New/forked component specs are written red-first. Core unit tests cover `generation-defaults` (sanitize, clear-on-empty, round-trip) and `pricing` (per-model estimate, char-count math, "unavailable" for token-priced models). i18n parity (en/hu key coverage) and keyboard/AT operability are asserted by automated tests (SC-007).

**Target Platform**: Dockerized Node.js (Nitro) server serving the SSR/SPA browser client; modern evergreen browsers in light/dark mode.

**Project Type**: Web application — Nuxt full-stack (Vue + Nitro) over a shared framework-agnostic core. This feature is Generate-only (FR-024/FR-026) plus the embedded reuse of the Library workspace; it touches the Vue presentation layer (`app/`), tests, i18n, two additive core modules, and three additive settings routes.

**Performance Goals**: Build-an-item-and-generate stays on one scrolling page with no tab/page change (SC-001); Voice/Model/Format/Speed restore to last-selected/default on revisit ≥95% (SC-002); a confirmed cancel keeps every generated file and reports every remaining item as not-generated (SC-003); the editor, action bar, per-item cost rendering, and progress modal stay responsive with a **queue of up to 100 items** (SC-011); no regression in generation outcomes vs. the pre-redesign Generate (SC-008, apart from the intended recording-date default).

**Constraints**: Strict TS, no unjustified `any`. Core touches are limited to two **additive** modules (`generation-defaults.ts`, `pricing.ts`) plus their export wiring and three settings routes — **zero** change to the TTS engine, the audio-tag schema, storage layout, or generation behavior (FR-024/FR-025). The embedded Library workspace adds nothing to 006's core surface. Known `nuxt typecheck` gotchas respected: auto-import components (don't import via `~`), import composable types by relative path, narrow `runtimeConfig.public.*` and i18n composer extras locally, cast `useI18n().setLocale/locales` locally. Single-user (no auth; the Figma Account/credits area is omitted, FR-026). All new user-visible strings localized en/hu (FR-022); all new interactive controls keyboard- and AT-operable, test-gated (FR-023).

**Scale/Scope**: 1 surface rebuilt at a parallel route then cut over. ~6 new Generate components (`ScriptEntryPanel`, `GenerationSettingsPanel`, `GenerationActionBar`, `QueuePanel`, `GenerationProgressModal`, `generate-next.vue` page) forking from the 005 Generate set (`AddTextPanel`/`GenerateForm`/`GenerateToolbar`/`QueueList`/`QueueColumnsDialog`), plus `MetadataFields` reused; the 8 006 Library components reused as-is (no player); 1 new Settings section (`GenerationDefaultsSettings`); 2 adapted + 1 new composable (`useGeneration` progress/cancel, `useQueue` defaults+cost+date, new `useGenerationDefaults`, `useViewPreferences` last-selected); 2 new core modules + 3 settings routes; new + forked component tests and core unit tests; i18n keys en/hu.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against EchoRecall Constitution **v2.5.0**:

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | New SFCs/composables stay strict `<script setup lang="ts">`. The generation-defaults blob, last-selected view-pref, cost-estimate shape, and progress/cancel state are fully typed in `app/`; `generation-defaults.ts` and `pricing.ts` carry full signatures in `src/core/`. No `any`. |
| II. Test-First (NON-NEGOTIABLE) | ✅ PASS | TDD enforced. New/forked component specs written red-first; the two core modules get failing unit tests first (generation-defaults sanitize/round-trip/clear; pricing per-model estimate + "unavailable"); progress/cancel, cost-total, recording-date-today, and i18n/a11y gates (SC-007) are new failing tests first. No live network. |
| III. Modular Architecture | ✅ PASS | Confined to `app/` + two additive core modules + three settings routes. The Generate editor forks the 005 Generate components; the lower workspace **reuses** the 006 Library components (≥3-use threshold long met) with no presentation→presentation cross-imports. Cost/estimate and defaults **domain logic lives in the core**, not the Vue layer. |
| IV. Shared Core, Multiple Interfaces | ✅ PASS | G-DEFAULTS (generation-defaults resolution/sanitization) and G-PRICING (cost estimate) live **in the core**, reusing the existing `app_config` store and catalogs — **reachable from a future CLI** for free, strengthening Principle IV. Both are migration-free; generation behavior untouched. `wavesurfer.js` is not used here. |
| V. Simplicity & YAGNI | ✅ PASS | No new dependency. G-DEFAULTS reuses the generic `app_config` key/value store + the `default-tags.ts` pattern (rather than a new table); G-PRICING is one pure function over a hand-maintained constant (rather than a runtime pricing service); last-selected reuses `useViewPreferences`; the embed reuses 006 wholesale. Recording-date-today is a one-line default swap. Rejected alternatives (client-only pricing, per-field SQL columns, `AbortController` cancel, rebuilding the Library workspace) were heavier or broke the no-migration / reuse guard (see research). |

**Technology Stack governance gate — NOT engaged.** This feature adds **no** technology outside the
approved stack (it introduces no dependency and does not use the waveform library). No amendment or
Complexity-Tracking governance action is required.

**Result**: All five principles PASS against constitution v2.5.0. The two additive core modules
(G-DEFAULTS `generation-defaults`, G-PRICING `pricing`) and the client-only recording-date-today
change are spec-justified (FR-011–FR-013 / FR-018–FR-019 / FR-020, FR-024/FR-025), migration-free,
and recorded in Complexity Tracking as transparency notes.

**Post-Design Re-check (after Phase 1)**: Re-evaluated against the generated `research.md` /
`data-model.md` / `contracts/`. No new violation surfaced. The design confirms the two core touches are
additive and migration-free (G-DEFAULTS = one new `app_config` key mirroring `default-tags.ts`;
G-PRICING = a pure function over a constant), the embed reuses 006 unchanged, and no new technology is
introduced. **All five principles still PASS**; the gate holds.

**Constitution Follow-up TODOs status**:
- `TODO(test-http-mocking)` → unaffected: this feature makes no new outbound HTTP calls (it reuses existing same-origin Nitro routes and adds three same-origin settings routes).

## Project Structure

### Documentation (this feature)

```text
specs/007-generate-redesign/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output — route/cutover, single-scroll layout, queue view, G-DEFAULTS storage, last-selected, progress+cancel, cost estimate, recording-date-today, 006 reuse
├── data-model.md        # Phase 1 output — client entities, generation-defaults blob, last-selected view-pref, cost-estimate + pricing, progress/cancel state
├── quickstart.md        # Phase 1 output — validation/run guide
├── contracts/
│   └── ui-contracts.md  # Phase 1 output — component props/emits/v-model/data-test/keyboard contracts + the generation-defaults route contract + pricing contract
├── checklists/
│   └── requirements.md  # from /speckit-specify + /speckit-clarify
├── spec.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
app/
├── pages/
│   ├── generate-next.vue               # NEW: parallel Generate route; wires useQueue (extended) + useGeneration (progress/cancel) + useGenerationDefaults + useLibrary into the new layout  [US1..US6, FR-001]
│   └── index.vue                       # KEEP until cutover, then DELETE/REPLACE; the new surface takes over `/` and nav repoints  [FR-002]
├── components/
│   ├── generate/
│   │   ├── ScriptEntryPanel.vue        # NEW (forks AddTextPanel): title+badge, textarea, Clear, character hint, Add to queue  [US1/FR-004]
│   │   ├── GenerationSettingsPanel.vue # NEW (forks GenerateForm): Voice/Model/Format/Speed selects + per-field reset; resolves last-selected→default→fallback  [US1/US3/FR-005/FR-011-013]
│   │   ├── MetadataFields.vue          # REUSE: Title/Artist/Album/Genre/Language/Recording date inputs  [US1/FR-006]
│   │   ├── GenerationActionBar.vue     # NEW (forks GenerateToolbar): queue summary + count badge + Save queue / Load queue / Upload .txt batch / Generate  [US1/FR-007]
│   │   ├── QueuePanel.vue              # NEW (replaces QueueList): compact pending-item list with per-item cost + status (no two-pane split)  [US1/US5/FR-018]
│   │   ├── QueueColumnsDialog.vue      # KEEP or fold into QueuePanel as needed (queue column visibility)  [US1]
│   │   └── GenerationProgressModal.vue # NEW: current file, per-file succeeded/failed, page-disable, confirm-then-stop cancel, summary  [US4/FR-014-017]
│   ├── library/                        # REUSE (all as-is, fully functional, NO player):
│   │   ├── LibraryFilterBar.vue        #   filter bar  [US2]
│   │   ├── LibraryFileTable.vue        #   multi-select + sortable + Configure Columns + show/hide-inspector  [US2]
│   │   ├── LibraryColumnsDialog.vue    #   [US2]
│   │   ├── BulkTagEditDialog.vue       #   [US2]
│   │   ├── TagInspector.vue            #   Tag Editor (ID3v2.4) inspector + Save + dirty buffer  [US2]
│   │   ├── InspectorFieldsDialog.vue   #   [US2]
│   │   ├── LibraryStatusBar.vue        #   [US2]
│   │   └── (WaveformPlayer.vue)        #   NOT embedded on Generate — stays Library-only  [FR-008]
│   └── settings/
│       ├── GenerationDefaultsSettings.vue # NEW: Voice/Model/Format/Speed defaults + per-field reset  [US3/FR-011-013]
│       └── SettingsModal.vue           # ADAPT: mount the new generation-defaults section beside Default Tags  [US3]
├── composables/
│   ├── useQueue.ts                     # ADAPT: resolve Voice/Model/Format/Speed from useGenerationDefaults + last-selected; drop tomorrowIso() default; stamp todayIso() at generate when empty; derive per-item cost via core pricing  [US3/US5/US6/FR-011-013/FR-018/FR-020]
│   ├── useGeneration.ts                # ADAPT: add reactive progress (current item, succeeded/failed) + cancelRequested flag checked between items in generateAll; report not-generated  [US4/FR-014-017]
│   ├── useGenerationDefaults.ts        # NEW: load/save/clear generation defaults via /api/settings/generation-defaults; expose resolved values + per-field reset  [US3/FR-011-013]
│   ├── useViewPreferences.ts           # ADAPT: add last-selected genSettings ({voiceId,model,format,speed}) in localStorage  [US3/FR-012-013]
│   ├── useQueueFile.ts                 # REUSE: .txt batch parse/serialize for Save/Load/Upload  [US1/FR-007]
│   └── useLibrary.ts                   # REUSE: 006 library data/actions for the embedded workspace  [US2]

src/core/
├── settings/
│   ├── generation-defaults.ts          # NEW (G-DEFAULTS): get/set/clear a {voiceId?,model?,format?,speed?} blob under app_config key `generation_defaults`; sanitize vs catalogs; clear-on-empty  [US3]
│   ├── default-tags.ts                 # REFERENCE: pattern mirrored (unchanged)
│   └── app-config-repository.ts        # REUSE: generic key/value store (unchanged)
├── tts/
│   ├── pricing.ts                      # NEW (G-PRICING): pure (model, charCount) → { amountUsd } | 'unavailable' from a hand-maintained per-model table  [US5]
│   └── provider.ts                     # REFERENCE: VOICES/MODELS/FORMATS catalogs + isKnown*/normalizeSpeed reused for validation (unchanged)
└── index.ts                            # ADAPT: export generation-defaults fns + pricing fn/type + the config key

server/api/settings/
├── generation-defaults.get.ts          # NEW: read saved generation defaults  [US3]
├── generation-defaults.put.ts          # NEW: save (replace) generation defaults; empty ≡ clear  [US3]
└── generation-defaults.delete.ts       # NEW: clear generation defaults  [US3]

tests/
├── component/                          # NEW/forked specs: script-entry panel, generation-settings panel (reset + resolution order), action bar (Save/Load/Upload .txt/Generate + badge), queue panel (per-item cost + status), progress modal (progress, confirm-then-stop, summary), generation-defaults settings section; embed render/operate smoke
├── integration/                        # progress+cancel run (finish in-flight, stop, summary), Upload .txt populate, recording-date-today at generate, embedded workspace operates on shared library data, parallel-route render
└── unit/                               # core: generation-defaults (sanitize/round-trip/clear); pricing (per-model estimate, char math, unavailable); useViewPreferences (genSettings last-selected); useQueue (default resolution + date stamping + cost)

i18n/locales/
├── en.json                             # ADD keys: page intro, script panel, generation settings + reset, action bar (Save/Load/Upload .txt/Generate), queue summary + per-item/total cost + "unavailable"/"+N unavailable", progress modal + cancel-confirm + summary, generation-defaults settings section
└── hu.json                             # ADD matching Hungarian keys (parity required, FR-022)
```

**Structure Decision**: Single Nuxt web app over the shared core. The bulk of the work is in
`app/` (presentation), `tests/`, and `i18n/`. The Generate editor **forks** the 005 Generate
components; the lower workspace **reuses** the 006 Library components wholesale (no waveform
player). The core touches are **two additive modules** — G-DEFAULTS (`generation-defaults.ts`, a new
`app_config` key) and G-PRICING (`pricing.ts`, a pure function) — placed in the core where defaults
and estimate logic belong (Principle IV), plus three additive same-origin settings routes. No
TTS-engine, audio-tag-schema, storage-layout, or generation files are changed (FR-024/FR-025), and
006's core surface is reused untouched.

## Complexity Tracking

> Records the additive core touches (all user-clarified, all migration-free — no constitution violation; all five principles PASS).

| Item | Why Needed | Simpler Alternative Rejected Because |
|------|------------|--------------------------------------|
| **G-DEFAULTS** — new `generation-defaults.ts` core module + `app_config` key `generation_defaults` + three `/api/settings/generation-defaults` routes | FR-011–FR-013 require Voice/Model/Format/Speed **configurable defaults persisted server-side alongside Default Tags** (per the G-DEFAULTS clarification), reachable independently of any one client | **Client-only defaults** can't be shared/configured "alongside Default Tags" as clarified and aren't CLI-reachable (weakens Principle IV). **New SQL columns/table** needs a migration. The generic `app_config` key/value store **already exists** and already holds `default_tags` — one more JSON key mirrors it exactly: full fidelity, **no migration**, logic in the core. |
| **G-PRICING** — new pure `pricing.ts` core module (per-model reference + `(model,charCount)→estimate\|'unavailable'`) | FR-018/FR-019 need a per-item + total cost estimate before Generate; `gpt-4o-mini-tts` is token-priced and must read "unavailable" | **Client-only constant** hides estimate logic from a future CLI and from unit tests of the char-count math (weakens Principle IV/II). **A runtime pricing lookup/service** is premature (YAGNI) and adds network + staleness. A **pure core function over a hand-maintained table** is smallest, unit-testable, CLI-reachable, and persists nothing. |
| **Recording-date-today** — client-only swap of `useQueue`'s `tomorrowIso()` add-time default for `todayIso()` stamped at generation time, only when empty | FR-020 corrects the recording-date default to the generation day without overwriting user-set dates; also resolves the known 005 clobber (default set at add-time then full-replaced by `applyMetadataToPending`) | **Keep add-time default** perpetuates the clobber and dates items by add day, not generation day. **A configurable offset setting** is unrequested scope (YAGNI). Stamping at generation only when empty is the smallest correct change and needs no core/server touch. |
