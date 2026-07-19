<!-- SPECKIT START -->
Active feature: **007-generate-redesign** (branch `007-generate-redesign`).

For technologies, project structure, shell commands, and other context, read the
current plan and its design artifacts:

- Plan: `specs/007-generate-redesign/plan.md`
- Spec: `specs/007-generate-redesign/spec.md`
- Research: `specs/007-generate-redesign/research.md`
- Data model (generation-defaults blob + last-selected view-pref + pricing/cost + progress/cancel state): `specs/007-generate-redesign/data-model.md`
- UI + route + pricing contracts (component APIs + `data-test` ledger + G-DEFAULTS route + G-PRICING): `specs/007-generate-redesign/contracts/ui-contracts.md`
- Quickstart: `specs/007-generate-redesign/quickstart.md`

Prior features (running baseline): `specs/006-library-redesign/` (Library rebuilt as a waveform
tag-editor; merged via PR #73), `specs/005-dashboard-redesign/` (shared resizable two-pane dashboard
for Generate + Library, Settings modal, waveform player; released **v0.5.0**), `specs/004-nuxt-ui-migration/`
(released v0.3.0), `specs/003-settings-default-tags/` (merged #35), `specs/002-studio-enhancements/`
(released v0.2.0), `specs/001-tts-generation-library/`.

Stack: TypeScript (strict) on Node.js (pinned 22.22.2 via mise); Nuxt 4 (Vue 3 + Nitro) web adapter
over a framework-agnostic `src/core/`. `@nuxt/ui` v4.8.2, `@nuxtjs/i18n` (en/hu, Hungarian default),
taglib-wasm tagging, SQLite library, `wavesurfer.js` `^7.12.8` (constitution v2.5.0, scoped to `app/`,
**not used by 007**). **007** rebuilds the **Generate** tab to the Figma "Generate Tab — Nuxt UI" as a
**single scrolling page** (page intro → three-column editor [Script / Generation settings / Metadata]
→ generation **action bar** [Save queue / Load queue / **Upload .txt batch** / Generate + count badge +
queue cost total] → **embedded fully-functional 006 Library workspace, NO waveform player** → status
bar), replacing the 005 two-pane QueueList + metadata editor. Built at a **parallel route**
`/generate-next`, swapped to canonical `/` once proven (old page/components deleted). Reuses the 006
Library components (filter bar, file table + Configure Columns, Tag Editor inspector + Configure Visible
Fields + show/hide, status bar) via `useLibrary`. Four generation-flow enhancements: **G-DEFAULTS**
(Voice/Model/Format/Speed configurable defaults server-persisted alongside Default Tags in a new
`app_config` key `generation_defaults` + last-selected in `localStorage` via `useViewPreferences`;
resolution last-selected → default → fallback; per-field reset); **G-CANCEL** (generation progress modal
— current file, per-file succeeded/failed, page disabled; close **confirms then gracefully stops** —
finish in-flight file, stop before next, client flag not `AbortController`; succeeded/failed/not-generated
summary); **per-item cost estimate + queue total** (pure core `pricing.ts`: `tts-1`≈$15/1M, `tts-1-hd`≈$30/1M
chars, `gpt-4o-mini-tts`→"unavailable"; total sums estimable + "+N unavailable" note; display-only, never
blocks Generate); **recording date → today** (drop `useQueue` `tomorrowIso()`, stamp `todayIso()` at
generation time only when empty — resolves the 005 clobber). Accent = existing **indigo** (NOT Figma green,
FR-021); Figma Account/credits area omitted (FR-026). Core touches (all additive, migration-free): **G-DEFAULTS**
(`src/core/settings/generation-defaults.ts` + 3 `/api/settings/generation-defaults` routes, mirrors
`default-tags.ts`) and **G-PRICING** (pure `src/core/tts/pricing.ts`) — both in the core (Principle IV,
CLI-reachable); recording-date is client-only. Reuses 006's R-FILTER/R-TAGS/R-AUDIOPROPS untouched. New
strings localized en/hu; new controls keyboard/AT-accessible, all test-gated (red-first). Constitution
v2.5.0 — all five principles PASS, **no** new technology and **no** governance gate engaged.
<!-- SPECKIT END -->
