<!-- SPECKIT START -->
Active feature: **006-library-redesign** (branch `006-library-redesign`).

For technologies, project structure, shell commands, and other context, read the
current plan and its design artifacts:

- Plan: `specs/006-library-redesign/plan.md`
- Spec: `specs/006-library-redesign/spec.md`
- Research: `specs/006-library-redesign/research.md`
- Data model (client entities + `LibraryQuery` extension + view-prefs/dirty-buffer): `specs/006-library-redesign/data-model.md`
- UI + query contracts (component APIs + `data-test` ledger): `specs/006-library-redesign/contracts/ui-contracts.md`
- Quickstart: `specs/006-library-redesign/quickstart.md`

Prior features (running baseline): `specs/005-dashboard-redesign/` (shared resizable two-pane
dashboard for Generate + Library, Settings modal, waveform player; released **v0.5.0**),
`specs/004-nuxt-ui-migration/` (released v0.3.0), `specs/003-settings-default-tags/` (merged #35),
`specs/002-studio-enhancements/` (released v0.2.0), `specs/001-tts-generation-library/`.

Stack: TypeScript (strict) on Node.js (pinned 22.22.2 via mise); Nuxt 4 (Vue 3 + Nitro)
web adapter over a framework-agnostic `src/core/`. `@nuxt/ui` v4.8.2, `@nuxtjs/i18n` (en/hu,
Hungarian default), taglib-wasm tagging, server-side library search/sort/filter/pagination,
`wavesurfer.js` `^7.12.8` (constitution v2.5.0, scoped to `app/`). **006** rebuilds the **Library**
tab as a desktop-style **waveform tag-editor**, a re-skin/extension of the 005 Library, built at a
**parallel route** `/library-next` and swapped to the canonical `/library` once proven (old
page/components then deleted). Reuses 005's `DashboardWorkspace` + `WaveformPlayer` (single A–B loop +
zoom). Adds: a **filter bar** (search-all, format, recording-date, genre, language); **file-table**
multi-select (select-all + per-row), sortable Filename/Title/Artist/Album/Year/Track/Genre,
selected-row highlight, a **Configure Columns** `UModal` (toggle **+ reorder**, Filename always-on);
**bulk delete + bulk tag edit** over existing `remove`/`update` (no server change); a **TagInspector**
(header title + gear, toolbar Prev/Next/Play, fields mapped to existing storage, read-only Text/notes
+ Encoded-By, **explicit Save** with an **auto-preserved per-recording dirty buffer**), a **Configure
Visible Fields** `UModal`, a show/hide-inspector toggle; and a **status bar** (save state, files
loaded, selection, encoding). **Cross-page Prev/Next** (Q2). Accent = the app's existing **indigo**
primary (NOT the Figma kit green, FR-024). New client state (`useViewPreferences` extended for
Library columns+fields, new `useTagDrafts`) lives in `app/`. **One justified core/server touch**
(decision **R-FILTER**, user-approved at plan time): an **additive, read-only, migration-free**
extension of `LibraryQuery` + the SQLite repo + list route — new optional `genre`/`language`/
`recordedAt`-range filters and sort keys over **already-existing columns** (no schema/migration), to
power whole-library filter/sort (SC-003) and cross-page Prev/Next. No audio-tag schema/storage/
generation change otherwise (FR-027/FR-018). New strings localized en/hu; new controls keyboard/
AT-accessible, all test-gated (red-first; `wavesurfer.js` mocked). Constitution v2.5.0 — all five
principles PASS, **no** new technology and **no** governance gate engaged.
<!-- SPECKIT END -->
