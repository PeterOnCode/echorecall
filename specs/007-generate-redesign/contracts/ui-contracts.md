# Phase 1 UI, Route & Pricing Contracts: Generate Tab Redesign

**Feature**: 007-generate-redesign · **Date**: 2026-07-04 · Companion to [data-model.md](../data-model.md),
[plan.md](../plan.md). Defines the new/forked component APIs (props / emits / `v-model`), the
`data-test` ledger, keyboard/AT contracts, the new server route contract (G-DEFAULTS), and the pricing
contract (G-PRICING). These are the **red-first test targets**.

Conventions: components auto-imported (don't import via `~`); composable **types** imported by relative
path; all labels via `t()` (en/hu parity, FR-022); every interactive control keyboard-operable +
ARIA-labelled (FR-023). The accent is the app's `indigo` primary (FR-021). The embedded 006 Library
components keep their existing contracts (see `specs/006-library-redesign/contracts/ui-contracts.md`) —
**reused unchanged, no waveform player** (FR-008).

> **Implemented-contract amendment (2026-07-19):** The canonical component contracts have three
> generation settings (`voiceId`, `model`, `format`), fixed 1× speed, a two-column editor plus
> full-width configurable Metadata row, and a focused `QueuePanel` with selection/bulk actions/reorder.
> The Library embed contracts are withdrawn. Title/Track are derived and first Track is configured
> in the action bar. Progress failures include `{ clientId, label, error }` and render as a list.
> `gpt-4o-mini-tts` returns an approximate amount rather than `unavailable`. Conflicting historical
> tables below are superseded by this amendment and the current component types/tests.

---

## A. Server route contract — G-DEFAULTS (`/api/settings/generation-defaults`)

Additive, non-secret, plain-JSON — mirrors `/api/settings/defaults`. Backed by
`getGenerationDefaults`/`setGenerationDefaults`/`clearGenerationDefaults` over the `app_config` key
`generation_defaults`. **No schema/migration.**

| Method | Body | Returns | Behavior | Test |
|---|---|---|---|---|
| `GET` | — | `{ generationDefaults: GenerationDefaults }` | sanitized saved defaults; `{}` when unset/corrupt; never 500s | unset → `{}`; saved → round-trips |
| `PUT` | `GenerationDefaults` (partial) | `{ generationDefaults }` | sanitize (unknown voice/model/format dropped, speed clamped); **all-empty ≡ clear** | valid saved; bad voice dropped; speed clamped to [0.25,4]; all-blank clears |
| `DELETE` | — | `{ generationDefaults: {} }` | clears the row; idempotent | after delete, GET → `{}` |

Validation reuses `isKnownVoice`/`isKnownModel`/`isKnownFormat`/`normalizeSpeed` from
`src/core/tts/provider.ts` + `generate.ts`. Core unit tests assert sanitize/round-trip/clear directly
against an in-memory `AppConfigRepository`.

## B. Pricing contract — G-PRICING (`src/core/tts/pricing.ts`)

Pure, dependency-free. Core unit tests assert:

| Input | Output | Note |
|---|---|---|
| `estimateItemCost('tts-1', n)` | `{ amountUsd: n/1e6*15 }` | character-priced; sub-cent retained |
| `estimateItemCost('tts-1-hd', n)` | `{ amountUsd: n/1e6*30 }` | character-priced |
| `estimateItemCost('gpt-4o-mini-tts', n)` | `'unavailable'` | token-priced — never a number |
| `estimateItemCost(model, 0)` | `{ amountUsd: 0 }` \| `'unavailable'` | empty text → $0 for estimable models |

Client aggregate (`useQueue`, unit-tested): `totalUsd` = sum of estimable `amountUsd` only;
`unavailableCount` = count of `'unavailable'`; drives the "+ N items unavailable" note (FR-018).

## C. Component contracts (new / forked)

### C1. `ScriptEntryPanel.vue` `[NEW, forks AddTextPanel]` — [US1/FR-004]
- **v-model** `text: string`. **Emits** `add()` (Add to queue), `clear()`.
- Shows a titled panel + badge, textarea, character hint (length vs `MAX_INPUT_LENGTH`), Clear, Add.
- Add is disabled/blocked for blank text (edge case); no empty item is created.

### C2. `GenerationSettingsPanel.vue` `[NEW, forks GenerateForm]` — [US1/US3/FR-005/FR-011–013]
- **v-model** `voiceId: string`, `model: Model`, `format: Format`, `speed: number`.
- **Props** `voices: Voice[]`, `defaults: GenerationDefaults` (configured), plus resolution handled by
  the page/composable (last-selected → default → fallback).
- **Emits** `reset(field: 'voiceId'|'model'|'format'|'speed')` — restores that field's configured default.
- Speed is the existing numeric control (clamp [0.25, 4.0]); Voice/Model/Format are `USelectMenu` over
  the catalogs.

### C3. `GenerationActionBar.vue` `[NEW, forks GenerateToolbar]` — [US1/FR-007]
- **Props** `queueCount: number`, `totalUsd: number`, `unavailableCount: number`, `busy: boolean`.
- **Emits** `save-queue()`, `load-queue()`, `upload-txt(file: File)` (or opens the file input),
  `generate()`.
- Shows a queue summary + count badge + queue total cost (+ "+N unavailable" note); Generate disabled
  when `queueCount === 0`.

### C4. `QueuePanel.vue` `[NEW, replaces QueueList]` — [US1/US5/FR-018]
- **Props** `items: QueueItem[]`, `cost: QueueCost`. **Emits** `remove(clientId)`, `select(clientId)`.
- Renders each pending row with a text preview, status, and per-item cost (`{amount}` or "unavailable");
  empty state when no items. (Column-visibility via the retained `QueueColumnsDialog` if kept.)

### C5. `GenerationProgressModal.vue` `[NEW]` — [US4/FR-014–017]
- **Props** `open: boolean`, `progress: GenerationProgress`.
- **Emits** `request-close()` (X/Esc/backdrop → triggers confirm), `confirm-cancel()`, `decline-cancel()`,
  `done()` (dismiss after end).
- While `progress.state==='running'`: shows current file + succeeded/failed tally; the rest of the page
  is disabled (backdrop/`inert`). Close-request shows an in-modal confirm; confirm → `confirm-cancel`.
  On `completed`/`cancelled`: shows the summary (succeeded / failed / not-generated).

### C6. `GenerationDefaultsSettings.vue` `[NEW]` — [US3/FR-011–013]
- Mounted inside `SettingsModal` beside `DefaultTagsSettings`. Fields: Voice/Model/Format/Speed defaults
  + per-field reset + Save + Clear + status. Uses `useGenerationDefaults`.

## D. `data-test` ledger (red-first targets)

Reuses existing ids where a forked component keeps behavior; new ids for new behavior.

| Area | `data-test` | Notes |
|---|---|---|
| Page root | `generate-next` | parallel-route smoke |
| Script panel | `script-panel`, `add-text-input` (reused), `add-text-submit` (reused), `script-clear`, `script-charcount` | Add/Clear/char hint |
| Gen settings | `voice`, `model`, `format`, `speed` (reused), `gen-reset-voice`/`-model`/`-format`/`-speed` | selects + per-field reset |
| Action bar | `action-bar`, `action-generate`, `action-save-queue`, `action-load-queue`, `action-upload-txt`, `queue-file-input` (reused), `queue-count-badge`, `queue-total-cost`, `queue-unavailable-note` | Save/Load/Upload/Generate + summary |
| Queue panel | `queue-panel`, `queue-row` (reused), `queue-row-cost`, `queue-row-status`, `queue-empty` (reused), `remove-item` (reused) | per-item cost/status |
| Progress modal | `progress-modal`, `progress-current`, `progress-succeeded`, `progress-failed`, `progress-cancel-confirm`, `progress-cancel-confirm-yes`, `progress-cancel-confirm-no`, `progress-summary`, `progress-close` | progress + confirm-then-stop + summary |
| Settings section | `gen-default-voice`, `gen-default-model`, `gen-default-format`, `gen-default-speed`, `gen-default-reset-<field>`, `gen-default-save`, `gen-default-clear`, `gen-default-status` | in `settings-modal` |
| Embedded library | (existing 006 ids: `library-filter-*`, `library-table`, `tag-inspector`, `library-status-bar`, …) | reused unchanged |

## E. Keyboard / AT contracts (FR-023, SC-007)

- Script textarea, all four selects (+ resets), Save/Load/Upload/Generate, per-item remove, and the
  progress modal's cancel-confirm buttons are **tab-reachable** and **activate on Enter/Space**.
- The progress modal traps focus while open, is labelled (`aria-modal`, titled), and returns focus to
  Generate on close; the cancel-confirm is an accessible confirm (not a native `window.confirm`, per the
  no-dialog rule).
- Every control has an accessible name via `t()`; the count badge, per-item cost, and "unavailable"/
  "+N unavailable" notes are text (AT-readable), not color-only.
- Component tests assert the ARIA name/role and keyboard activation for each new control.

## F. Notes for implementers

- Follow the recorded `@nuxt/ui` test gotchas: USelectMenu emit trick, UInputNumber clamp, UInput/
  UTextarea attr-forwarding + `@blur` commit, UModal scroll/height in `#body`, `useColorMode` mock, i18n
  catalog prewarm. `wavesurfer.js` is **not** used here — no waveform mock.
- The progress modal must **not** trigger a native `alert`/`confirm` dialog (browser-automation + a11y
  rule); the cancel confirmation is an in-modal `@nuxt/ui` confirm.
- Do not import components via `~`; import composable **types** by relative path (typecheck gotcha).
