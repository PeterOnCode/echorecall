# Implementation Plan: Library Tab Redesign (Waveform Tag-Editor)

**Branch**: `006-library-redesign` | **Date**: 2026-06-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-library-redesign/spec.md`

## Summary

Rebuild the **Library** surface as a desktop-style **waveform tag-editor** — a full re-skin and
extension of the 005 Library. Same stack (`@nuxt/ui` v4 + `wavesurfer.js` + `taglib-wasm`); this
is a UX/interaction redesign, built at a **parallel route** (`/library-next`) so today's
`/library` keeps working untouched, then swapped in and the old page/components deleted as a final
step (FR-001/FR-002).

The surface keeps 005's resizable two-pane shell (`DashboardWorkspace`: file table left,
tag-editor inspector right, waveform footer) and adds: a **filter bar** (search-all, audio-format,
recording-date, genre, language); **file-table management** (multi-select with header select-all,
sortable columns Filename/Title/Artist/Album/Year/Track/Genre, selected-row highlight, a
**Configure Columns** modal that toggles **and reorders** columns with Filename always-on);
**bulk delete and bulk tag edit** across the selection (reusing the existing `remove`/`update`
paths); a richer **inspector** (header title + settings gear, toolbar Prev/Next/Play, the field
set mapped to existing storage, a **Configure Visible Fields** modal, a show/hide toggle, and
**explicit Save** with an **auto-preserved per-recording dirty buffer**); a **status bar**
(save state, files-loaded count, current selection, encoding info); and the **single A–B loop +
zoom** waveform (already built in 005, reused/extended). Accent stays the app's existing primary
(`indigo` in `app/app.config.ts`) — never the Figma kit's green (FR-024).

**Technical approach — presentation-layer-first, plus three justified, migration-free core
extensions.** Most work lands in `app/` (Vue components, composables, i18n) on the
already-installed `@nuxt/ui` v4.8.2 primitives; `wavesurfer.js` `^7.12.8` is **already a
dependency** (constitution v2.5.0), so **no new technology** is introduced and no governance gate
is engaged. After a **direct read of the Figma "Library Tab 2"**, three deliberate core extensions
(all user-approved at plan time, all **migration-free** — no SQL column/migration) are in scope:

1. **R-FILTER** — additive, read-only extension of the library list query: optional `genre`,
   `language`, `recordedAt`-range filters and new sort keys (artist/album/year/track/genre) in
   `LibraryQuery` (`src/core/shared/types.ts`), the SQLite repo's `WHERE`/`ORDER BY`
   (`src/core/library/sqlite-repository.ts`), and the list route — over **columns that already
   exist**. Powers whole-library filter/sort (SC-003) + cross-page Prev/Next (Q2).
2. **R-TAGS** — extend the tag `Metadata` model + the taglib read/write mapping to persist the
   design's extra editable fields (Text/notes, Encoded-By, Album Artist, Composer, BPM, Rating) in
   the **existing `tags_extra` JSON column** (which already holds `languages`/`customText`/
   `customUrl`). No SQL column/migration. Supersedes the earlier read-only-fields decision.
3. **R-AUDIOPROPS** — read audio properties (codec, bitrate, sample rate, duration) server-side
   from the file (taglib `audioProperties`, computed on read), exposed **read-only** on the library
   item for the status bar and the Duration/Bitrate columns. No SQL column/migration.

All three live **in the core** (filter/sort/tag-mapping/audio-property logic), keeping domain logic
out of the Vue layer and reachable from a future CLI (Principle IV). No change to generation
behavior; no SQL migration. Verified UI corrections folded in: inspector header is a fixed
"Tag Editor (ID3v2.4)" title; the toolbar is **Previous · Next · Play Audio · Save**; both config
modals **reorder** rows and carry a **Reset · Cancel · Apply** footer; accent is the app's existing
`indigo` primary (no green).

Per Principle II every new/forked component and the query extension is built **red-first**: failing
tests first for the filter bar, multi-select + bulk delete/edit, sortable + reorderable columns,
the Configure Columns / Configure Visible Fields modals, the inspector's explicit Save + per-record
dirty buffer + read-only fields, cross-page Prev/Next, the status bar, and the waveform (with
`wavesurfer.js` **mocked**, as happy-dom renders neither canvas nor WebAudio); plus core/repository
unit tests for the new query params. i18n (en/hu) parity and keyboard/AT operability for every new
control are test-gated (FR-025/FR-026, SC-008).

## Technical Context

**Language/Version**: TypeScript (latest stable, `strict`) on Node.js 22.22.2 (pinned via mise). Run native-binary/test commands through `mise exec node@22.22.2 --` (the bash shell defaults to a newer Node than the pin).

**Primary Dependencies**: Nuxt 4 (Vue 3, Nitro, Vite); `@nuxt/ui` **v4.8.2** (already installed) — `UDashboardGroup`/`UDashboardPanel`/`UDashboardResizeHandle` (reused via the existing `DashboardWorkspace`), `UTable`, `UModal`, `UPopover`, `UCalendar`, `USelectMenu`, `UInput`, `UTextarea`, `UFormField`, `UCheckbox`, `UButton`, `UBadge`, `UPagination`; `@nuxtjs/i18n` (en/hu); `@internationalized/date` (date picker, already a direct dep); `wavesurfer.js` **`^7.12.8`** (+ its bundled `regions` plugin) — **already a dependency**, constitution-approved (v2.5.0). **No new runtime dependency.**

**Storage**: **No SQLite schema, migration, or new table.** R-FILTER reads existing columns; R-TAGS persists the extra editable fields inside the **existing `tags_extra` JSON column** (no new column); R-AUDIOPROPS computes audio properties on read (nothing persisted). New *client-side* persistence only: the dashboard split size (`@nuxt/ui` dashboard storage via `storage-key`) and the Library view preferences (visible/ordered table columns + visible/ordered inspector fields) in `localStorage` via an extended `useViewPreferences`. The inspector's per-recording dirty buffer is in-memory only (session-scoped).

**Testing**: Vitest 4 with `@nuxt/test-utils` over **happy-dom** for component tests (`vitest.nuxt.config.ts`); core/repository unit tests run in the node project. No live network. New/forked component specs are written red-first; the waveform player is tested against a **mocked** `wavesurfer.js` (mirror the established `useColorMode`/wavesurfer mock pattern from 005). New core unit tests cover the extended `LibraryQuery` (genre/language/recordedAt filters + new sort keys) against an in-memory SQLite repository. i18n parity (en/hu key coverage) and keyboard/AT operability are asserted by automated tests (SC-008).

**Target Platform**: Dockerized Node.js (Nitro) server serving the SSR/SPA browser client; modern evergreen browsers in light/dark mode.

**Project Type**: Web application — Nuxt full-stack (Vue + Nitro) over a shared framework-agnostic core. This feature is Library-only (FR-028); it touches the Vue presentation layer (`app/`), tests, i18n, and a small additive read-only slice of the core library query + list route.

**Performance Goals**: Selecting a recording readies its tags in <1s (SC-001); search/filter narrows a ≥200-recording library in <5s (SC-003) — served by the indexed SQLite query, not client scans; no regression in tagging/deletion/listing outcomes (SC-007); Prev/Next reaches every recording across pages (SC-002).

**Constraints**: Strict TS, no unjustified `any`. The **only** core/server change is the additive read-only query extension (R-FILTER); **zero** changes to the audio-tag schema, storage layout, retag/delete, ports, or generation (FR-027/FR-018). New client types (Library view preferences, inspector field set, dirty-buffer shape) live in `app/`; the extended `LibraryQuery` lives in `src/core/shared/types.ts` (its existing home). Known `nuxt typecheck` gotchas respected: auto-import components (don't import via `~`), import composable types by relative path, narrow `runtimeConfig.public.*` and i18n composer extras locally. Single-user (no auth). All new user-visible strings localized en/hu (FR-025); all new interactive controls keyboard- and AT-operable, test-gated (FR-026).

**Scale/Scope**: 1 surface rebuilt at a parallel route then cut over. ~8 new components (`LibraryFilterBar` superset, `LibraryFileTable`, `LibraryColumnsDialog`, `BulkTagEditDialog`, `TagInspector`, `InspectorFieldsDialog`, `LibraryStatusBar`, `library-next.vue` page) and ~3 forked/extended from 005 (`AudioTagsPanel`→`TagInspector`, `WaveformPlayer` reused, `useViewPreferences` extended, `useLibrary` extended for cross-page nav + bulk ops); the core query extension (`LibraryQuery` + `sqlite-repository` + list route); new + forked component tests and core unit tests; i18n keys added en/hu.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against EchoRecall Constitution **v2.5.0**:

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | New SFCs/composables stay strict `<script setup lang="ts">`. The Library view-prefs, inspector field set, and dirty-buffer shape are fully typed in `app/`; the extended `LibraryQuery` keeps full signatures in `src/core/shared/types.ts`. `wavesurfer.js` ships its own types — no `any`. |
| II. Test-First (NON-NEGOTIABLE) | ✅ PASS | TDD enforced. New/forked component specs written red-first; the query extension gets failing core/repository unit tests first (genre/language/recordedAt filters + new sort keys); the waveform is tested against a **mocked** `wavesurfer.js`. i18n/a11y gates (SC-008) are new failing tests first. No live network. |
| III. Modular Architecture | ✅ PASS | Confined to `app/` + an additive core query slice. The two-pane shell stays the shared `DashboardWorkspace` (≥3-use threshold already met). No presentation→presentation cross-imports; no domain logic added to components — filter/sort logic lives in the core repository, not the Vue layer. |
| IV. Shared Core, Multiple Interfaces | ✅ PASS | All three extensions (R-FILTER query, R-TAGS tag-mapping, R-AUDIOPROPS audio-property read) live **in the core** (`LibraryQuery`/repository, `Metadata`+taglib mapping, the audio-property reader), keeping domain logic out of presentation and **reachable from both interfaces** (a future CLI gains the same filters/sorts, extra tags, and audio properties for free) — strengthening, not weakening, Principle IV. All are migration-free; generation untouched. The waveform library stays in `app/` per the v2.5.0 stack entry. |
| V. Simplicity & YAGNI | ✅ PASS | No new dependency. R-FILTER reuses existing columns + the list pipeline; R-TAGS reuses the existing `tags_extra` JSON store + taglib write path (rather than adding 6 SQL columns); R-AUDIOPROPS reads on demand (rather than persisting + backfilling). Each is the smallest change meeting the verified design; rejected alternatives (client-side filter, per-field SQL columns, store-at-generation) were heavier or broke the no-migration guard (see research). Reuses 005's `DashboardWorkspace` + `WaveformPlayer`. |

**Technology Stack governance gate — NOT engaged.** `wavesurfer.js` is already an approved
Technology Stack entry (constitution v2.5.0, 2026-06-22) and is already an installed dependency;
this feature adds **no** technology outside the stack. No amendment or Complexity-Tracking
governance action is required.

**Result**: All five principles PASS against constitution v2.5.0. The three core touches (R-FILTER
query extension, R-TAGS tag-mapping extension, R-AUDIOPROPS audio-property read) are all
spec-justified (FR-027/FR-029/FR-030), migration-free, and recorded in Complexity Tracking as
transparency notes of the FR-027 exceptions.

**Constitution Follow-up TODOs status**:
- `TODO(test-http-mocking)` → unaffected: this feature makes no new outbound HTTP calls (it reuses existing same-origin Nitro routes).

## Project Structure

### Documentation (this feature)

```text
specs/006-library-redesign/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output — route/cutover, query extension, cross-page nav, dirty buffer, columns, status bar, waveform reuse
├── data-model.md        # Phase 1 output — client entities, the LibraryQuery extension, view-prefs & dirty-buffer shapes
├── quickstart.md        # Phase 1 output — validation/run guide
├── contracts/
│   └── ui-contracts.md  # Phase 1 output — component props/emits/v-model/data-test/keyboard contracts + the query-extension contract
├── checklists/
│   └── requirements.md  # from /speckit-specify + /speckit-clarify
├── spec.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
app/
├── pages/
│   ├── library-next.vue                # NEW: parallel Library route; wires useLibrary (extended) + view-prefs + dirty buffer into the new components  [US1..US6, FR-001]
│   └── library.vue                     # KEEP until cutover, then DELETE; nav repointed to the new surface at the canonical route  [FR-002]
├── layouts/
│   └── default.vue                     # ADAPT (cutover only): Library nav target → new surface  [FR-002]
├── components/
│   ├── dashboard/
│   │   └── DashboardWorkspace.vue      # REUSE: 005 resizable two-pane shell (#list/#detail/#footer); split persisted via storage-key  [US1]
│   └── library/
│       ├── LibraryFilterBar.vue        # NEW (supersedes LibrarySearchBar): search-all + format + recording-date + genre + language  [US3]
│       ├── LibraryFileTable.vue        # NEW (forks LibraryTable): multi-select (select-all + per-row), sortable Filename/Title/Artist/Album/Year/Track/Genre, selected-row highlight, Configure-Columns + show/hide-inspector gear  [US1/US4]
│       ├── LibraryColumnsDialog.vue    # NEW: UModal — toggle + reorder visible columns (Filename always-on; not-all-hidden guard)  [US4]
│       ├── BulkTagEditDialog.vue       # NEW: UModal — pick one editable tag field + value, apply across selection  [US4]
│       ├── TagInspector.vue            # NEW (forks AudioTagsPanel + LibraryItemEditor): header title + settings gear, toolbar Prev/Next/Play, mapped fields, explicit Save, dirty indicator, Configure-Visible-Fields gear  [US1/US5]
│       ├── InspectorFieldsDialog.vue   # NEW: UModal — toggle visible inspector fields (not-all-hidden guard)  [US5]
│       ├── LibraryStatusBar.vue        # NEW: save state, files-loaded count, current selection, encoding info  [US6]
│       ├── WaveformPlayer.vue          # REUSE: 005 wavesurfer single-loop + zoom player (light theme)  [US2]
│       ├── MetadataFields.vue          # REUSE / lightly ADAPT: field inputs embedded by TagInspector
│       └── BulkCleanDialog.vue         # KEEP: unchanged
├── composables/
│   ├── useLibrary.ts                   # ADAPT: extend LibraryQuery usage (genre/language/recordedAt filters + sort keys); add cross-page Prev/Next helpers (load adjacent page at bounds); add removeMany / bulkRetag wrappers over existing remove/update  [US2/US4]
│   ├── useViewPreferences.ts           # ADAPT: add Library column visibility+order and inspector-field visibility (localStorage), each with a not-all-hidden / Filename-always-on guard  [US4/US5]
│   └── useTagDrafts.ts                 # NEW: per-recording staged (dirty) buffer — stage edits, report dirty, restore on return, commit on Save (Q4)  [US5]

src/core/
├── shared/types.ts                     # ADAPT: (R-FILTER) extend `LibraryQuery` — `genre?`,`language?`,`recordedFrom?`/`recordedTo?` + sort keys 'artist'|'album'|'recordedAt'|'track'|'genre'; (R-TAGS) extend `Metadata` with encodedBy/albumArtist/composer/bpm/rating/notes; (R-AUDIOPROPS) add an `AudioProperties` type
└── library/
    ├── sqlite-repository.ts            # ADAPT: (R-FILTER) additive WHERE/ORDER BY over existing cols; (R-TAGS) read/write the new fields inside the existing `tags_extra` JSON column — no new SQL column/migration
    ├── library-service.ts             # ADAPT: forward the new query params; surface read-only audio properties on the returned item  [R-FILTER/R-AUDIOPROPS]
    ├── audio-properties.ts            # NEW: read codec/bitrate/sampleRate/duration from an audio file via taglib audioProperties (computed on read)  [R-AUDIOPROPS]
    ├── tag-writer.ts (taglib mapping) # ADAPT: map the extra Metadata fields (encodedBy/albumArtist/composer/bpm/rating/notes) to ID3 frames via `tags_extra`  [R-TAGS]
    └── repository.ts                   # ADAPT (interface) where the query/item types are referenced

server/api/
├── generations.get.ts                  # ADAPT: accept + forward the new optional query params; include read-only audio properties per item  [R-FILTER/R-AUDIOPROPS]
└── generations/[id].patch.ts           # ADAPT: accept the extra editable tag fields in the retag patch (validated)  [R-TAGS]

tests/
├── component/                          # NEW/forked specs: filter bar, file table (multi-select/sort/highlight), columns dialog (toggle+reorder+guard), bulk-tag-edit dialog, tag inspector (explicit Save, dirty buffer, read-only fields, Prev/Next, Play), inspector-fields dialog, status bar, waveform [mocked]
├── integration/                        # cross-page Prev/Next, bulk delete + bulk tag edit success/failure reporting, parallel-route render
└── unit/                               # core: extended LibraryQuery (genre/language/recordedAt filters + new sort keys); useViewPreferences (Library prefs guards); useTagDrafts (stage/restore/commit)

i18n/locales/
├── en.json                             # ADD keys: filter labels, column names (Year/Track/Artist/Album/Genre), columns dialog, bulk-tag-edit, inspector fields + read-only labels, inspector-fields dialog, status bar, show/hide inspector
└── hu.json                             # ADD matching Hungarian keys (parity required, FR-025)
```

**Structure Decision**: Single Nuxt web app over the shared core. The bulk of the work is in
`app/` (presentation), `tests/`, and `i18n/`. The shared `DashboardWorkspace` and `WaveformPlayer`
are reused from 005. The **one** core/server slice is the additive, read-only, migration-free
`LibraryQuery` extension (R-FILTER), placed in the core where filter/sort domain logic belongs
(Principle IV). No audio-tag schema, storage, retag/delete, port, or generation files are touched
(FR-027/FR-018).

## Complexity Tracking

> Records the three FR-027 exceptions (all user-approved, all migration-free — no constitution violation; all five principles PASS).

| Item | Why Needed | Simpler Alternative Rejected Because |
|------|------------|--------------------------------------|
| **R-FILTER** — additive read-only `LibraryQuery` extension in `src/core/` + list route | FR-011/FR-012 (genre/language/recording-date filters) + FR-014 (sort by Artist/Album/Year/Track/Genre) aren't in the current query, but SC-003 needs whole-library narrowing and Q2 needs cross-page Prev/Next | **Client-side filter/sort** only sees one page (breaks SC-003); **load-all-in-client** pulls the whole library into memory + breaks Q2. Extending the indexed query over **existing columns** is smallest, stays in the core, adds CLI parity. No migration. |
| **R-TAGS** — extend `Metadata` + taglib mapping to persist extra editable fields in the existing `tags_extra` JSON column | The design (FR-018/FR-029) makes Text/notes, Encoded-By, Album Artist, Composer, BPM, Rating editable; they have no dedicated SQL column | **Read-only/omit** (prior decision) fails the verified design. **Six new SQL columns** needs a migration + backfill. The `tags_extra` JSON store **already exists** and already holds languages/customText — reuse it: full fidelity, **no migration**, logic stays in the core taglib mapping (CLI parity). |
| **R-AUDIOPROPS** — read codec/bitrate/sample-rate/duration server-side (taglib `audioProperties`), read-only | The status bar (FR-023) and Duration/Bitrate columns (FR-017/FR-030) show real audio properties not stored today | **Omit** them diverges from the design's status bar. **Store-at-generation** is a schema change + backfill of existing rows. **Read-on-demand** needs no migration, stays in the core, and is parity-friendly. Cost (decode-on-read) is acceptable at this app's scale and is display-only. |
