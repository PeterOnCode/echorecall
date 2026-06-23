<!-- SPECKIT START -->
Active feature: **005-dashboard-redesign** (branch `005-dashboard-redesign`).

For technologies, project structure, shell commands, and other context, read the
current plan and its design artifacts:

- Plan: `specs/005-dashboard-redesign/plan.md`
- Spec: `specs/005-dashboard-redesign/spec.md`
- Research: `specs/005-dashboard-redesign/research.md`
- Data model (client entities + queue-file schema): `specs/005-dashboard-redesign/data-model.md`
- UI contract (component APIs + `data-test` ledger): `specs/005-dashboard-redesign/contracts/ui-contracts.md`
- Quickstart: `specs/005-dashboard-redesign/quickstart.md`

Prior features (running baseline): `specs/004-nuxt-ui-migration/` (presentation-only
`@nuxt/ui` migration, released v0.3.0), `specs/003-settings-default-tags/` (in-app default
tag values, merged #35), `specs/002-studio-enhancements/` (released v0.2.0),
`specs/001-tts-generation-library/`.

Stack: TypeScript (strict) on Node.js (pinned 22.22.2 via mise); Nuxt 4 (Vue 3 + Nitro)
web adapter over a framework-agnostic `src/core/`. 002 added: `@nuxt/ui` v4 (+color-mode),
`@nuxtjs/i18n` (en/hu, Hungarian default), batch generation + multi-format audio, taglib-wasm
tagging, server-side library search/sort/filter/pagination, an encrypted in-app OpenAI key,
and a Bumpp version in the header. 003 moved default tag values into Settings. 004 migrated
remaining raw HTML controls to `@nuxt/ui` v4 (+ `@internationalized/date`). **005** is a
**presentation-layer-only** redesign: rework the **Generate** and **Library** surfaces onto a
shared **resizable two-pane dashboard** (`UDashboardGroup`/`UDashboardPanel`/`UDashboardResizeHandle`,
all already in `@nuxt/ui` v4.8.2) driven by a header `UDashboardToolbar`; Generate gains queue
search/filters, a multi-select checkbox + source column, a column-visibility `UModal`, a
recording-date `UPopover`+`UCalendar` picker (default tomorrow), and local-file **save/open queue**
(versioned JSON, no server storage); **Generate** targets checked-else-all and **removes
successfully generated items**; Library gets the same two-pane layout (table + audio-tags panel
with prev/next) plus a **waveform player** (`wavesurfer.js` — the one NEW dep, zoom + loop
regions). **Settings** moves into a `UModal` and the standalone Settings tab/page is removed.
All new client state (queue `source`, `useQueueFile`, `useViewPreferences`) lives in `app/` —
**no `src/core/`/`server`/schema/route changes** (FR-018). New strings localized en/hu; new
controls keyboard/AT-accessible, all test-gated (red-first; `wavesurfer.js` mocked in tests).
**Governance**: `wavesurfer.js` was outside the prior Technology Stack list; the constitution was
**amended to v2.5.0** (2026-06-22) to permit a web-UI audio-visualization library (scoped to `app/`,
display/playback only), so **US6 is unblocked**. Constitution: `.specify/memory/constitution.md` (v2.5.0).
<!-- SPECKIT END -->
