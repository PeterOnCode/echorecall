# Quickstart & Validation Guide: Library Tab Redesign (Waveform Tag-Editor)

**Feature**: 006-library-redesign · **Date**: 2026-06-24 · Run/validate guide for the redesigned
Library. Details live in [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md),
[contracts/ui-contracts.md](./contracts/ui-contracts.md). This is a **validation** guide — no
implementation code here.

> **Node pin**: the repo pins Node **22.22.2** (mise) but the shell may default to a newer Node.
> Prefix native/test commands with `mise exec node@22.22.2 --` when the bare command misbehaves.

## Prerequisites

- Dependencies installed (`npm install` / `pnpm install`). `wavesurfer.js` `^7.12.8` is **already**
  in `package.json` — no new dependency to add.
- A library with several recordings spanning mixed **genres, languages, formats, and recording
  dates** (so filters/sort/Prev-Next are exercised). Generate a few via the Generate tab if empty.

## Run

```bash
npm run dev            # Nuxt dev server → open the redesigned surface at /library-next
```

Pre-cutover the new surface is at **`/library-next`**; the old `/library` keeps working. After
cutover (FR-002) the new surface is at `/library` and `/library-next` is gone.

## Automated test gates (red-first; run these first)

```bash
npm run test:component   # @nuxt/test-utils + happy-dom (wavesurfer.js mocked)
npm test                 # full Vitest run (core unit + component + integration)
npm run typecheck        # nuxt typecheck (strict) — must stay green
npm run lint
```

Expect **failing** specs first (Principle II), then implement to green. New core unit tests cover the
extended `LibraryQuery`; component specs cover every new control; integration covers cross-page
Prev/Next and bulk ops.

## Manual validation scenarios (map to user stories / FRs)

### US1 — Two-pane table + inspector (FR-003-006)
1. Open `/library-next`: file table left, inspector right, waveform footer, status bar bottom.
2. Click a row → its tags load in the inspector; the row is highlighted. Drag the divider → panes
   resize; reload → split retained.
3. Inspector **Prev/Next** change the active recording without touching the table; **across a page
   boundary** they load the adjacent page and select its first/last row (R-NAV); disabled only at the
   global first/last (SC-002).

### US2 — Waveform (FR-007-010)
4. With a row selected, the waveform renders (light theme) and **Play** works. Move the **zoom**
   slider → waveform scales. **Add loop section** marks one A–B region; enable **repeat** → playback
   loops that range only. Select a recording with broken audio → "unavailable", no crash.

### US3 — Filter bar (FR-011-012)
5. Type in **search-all** → list narrows. Apply **format**, **genre**, **language**, and
   **recording-date** filters individually → list narrows by each (whole library, not just the page).
   Clear each → list restores. A no-match combination → empty-result state, no error.

### US4 — File-table management (FR-013-017)
6. Toggle **select-all** → all rows select; toggle per-row checkboxes. With ≥2 selected, **Bulk
   delete** → confirm → rows removed, selection clears, counts correct. **Bulk tag edit** → pick a
   field (e.g. Genre) + value → applied across the selection; result summary reports succeeded/failed.
7. Sort by **Filename/Title/Artist/Album/Year/Track/Genre** → rows reorder. Open **Configure
   Columns** → toggle/show the full set (incl. **Comment, Date, Composer, Duration, Bitrate**) and
   **reorder** (drag grip); **Reset to defaults / Cancel / Apply** footer works; Filename can't be
   hidden; can't hide all; reload → choices retained.

### US5 — Inspector controls (FR-018-022/FR-032)
8. Inspector header reads **"Tag Editor (ID3v2.4)"** + gear; toolbar = **Previous · Next · Play Audio
   · Save**. All 15 fields are **editable** — edit **Encoded-By** (e.g. "kid3"), **Text/notes**, and
   an extra field (**Album Artist / Composer / BPM / Rating**) → **dirty** indicator shows; **Save**
   commits; reload → the values **round-trip** (persisted via `tags_extra`, **no migration**).
   Edit → switch recording → switch back → **staged edits restored** (auto-preserve, no prompt, Q4).
   Open **Configure Visible Fields** → toggle **and reorder** (grip), Reset/Cancel/Apply; Name can't
   be hidden; reload → retained. **Show/hide inspector** collapses/restores the pane.

### US6 — Status bar (FR-023)
9. Status bar shows **files-loaded** count, **current selection**, **save state** ("All changes
   saved" ↔ unsaved), **UTF-8**, and the recording's **real audio properties** — codec, bitrate,
   sample rate (e.g. "MPEG-1 Layer 3 (320 kbps, 44100 Hz)"); blank where unreadable.

### Cross-cutting (FR-024-026, SC-007/008)
10. Accent on all new controls is the app's existing **indigo** primary — **not** green (FR-024).
11. Switch locale en↔hu → every new label translates (no hardcoded strings). Tab through all new
    controls → reachable + operable by keyboard; screen-reader labels present.
12. **No regression**: tagging, deletion, and listing produce the same results as the old `/library`
    for the same inputs (SC-007).

### Cutover (FR-002, do last, separately)
13. Repoint the Library nav to the new surface, rename `library-next.vue` → `library.vue`, delete the
    old page/components; existing `/library` links still resolve; old-surface specs removed/updated.

## Done-when

- All automated gates green (`npm test`, `npm run test:component`, `npm run typecheck`, `npm run lint`).
- Scenarios 1–12 pass on `/library-next`; scenario 13 completed at cutover.
- No SQL migration and no generation change; the three core touches are R-FILTER (query),
  R-TAGS (extra fields via `tags_extra`), and R-AUDIOPROPS (read-only audio properties).
