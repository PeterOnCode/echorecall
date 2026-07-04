# Phase 0 Research: Library Tab Redesign (Waveform Tag-Editor)

**Feature**: 006-library-redesign · **Date**: 2026-06-24 · **Input**: [spec.md](./spec.md), [plan.md](./plan.md)

All decisions resolve the spec's clarified requirements against the **actual** 005 codebase. No
NEEDS CLARIFICATION remains. Format per decision: **Decision / Rationale / Alternatives considered**.

---

## R-ROUTE — Parallel route + cutover (FR-001/FR-002)

**Decision**: Build the redesigned surface as a new page `app/pages/library-next.vue` while
`app/pages/library.vue` is untouched. Verify, then **cut over** in a final, separable change: point
the Library nav item in `app/layouts/default.vue` at the new surface, **rename** `library-next.vue`
→ `library.vue` (taking the canonical `/library` route so existing links/tests resolve), and
**delete** the now-orphaned 005-only components/specs (old `LibraryTable`, `AudioTagsPanel`,
`LibrarySearchBar`, and `library.vue`). New components live under `app/components/library/` with new
names so both surfaces coexist pre-cutover without collision.

**Rationale**: Matches the brief's "parallel route, swap once proven" and SC-009. Renaming on
cutover (rather than permanently shipping `/library-next`) keeps the canonical route stable. Keeping
new component names distinct avoids auto-import clashes while both pages exist.

**Alternatives considered**: (a) Mutate `library.vue` in place — rejected: the brief explicitly
wants the old surface working untouched until proven. (b) Ship `/library-next` permanently —
rejected: leaves a non-canonical route and stale links; the spec wants the new surface at the
canonical route post-cutover.

---

## R-FILTER — Whole-library filter + multi-column sort (FR-011/FR-012/FR-014, SC-003) — **user-approved at plan time (Option A)**

**Decision**: Extend the **existing** library list query with **additive, read-only,
migration-free** parameters over columns that already exist:

- `LibraryQuery` (`src/core/shared/types.ts`) gains optional `genre?: string`,
  `language?: string` (single ISO 639-2 code matched within the multi-value `tags_extra.languages`),
  `recordedFrom?: string` / `recordedTo?: string` (ISO bounds over `tag_recorded_at`), and the sort
  union gains `'filename' | 'artist' | 'album' | 'recordedAt' | 'track' | 'genre' | 'comment'`
  (existing keys `createdAt|title|voice|format` retained). "Year" + "Date" sort by `recordedAt`;
  "Filename" by the stored name; Composer/Duration/Bitrate are display-only (unsortable). The filter
  bar's **single recording-date** input maps to a day's `recordedFrom`/`recordedTo` bounds (UI = one
  date, query = a day range — no extra query field).
- `src/core/library/sqlite-repository.ts` adds the matching `WHERE`/`ORDER BY` clauses over
  `tag_genre`, `tag_recorded_at`, `tag_track`, `tag_album`, `tag_artist`, and a `LIKE`/JSON match on
  `tags_extra` for `language`. All new params are optional → existing callers/CLI unaffected.
- The list route accepts + validates the new optional params and forwards them.

Recording-date filtering targets **`recordedAt`** (the tag the user sets), distinct from the
existing `from`/`to` which target `createdAt` (generation time) — both remain available.

**Rationale**: The current query supports only `q`/`voiceId`/`format`/`createdAt`-range and sort by
`createdAt|title|voice|format` — it cannot satisfy the genre/language filters or the
Artist/Album/Year/Track/Genre sort. The columns already exist, so this is **not** a schema change.
Doing it in the core keeps filter/sort domain logic out of the Vue layer (Principle IV) and the
SQLite index serves SC-003 (≥200 recordings, <5s) and Q2's cross-page Prev/Next. This is the FR-027
"explicitly justified" exception; the user selected it over the alternatives at plan time.

**Alternatives considered**: (a) **Client-side filter/sort over the loaded page** — rejected: only
sees `pageSize` (20) rows, breaks SC-003 and whole-library semantics. (b) **Load-all-in-client**
(huge `pageSize`, filter/sort/paginate in the browser) — rejected: pulls the entire library into
memory and diverges from Q2's "server pagination underneath"; doesn't scale and duplicates
querying logic in presentation. (c) **A new parallel endpoint** — rejected: duplicates the list
pipeline; extending the one query is simpler (YAGNI).

---

## R-NAV — Cross-page Previous/Next (FR-006, SC-002, Q2)

**Decision**: Prev/Next operate over the **filtered result set across pages**. Within the loaded
page they move the selection by index (as 005 does). At a page boundary they bump
`query.page` (±1) and, after the reload settles, select the **first** row of the next page (Next)
or the **last** row of the previous page (Prev). Prev/Next disable only at the **global** first/last
(page 1 first row / last page last row), derived from `total` + `pageSize` + current page.
A short loading state covers the page fetch; selection resolves once `items` updates.

**Rationale**: Satisfies Q2/SC-002 (reach every recording without touching the table) while keeping
server pagination (R-FILTER). Reuses 005's within-page index math and `useLibrary.query`/`items`
reactivity; only the boundary case is new.

**Alternatives considered**: (a) Within-page-only (005's behavior) — rejected: fails SC-002 across
pages. (b) Prefetch adjacent pages — rejected: premature optimization (YAGNI); the boundary fetch
is fast enough and on-demand.

---

## R-DRAFTS — Explicit Save + auto-preserved per-recording dirty buffer (FR-019, Q3/Q4)

**Decision**: A new `app/composables/useTagDrafts.ts` holds an in-memory `Map<id, DraftPatch>` of
**staged** edits keyed by recording id. The inspector reads/writes the draft for the active id;
`isDirty(id)` compares the draft to the recording's saved values. Switching selection does **not**
clear drafts — returning to a recording restores its staged edits (Q4 = auto-preserve, no prompt).
**Save** commits the active recording's draft via the existing `useLibrary.update` (rename +
retag patch, exactly as 005's `onSave`), then clears that recording's draft on success. Drafts are
session-scoped (not persisted). Multiple recordings may be dirty at once; the status bar reflects
the **active** recording's saved/unsaved state (and may show an aggregate dirty count).

**Rationale**: Implements the Q3 (explicit Save) + Q4 (auto-preserve) clarifications directly.
Reuses the existing atomic rename+retag PATCH path (no server change). Keeping drafts in a composable
(not the component) lets the page, inspector, and status bar share one source of truth and makes
stage/restore/commit unit-testable. Note this **changes** 005's `LibraryItemEditor` behavior, which
re-seeds (discards) drafts on item change — the new `TagInspector` must not.

**Alternatives considered**: (a) Prompt Save/Discard on switch (Q4 option A) — rejected by the user
in clarify. (b) Persist drafts to localStorage — rejected: YAGNI and risks stale buffers across
sessions; the spec only requires preserve-within-session.

---

## R-FIELDS — Inspector field mapping + Configure Visible Fields (FR-018/FR-020/FR-029) — **superseded by the design read; see R-TAGS**

**Decision**: The Figma inspector lists **15 editable fields**, all backed (no new SQL column):

| Inspector field | Backing | |
|---|---|---|
| Name | `LibraryItem.filename` (base; rename) | dedicated |
| Title | `metadata.title` | dedicated |
| Artist | `metadata.artist` | dedicated |
| Album | `metadata.album` | dedicated |
| Comment | `metadata.comment` | dedicated |
| Date | `metadata.recordedAt` | dedicated |
| Track Number | `metadata.track` | dedicated |
| Genre | `metadata.genre` | dedicated |
| Language | `metadata.languages` (multi) | dedicated |
| Text/notes | `metadata.notes` → `tags_extra` (a free-form `customText` value) | **R-TAGS** |
| Encoded-By | `metadata.encodedBy` → `tags_extra` (ID3 TENC) | **R-TAGS** |
| Album Artist | `metadata.albumArtist` → `tags_extra` (TPE2) | **R-TAGS** |
| Composer | `metadata.composer` → `tags_extra` (TCOM) | **R-TAGS** |
| BPM | `metadata.bpm` → `tags_extra` (TBPM) | **R-TAGS** |
| Rating | `metadata.rating` → `tags_extra` only (no POPM frame — taglib-wasm property-map limitation) | **R-TAGS** |

All fields are **editable** (the earlier read-only Text/notes + Encoded-By decision is superseded —
the design renders both as inputs, e.g. Encoded-By = "kid3"). `Configure Visible Fields`
(`InspectorFieldsDialog`, `UModal`) **toggles + reorders** which fields render (drag grip), Name
always-on, not-all-hidden; persisted via `useViewPreferences` (R-COLUMNS). The 6 non-dedicated
fields persist via **R-TAGS** (the existing `tags_extra` JSON column).

**Rationale**: Faithfully implements the verified design while staying migration-free — `metadata`
already carries the 9 dedicated fields; the 6 extra ones reuse the existing `tags_extra` store
rather than adding columns.

**Alternatives considered**: Read-only/omit the extras (prior decision) — rejected after reading the
design. New SQL columns — rejected (migration). See R-TAGS for the storage decision.

---

## R-COLUMNS — Configure Columns (toggle + reorder) + view-preference persistence (FR-017/FR-020)

**Decision**: Extend `app/composables/useViewPreferences.ts` (today persists only the Generate
queue columns) with two **Library** preference sets in `localStorage`:

- `libraryColumns`: an **ordered** list of `{ id, visible }` for the toggleable columns — per the
  verified design: **Title, Artist, Album, Year, Track, Genre, Comment, Date, Composer, Duration,
  Bitrate** (Composer/Duration/Bitrate are display-only; Duration/Bitrate come from R-AUDIOPROPS).
  **Filename is always-on** and not in the toggle set. The dialog toggles visibility **and** reorders
  via a drag grip; a **not-all-hidden** guard prevents emptying the set.
- `inspectorFields`: an **ordered** `{ id, visible }` list over the 15 inspector field ids (R-FIELDS)
  — the design's Configure Visible Fields modal also has a drag grip per row, so this set reorders
  too; **Name always-on**, not-all-hidden.

Both modals carry a **footer**: a Reset-to-defaults action + Cancel + Apply (FR-031).

Each set merges stored values over defaults (new ids default visible) and persists on change with
the existing sync-flush `watch` pattern. Keys: `echorecall:viewprefs:libraryColumns`,
`echorecall:viewprefs:inspectorFields`. The pane **split size** continues to persist via
`DashboardWorkspace`'s `@nuxt/ui` `storage-key` (no change).

**Rationale**: Reuses the proven 005 persistence mechanism and its not-all-hidden guard rather than
inventing a new store; ordering is added as an explicit array (the 005 set was an unordered record).
SSR-safe (localStorage-guarded) exactly as today.

**Alternatives considered**: (a) Server-side preferences — rejected: FR-027 (no server/schema change
for prefs) and 005 precedent is client-side. (b) A separate new composable — rejected: duplicates the
storage/guard logic; extend the existing one (DRY, Principle V).

---

## R-BULK — Bulk delete + bulk tag edit (FR-015/FR-016, Q clarify)

**Decision**: Both bulk actions are **client-side orchestration over existing per-item endpoints** —
no new server route:

- **Bulk delete**: confirm via the existing `ConfirmDialog`/destructive pattern, then call
  `useLibrary.remove(id)` for each selected id; reload once at the end so `total`/pagination stay
  correct; clear the selection; resolve the active selection to a surviving neighbor.
- **Bulk tag edit** (`BulkTagEditDialog`): the user picks **one** editable tag field
  (Title, Artist, Album, Comment, Date, Track Number, Genre, Language — **filename excluded**) and a
  value, then the field is **overwritten** on each selected recording via the existing
  `useLibrary.update(id, { metadata })` retag path. Run **sequentially** to avoid hammering
  `taglib-wasm`/SQLite, collect per-id outcomes, and report `{ succeeded, failed }` counts (surface
  failures, leave the rest applied).

New thin wrappers `removeMany(ids)` and `bulkRetag(ids, field, value)` live in `useLibrary` so the
loop/reporting is unit-testable; they call only the existing `remove`/`update`.

**Rationale**: Implements the clarify answer (both bulk delete and bulk tag edit) with **zero**
server change — reuses the same retag/delete the inspector already uses. Sequential execution keeps
the existing single-writer behavior and gives deterministic success/failure reporting. Excluding
filename matches the spec (one filename across many → forced rename collisions).

**Alternatives considered**: (a) A new bulk server endpoint — rejected: FR-027 (no server change
needed; the per-item paths already exist). (b) `Promise.all` parallel writes — rejected: risks
SQLite/taglib write contention and muddies per-item error attribution. (c) Fill-empty-only or
shared-fields-only semantics — rejected by the clarify answer (any editable tag field, overwrite).

---

## R-STATUS — Status bar content (FR-023) — **updated by the design read; uses R-AUDIOPROPS**

**Decision**: `LibraryStatusBar` shows:

- **Save state** — from `useTagDrafts` (`All changes saved` / unsaved for the active recording;
  optional "N unsaved" aggregate).
- **Files loaded** — `useLibrary.total` (the full filtered count).
- **Current selection** — `Selected: 1 file (<filename>)` (or none).
- **Tag encoding** — `UTF-8` (tags are written UTF-8).
- **Audio properties** — **real** codec, bitrate, and sample rate (e.g. `MPEG-1 Layer 3
  (320 kbps, 44100 Hz)`) from **R-AUDIOPROPS**, shown where readable (blank/placeholder otherwise).

**Rationale**: The design explicitly shows codec + bitrate + sample rate, so the earlier "omit
bitrate" stance is replaced by R-AUDIOPROPS (read on the server, read-only). Still no SQL migration.

**Alternatives considered**: Omit bitrate/sample-rate (prior decision) — rejected after the design
read. Store at generation — rejected (migration). See R-AUDIOPROPS.

---

## R-TAGS — Extra editable tag fields via `tags_extra` (FR-018/FR-029) — **user-approved at plan time**

**Decision**: Make Text/notes, Encoded-By, Album Artist, Composer, BPM, and Rating **editable** by
extending the tag model + taglib mapping in the **core**, persisting them in the **existing
`tags_extra` JSON column** (which already stores `languages`/`customText`/`customUrl`):

- `Metadata` (`src/core/shared/types.ts`) gains optional `notes?`, `encodedBy?`, `albumArtist?`,
  `composer?`, `bpm?`, `rating?` (serialized into `tags_extra`, not new SQL columns).
- The taglib write/read mapping writes each as its **native ID3 frame** (TENC/TPE2/TCOM/TBPM;
  notes via a `customText` entry) in the audio file **and** mirrors it in the `tags_extra` JSON for
  the SQLite row — except **Rating, which is `tags_extra`-only** (taglib-wasm's property map cannot
  write POPM; the 0–5 ↔ POPM byte mapping stays in the core for future file-level sync). Formats:
  BPM = integer; **Rating = 0–5 stars**; others free text.
- The retag route (`generations/[id].patch.ts`) accepts the extra fields in the metadata patch.

**No SQL column, no migration.** Existing rows without these keys read back empty.

**Rationale**: The verified design renders these as editable inputs. `tags_extra` is the existing
catch-all JSON store, so reusing it gives full fidelity with zero migration and keeps the logic in
the core (CLI parity). Bulk tag edit (R-BULK) can target any of these fields too.

**Alternatives considered**: Six new SQL columns + migration + backfill — rejected (heavier, breaks
the no-migration guard). Read-only/omit — rejected (doesn't match the design).

---

## R-AUDIOPROPS — Read-only audio properties (FR-023/FR-030) — **user-approved at plan time**

**Decision**: Surface read-only `AudioProperties` — `codec`, `bitrate`, `sampleRate`, `duration` —
read **server-side** from the audio file via taglib's `audioProperties` when the library list/item
is served (a new `src/core/library/audio-properties.ts` reader), attached read-only to the returned
`LibraryItem`. Used by the status bar and the optional Duration/Bitrate columns. Computed on read;
**nothing persisted, no migration**. Missing/unreadable values render blank.

**Rationale**: The design shows real audio properties; reading them on demand via the already-present
taglib avoids any schema change while delivering full fidelity. At single-user scale, decode-on-read
for a page of rows is acceptable; display-only and cacheable later if needed.

**Alternatives considered**: Persist at generation (new columns + backfill) — rejected (migration).
Omit — rejected (design shows them). Client-side decode — rejected (would ship audio bytes + a
decoder to the browser; the server already has taglib).

---

## R-WAVE — Waveform player reuse: single A–B loop + zoom (FR-007/FR-008/FR-009/FR-010, US2)

**Decision**: **Reuse the existing 005 `WaveformPlayer.vue` as-is** (it already provides: light
waveform with `waveColor` zinc / `progressColor` indigo, play/pause, **a single loop region** via
the regions plugin, a loop/repeat toggle, a zoom range input, and an unavailable state on load
failure). 006 wires it into the new surface's `#footer` for the active recording. Any polish
(e.g. surfacing "Add loop section" / "Repeat section" labels to match the Figma, or making the A–B
region drag-resizable — wavesurfer regions are draggable by default) is additive within the same
component and test-gated; the single-region, loop-aid semantics (no trim/modify) are unchanged
(FR-009).

**Rationale**: The 005 player already meets FR-007–FR-010 and the single-A–B-loop clarification; the
constitution (v2.5.0) already scopes `wavesurfer.js` to `app/`. Rebuilding it would violate YAGNI.

**Alternatives considered**: (a) New waveform component — rejected: duplicates working, tested code.
(b) Multiple named regions — rejected by the clarify answer (single A–B).

---

## R-ACCENT — Primary accent color (FR-024)

**Decision**: Use the app's **existing** primary, `indigo` (set in `app/app.config.ts:
ui.colors.primary`), for all new controls — i.e. inherit the default `@nuxt/ui` `primary` token.
**Do not** introduce the Figma kit's green. The spec's wording "violet primary" is colloquial for
the app's existing primary; no color config change is made.

**Rationale**: FR-024 requires the app accent, not the kit green. The app already standardizes on
`indigo` (the waveform's `progressColor` is indigo-500). Reusing the token guarantees consistency and
zero theme drift.

**Alternatives considered**: (a) Switch the app primary to a literal `violet` — rejected: would
restyle the whole app beyond Library scope and isn't required; "violet" was descriptive, not a spec
to change the global token.

---

## R-TEST — Testing approach for the new surface (Principle II, FR-026, SC-008)

**Decision**: Red-first throughout. Component specs under `tests/component/` use `@nuxt/test-utils`
+ happy-dom; **`wavesurfer.js` is mocked** (happy-dom renders neither `<canvas>` nor WebAudio) using
the established 005 mock pattern. Core/repository unit tests (node project) drive the extended
`LibraryQuery` against an in-memory SQLite repo (genre/language/recordedAt filters + each new sort
key, plus "existing callers unaffected"). Integration specs cover cross-page Prev/Next, bulk
delete + bulk tag-edit success/failure reporting, and the parallel-route render. Every new control
asserts: a stable `data-test` hook, keyboard operability + ARIA (FR-026), and en/hu key parity
(SC-008). `data-test` hooks reused from 005 are preserved or their consuming tests updated in the
same change.

**Rationale**: Matches the constitution's non-negotiable TDD and the 005 testing conventions
(documented in the team's memory: USelectMenu emit-trick, UInputNumber clamp, textarea `setValue`
fires `change`, i18n locale-switch prewarm, color-mode/wavesurfer mocks).

**Alternatives considered**: (a) Real wavesurfer in jsdom/happy-dom — rejected: no canvas/WebAudio;
flaky. (b) E2E-only coverage — rejected: violates the unit/component-first TDD mandate.
