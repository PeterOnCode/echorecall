# Implementation Plan: Nuxt UI Component Migration

**Branch**: `004-nuxt-ui-migration` | **Date**: 2026-06-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-nuxt-ui-migration/spec.md`

## Summary

Replace the remaining hand-written HTML controls on the Generate, Library, and Settings
surfaces with the already-installed `@nuxt/ui` v4 design-system components, so the whole app
looks consistent, respects light/dark mode, and behaves identically — with the two
clarified exceptions (2026-06-21): the Library date-range filters become a **design-system
date picker** (calendar UX, identical resulting filter values), and the Library results
table is rebuilt on the **design-system data table** (reproducing inline expandable
player/editor rows and server-driven sort). Delivery is **one combined change**; the
P1/P2/P3 priorities are build order, not separate releases.

Technical approach: this is a **presentation-layer-only** migration. Nothing under
`src/core/`, `server/`, or the ports changes. Each raw control maps to its design-system
equivalent (`<input>`→`UInput`/`UInputNumber`, `<select>`→`USelectMenu`,
`<textarea>`→`UTextarea`, `<label>` wrapper→`UFormField`), the two bespoke modals
(`ConfirmDialog`, `BulkCleanDialog`) collapse onto `UModal` (which supplies the focus trap,
Escape handling, and focus return that are currently hand-rolled — and fixes the
hardcoded-`#fff` dark-mode defect), the Library table becomes `UTable`, and the date filters
become `UPopover`+`UCalendar` (range). The date-mapping helpers need
`@internationalized/date`, which is **already in the tree** as `@nuxt/ui`'s own dependency
(`3.12.2`) and is promoted to a direct dependency at the same version for a stable typed
import. Per Principle II, affected component tests are updated **red-first** to the new
structure/selectors, and new automated tests cover the dark-mode/overlay-focus criteria the
current suite doesn't (SC-002, SC-004 — "automated only" per the clarification). The unused
`LibraryList.vue` is removed rather than migrated (YAGNI).

## Technical Context

**Language/Version**: TypeScript (latest stable, `strict`) on Node.js 22.22.2 (pinned via mise) / Node ≥ 22.6 in Docker. Run native-binary/test commands through `mise exec node@22.22.2 --` (the bash shell defaults to a newer Node than the pin).

**Primary Dependencies**: Nuxt 4 (Vue 3, Nitro, Vite); `@nuxt/ui` **v4.8.2** (already installed, 002); Tailwind CSS v4; `@nuxtjs/i18n` (en/hu). **One direct dependency added**: `@internationalized/date` `^3.12.2` — already present transitively under `@nuxt/ui@4.8.2`; promoted to a direct dep so app code can import `CalendarDate`/date helpers for the date-picker mapping without relying on pnpm hoisting. **No new UI library** — all target components (`UTable`, `UModal`, `UCalendar`, `UPopover`, `UFileUpload`, `UInputTags`, `UInputNumber`, `USelectMenu`, `UFormField`, `UTextarea`, `UInput`, `UBadge`) ship in the installed `@nuxt/ui`.

**Storage**: N/A — no data-model, persistence, schema, or server-route change. Presentation only.

**Testing**: Vitest 4 with `@nuxt/test-utils` over **happy-dom** for component tests (`vitest.nuxt.config.ts`); no live network. Affected component specs (`LibraryTable`, `BulkCleanDialog`, `LibraryItemEditor`, `QueueItemEditor`, `DefaultTags*`, `MetadataFields`, `Generate`, `QueueList`) are rewritten red-first to the new component structure. New automated coverage is added for the UModal-based confirm overlay (open/teleport, Escape→cancel, focus trap + focus-return) and for theme correctness (migrated overlays render via the design-system overlay with no bespoke hardcoded-color panel). `useColorMode` is mocked in component tests (known happy-dom crash) via `mockNuxtImport`.

**Target Platform**: Dockerized Node.js (Nitro) server serving the SSR/SPA browser client; modern evergreen browsers in light/dark mode.

**Project Type**: Web application — Nuxt full-stack (Vue + Nitro) over a shared framework-agnostic core. This feature touches only the Vue presentation layer (`app/`) plus tests, one dependency, and any minimal i18n additions.

**Performance Goals**: No regression in perceived responsiveness (SC-005). Design-system components are already used elsewhere in the app, so no new bundle category is introduced beyond `UCalendar`/`@internationalized/date` (already in the tree). No added network or interaction latency.

**Constraints**: Strict TS, no unjustified `any` (calendar↔ISO mapping is typed via `@internationalized/date`). Zero changes to `src/core/`, `server/`, or ports (Principle IV). Every existing `data-test` hook is preserved **or** its consuming test is updated in the same change (FR-006) so the full suite stays green. Behavior is preserved except the date-picker interaction (FR-011). Known `nuxt typecheck` gotchas respected: auto-import components (don't import via `~`), import composable types by relative path, narrow `runtimeConfig.public.*` and i18n composer extras locally. No authentication (single-user, presentation-only).

**Scale/Scope**: ~10 components migrated, 2 bespoke modals collapsed onto `UModal`, 1 dead component removed, 1 direct dependency added, affected component tests rewritten + a small number of new theme/focus tests, optional minimal i18n keys (date-picker placeholder/clear). No core, server, data, or contract changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against EchoRecall Constitution **v2.4.0**:

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All migrated SFCs stay strict `<script setup lang="ts">`; props/emits/v-model types are unchanged. The only new typing is the date-picker mapping (`CalendarDate` ↔ existing ISO local-day bounds) via `@internationalized/date` — fully typed, no `any`. |
| II. Test-First (NON-NEGOTIABLE) | ✅ PASS | TDD enforced. Component swaps change structure/selectors, so the affected `@nuxt/test-utils` specs are rewritten **red-first** to the new components before implementation; new behaviors (date picker, `UTable` expand/sort) get failing tests first. SC-002/SC-004 ("automated only") add new failing tests for overlay focus/Escape/focus-return and design-system-overlay rendering. No live network. |
| III. Modular Architecture | ✅ PASS | Changes are confined to the `app/` presentation layer. No new cross-module or presentation→presentation imports. The local-day→UTC-bound mapping already lives in the Vue components as input translation (not domain logic) and stays there. |
| IV. Shared Core, Multiple Interfaces | ✅ PASS | **Zero** changes to `src/core/`, `server/`, Nitro routes, or ports. No domain logic is added to components. Feature parity is unaffected — this is a like-for-like UI re-skin of an existing web surface. |
| V. Simplicity & YAGNI | ✅ PASS | No new UI library or abstraction; bespoke focus-trap/modal/`<style>` code is **deleted** in favor of `UModal` (net simplification). Dead `LibraryList.vue` is removed, not migrated. The single dependency add (`@internationalized/date`) is not a new technology choice — it is `@nuxt/ui`'s own calendar dependency, already in the tree, promoted to a direct dep for a stable import (recorded in Complexity Tracking for transparency). |

**Result**: All five core principles PASS. **No new UI technology** is introduced —
`@nuxt/ui` v4 was approved/added in 002, and `@internationalized/date` is its calendar
sub-dependency. The Technology Stack governance clause (amendment for choices "outside this
list") is therefore **not** engaged; no constitution amendment is required.

**Post-Design Re-check (after Phase 1)**: Re-evaluated after `research.md`,
`data-model.md`, `contracts/ui-contracts.md`, and `quickstart.md` were written. No new
dependency, abstraction, core/server change, or domain-logic leak was introduced by the
design. All five principles remain PASS; Complexity Tracking still has the single
`@internationalized/date` transparency entry.

**Constitution Follow-up TODOs status**:
- `TODO(openai-key-handling)` → resolved (US8); unaffected (no key/secret handling here).
- `TODO(test-http-mocking)` → unaffected: this feature makes no HTTP calls.

## Project Structure

### Documentation (this feature)

```text
specs/004-nuxt-ui-migration/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output — component-mapping & UX decisions
├── data-model.md        # Phase 1 output — control inventory & component mapping
├── quickstart.md        # Phase 1 output — validation/run guide
├── contracts/
│   └── ui-contracts.md  # Phase 1 output — preserved props/emits/v-model/data-test/keyboard contracts
├── checklists/
│   └── requirements.md  # from /speckit-specify + /speckit-clarify
├── spec.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
app/components/
├── ConfirmDialog.vue                  # MIGRATE: bespoke modal → UModal (drop scoped styles, manual focus trap & keydown); fixes dark-mode #fff defect  [P3]
├── generate/
│   ├── GenerateForm.vue               # MIGRATE: 3×<select>→USelectMenu, speed<input number>→UInputNumber, <textarea>→UTextarea, <label>→UFormField  [P1]
│   ├── MetadataFields.vue             # MIGRATE: <input>→UInput, comment<textarea>→UTextarea, language/customText/customUrl rows (keep input+button+chips: UInput/UButton/UBadge), ×<button>→UButton  [P1]
│   ├── QueueItemEditor.vue            # MIGRATE: text/instructions<textarea>→UTextarea (preserve @blur commit), 3×<select>→USelectMenu  [P1]
│   ├── UploadDropzone.vue             # MIGRATE: <input type=file>→UFileUpload (preserve .txt accept, size guard, reset, no upload)  [P1]
│   └── QueueList.vue                  # NO-OP: no raw interactive controls (verify; already UButton-based)
├── library/
│   ├── LibraryTable.vue               # MIGRATE: <table>→UTable; #expanded slot for player/editor rows; server-driven sort headers; pagination → UPagination/UButton  [P2]
│   ├── LibrarySearchBar.vue           # MIGRATE: search<input>→UInput, 2×<select>→USelectMenu, 2×<input type=date>→UPopover+UCalendar (range) — FR-011 date picker  [P2]
│   ├── LibraryItemEditor.vue          # MIGRATE: filename<input>→UInput (ext in trailing slot); ConfirmDialog dep now UModal-based  [P2]
│   └── BulkCleanDialog.vue            # MIGRATE: bespoke modal→UModal, <select>→USelectMenu, 2×<input type=date>→date picker; drop scoped styles & focus handling  [P3]
├── settings/
│   ├── DefaultTagsSettings.vue        # MIGRATE: 5×<input>→UInput in UFormField (preserve :disabled loading/saving)  [P3]
│   └── OpenAiKeySettings.vue          # NO-OP: no raw interactive controls (verify; already UInput/UButton)
└── LibraryList.vue                    # REMOVE: dead component (unreferenced by any page/component) — YAGNI, not migrated

app/pages/                             # unchanged composition; verify no raw controls (index/library/settings already wrapper-only)

package.json                           # ADD direct dep: @internationalized/date ^3.12.2 (already in tree via @nuxt/ui)

i18n/locales/en.json                   # OPTIONAL: minimal new keys (date-picker placeholder/clear) if needed
i18n/locales/hu.json                   # OPTIONAL: matching Hungarian keys

tests/component/
├── LibraryTable.test.ts               # REWRITE red-first → UTable structure, sort headers, expanded player/editor rows, unavailable row
├── BulkCleanDialog.test.ts            # REWRITE red-first → UModal + USelectMenu + date picker; Esc/cancel/confirm; need-filter gate
├── LibraryItemEditor.test.ts          # REWRITE red-first → UInput filename + UModal confirm-delete flow
├── QueueItemEditor.test.ts            # REWRITE red-first → UTextarea @blur commit, USelectMenu bindings
├── DefaultTags.test.ts / DefaultTagsSettings.test.ts   # REWRITE red-first → UInput/UFormField, disabled/loading, save/clear
├── MetadataFields.test.ts             # REWRITE red-first → UInput/UTextarea/UBadge, add/remove language/text/url
├── Generate.test.ts / QueueList.test.ts               # UPDATE selectors as needed (USelectMenu/UInputNumber/UTextarea/UFileUpload)
├── LibraryList.test.ts                # REMOVE with the dead component
└── ConfirmOverlay.*.test.ts (NEW)     # NEW: UModal confirm — open/teleport, Esc→cancel, focus trap + focus-return; theme (no bespoke hardcoded panel)
```

**Structure Decision**: Single existing Nuxt full-stack app over a shared core. All work is
in `app/` (Vue components) plus their `@nuxt/test-utils` specs, one `package.json`
dependency promotion, and optional minimal i18n keys. No new top-level structure; no
`src/core/`, `server/`, `data-model`, or REST-contract changes — hence this feature's
"contract" artifact is a **UI contract** (preserved props/emits/v-model/data-test/keyboard),
not a network or core API.

## Complexity Tracking

> One transparency entry. No Constitution Check violations: no new UI library, no new
> abstraction, and bespoke modal/focus code is net-deleted in favor of `UModal`.

| Item | Why Needed | Simpler Alternative Rejected Because |
|------|------------|--------------------------------------|
| Add `@internationalized/date` as a **direct** dependency (`^3.12.2`) | The clarified design-system date picker (`UCalendar`, FR-011) needs `CalendarDate`/`getLocalTimeZone` to map calendar selections to the existing inclusive local-day ISO bounds with full typing (no `any`). | Keeping it transitive-only is fragile under pnpm's strict isolation (not reliably importable at top level); hand-rolling date math off raw strings would reintroduce untyped parsing the picker is meant to remove. It is the same version already resolved under `@nuxt/ui@4.8.2`, so no new transitive surface is added. |
