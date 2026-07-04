# Phase 1 Data Model: Generate Tab Redesign (Figma) + Generation-Flow Enhancements

**Feature**: 007-generate-redesign · **Date**: 2026-07-04 · **Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

This feature adds **no SQLite schema, migration, or table**. It introduces two additive core shapes
(a generation-defaults config blob and a pricing reference), one client view-preference, and small
client-side view/run state. Existing entities (`ListItem`/`QueueItem`, `Metadata`, `Voice`, `Model`,
`Format`, and the 006 library `Recording`) are **reused unchanged**. Types below live in the file
noted; `[NEW]`/`[ADAPT]`/`[REUSE]` marks the change.

---

## 1. Generation Settings Defaults (server, G-DEFAULTS) — `[NEW]`

The configurable per-field defaults, persisted server-side under a new `app_config` key. Mirrors the
`default_tags` shape/handling exactly (sanitize on read+write, clear-on-empty). No migration.

**`src/core/settings/generation-defaults.ts`** `[NEW]`

```ts
/** app_config key holding the JSON-serialized generation defaults (parallel to DEFAULT_TAGS_CONFIG_KEY). */
export const GENERATION_DEFAULTS_CONFIG_KEY = 'generation_defaults'

/** Saved generation defaults. Every field optional; an absent field imposes no default. */
export interface GenerationDefaults {
  voiceId?: string   // must satisfy isKnownVoice
  model?: Model      // must satisfy isKnownModel ('tts-1' | 'tts-1-hd' | 'gpt-4o-mini-tts')
  format?: Format    // must satisfy isKnownFormat (mp3|wav|flac|opus|aac|pcm)
  speed?: number     // clamped via normalizeSpeed to [0.25, 4.0]
}

export interface GenerationDefaultsDeps { config: AppConfigRepository }

export function getGenerationDefaults(deps): GenerationDefaults          // sanitized; {} on missing/corrupt; never throws
export function setGenerationDefaults(deps, input): GenerationDefaults    // sanitize; empty ≡ delete row; returns stored
export function clearGenerationDefaults(deps): GenerationDefaults         // delete row; returns {}
```

- **Validation**: `voiceId` dropped unless `isKnownVoice`; `model` dropped unless `isKnownModel`;
  `format` dropped unless `isKnownFormat`; `speed` coerced by `normalizeSpeed` (non-finite → default 1.0,
  else clamped). Unknown keys dropped. A fully-empty sanitized set deletes the row (save-all-blank ≡ clear).
- **Totality**: `get` never throws (Settings + editor pre-fill can't 500), matching `getDefaultTags`.

## 2. Resolved Generation Settings (client) — `[ADAPT]` `useQueue` / `[NEW]` `useGenerationDefaults`

The values actually bound to the Voice/Model/Format/Speed controls, resolved per field.

- **Resolution order (per field)**: `last-selected (localStorage)` → `configured default (server)` →
  `built-in fallback`.
- **Built-in fallbacks**: `voiceId` = first catalog voice id; `model` = `'gpt-4o-mini-tts'`;
  `format` = `'mp3'`; `speed` = `1`.
- **Reset (per field)**: clears that field's last-selected entry and restores the configured default
  (or fallback if none configured).
- **On change**: writing a field updates its last-selected entry (§3); the value flows into new
  `QueueItem`s exactly as today (`useQueue` already holds `voiceId`/`model`/`format`/`speed` refs).

**`useGenerationDefaults.ts`** `[NEW]` — `{ defaults: Ref<GenerationDefaults>, loading, saving, error,
load(), save(form), clear(), resetField(field) }` over `/api/settings/generation-defaults` (shape
mirrors `useDefaultTags`).

## 3. Last-Selected Generation Settings (client view-pref) — `[ADAPT]` `useViewPreferences`

```ts
// localStorage key: 'echorecall:viewprefs:genSettings'
export interface GenSettingsPref {
  voiceId?: string
  model?: Model
  format?: Format
  speed?: number
}
```

- **Persistence**: read-merge-sanitize like the existing view-prefs; SSR-safe (falls back to `{}` with
  no `localStorage`). Only known-catalog values are kept on read (a stale value is ignored, not bound).
- **Guards**: none beyond validity — each field independent; absence just means "no last-selected".

## 4. Cost Estimate + Pricing (G-PRICING) — `[NEW]`

**`src/core/tts/pricing.ts`** `[NEW]` — pure, dependency-free.

```ts
/** USD per 1,000,000 characters for character-priced models; token-priced models are absent. */
export const MODEL_PRICING: Readonly<Record<Model, { usdPerMillionChars: number } | 'tokenPriced'>> = {
  'tts-1':          { usdPerMillionChars: 15 },
  'tts-1-hd':       { usdPerMillionChars: 30 },
  'gpt-4o-mini-tts': 'tokenPriced',
}

export type CostEstimate = { amountUsd: number } | 'unavailable'

/** Pure: estimable models → { amountUsd } (sub-cent precision retained); token-priced → 'unavailable'. */
export function estimateItemCost(model: Model, charCount: number): CostEstimate
```

- **Client-derived queue aggregate** (in `useQueue`, not persisted):

```ts
interface QueueCost {
  perItem: Map<clientId, CostEstimate>  // charCount from item.text.length
  totalUsd: number                      // sum of estimable amounts only
  unavailableCount: number              // items whose estimate is 'unavailable'
}
```

- **Rules (FR-018/FR-019)**: `charCount = item.text.length`; unavailable items are **excluded** from
  `totalUsd` (never counted as $0) and drive the "+ N items unavailable" note when `unavailableCount > 0`;
  display-only — never gates Generate.

## 5. Generation Run Progress + Cancel (client) — `[ADAPT]` `useGeneration`

In-memory only; drives `GenerationProgressModal`. No persistence.

```ts
interface GenerationProgress {
  total: number                 // target items to process
  index: number                 // 0-based position of the current item
  current: QueueItem | null     // the file currently generating (null between/after)
  succeeded: string[]           // generation ids
  failed: { clientId: string; error: string }[]
  notGenerated: QueueItem[]     // target items neither done nor failed when the loop broke (cancel)
  state: 'running' | 'completed' | 'cancelled'
}

const cancelRequested: Ref<boolean>  // set by the confirm-then-stop flow; checked between items
```

- **State transitions**: `running` → (`completed` when loop finishes) | (`cancelled` when
  `cancelRequested` breaks the loop after the in-flight item finishes). `notGenerated` is populated only
  on `cancelled`.
- **Modal ↔ run coupling (FR-014/FR-016)**: the modal opens on Generate, disables the page while
  `state==='running'`, and on close-request shows a confirm; confirming sets `cancelRequested`. The
  in-flight `generateItem` is awaited (finishes), then the loop breaks before the next item.

## 6. Queue Item — `[REUSE]` (unchanged shape) + recording-date behavior change (FR-020)

`QueueItem`/`ListItem`/`Metadata` are **unchanged**. Only the **recording-date default behavior** changes:

- **Before**: `makeItem` stamps `metadata.recordedAt = tomorrowIso()` at add-to-queue time.
- **After**: `makeItem` leaves `recordedAt` **empty** when the shared form has none; at **generation
  time**, each target item with an empty `recordedAt` is stamped `todayIso()` (date-only, local day);
  a user-set `recordedAt` is never overwritten. Resolves the 005 clobber.

## 7. Recording (Library Item) — `[REUSE]` (006, unchanged)

The embedded workspace lists/inspects/edits/deletes the same `Recording` entity as the Library tab,
via the unchanged `useLibrary`/`LibraryService` surface (006's R-FILTER/R-TAGS/R-AUDIOPROPS). This
feature adds nothing to it. The 006 audio-property + extra-tag fields and the filter/sort query are
reused as-is.

---

## Storage & migration summary

| Shape | Where | Persistence | Migration? |
|-------|-------|-------------|------------|
| `GenerationDefaults` | `src/core/settings/generation-defaults.ts` | `app_config` key `generation_defaults` (JSON) | **No** — new key in existing generic store |
| `GenSettingsPref` (last-selected) | `useViewPreferences` | `localStorage` `echorecall:viewprefs:genSettings` | No — client only |
| `MODEL_PRICING` / `CostEstimate` | `src/core/tts/pricing.ts` | none (pure compute) | No |
| `QueueCost` | `useQueue` | none (derived) | No |
| `GenerationProgress` / `cancelRequested` | `useGeneration` | none (in-memory) | No |
| Recording-date default | `useQueue` / generate flow | none (behavior change) | No |
| `Recording` (006) | `useLibrary` / `LibraryService` | existing SQLite + files | No — reused unchanged |
