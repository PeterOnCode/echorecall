# Core API Contract: Default Tag Values

**Feature**: 003-settings-default-tags | **Date**: 2026-06-21

Framework-agnostic functions in `src/core/settings/default-tags.ts`, exported from `#core`.
They mirror the `api-key.ts` get/set/clear shape but carry **no crypto and no app secret**
(tag defaults are non-secret). Server adapters (and any future CLI) call these; the network
and HTTP layer stay in the Nitro routes.

## Types

```ts
import type { Metadata } from '../shared/types'
import type { AppConfigRepository } from './app-config-repository'

/** The single app_config row holding the JSON-serialized default tag set. */
export const DEFAULT_TAGS_CONFIG_KEY = 'default_tags'

/** Dependencies for default-tags resolution (no secret — non-sensitive data). */
export interface DefaultTagsDeps {
  config: AppConfigRepository
}

/** Editable input from the Settings form (adapter may pass `languages` as a CSV string). */
export interface DefaultTagsInput {
  artist?: string
  album?: string
  genre?: string
  comment?: string
  languages?: string[] | string
}
```

## Functions

### `getDefaultTags(deps: DefaultTagsDeps): Metadata`

- Reads the `default_tags` row; returns the sanitized `Metadata` subset, or `{}` when absent.
- **Total**: invalid JSON, wrong types, or a partially-corrupt row ⇒ `{}` (never throws).
- Re-applies the sanitization rules on read, so the result can only contain the supported
  five fields and never `title`.

### `setDefaultTags(deps: DefaultTagsDeps, input: DefaultTagsInput): Metadata`

- Sanitizes `input` (see rules below) and **upserts** the row with `JSON.stringify` of the
  result.
- If the sanitized set is empty, **deletes** the row instead (save-all-blank ≡ clear).
- Returns the sanitized `Metadata` actually stored (`{}` when cleared).

### `clearDefaultTags(deps: DefaultTagsDeps): Metadata`

- Deletes the `default_tags` row (idempotent). Returns `{}`.

## Sanitization rules (shared by read and write)

1. Permitted fields only: `artist`, `album`, `genre`, `comment`, `languages`.
2. `title` and any unknown field are dropped.
3. Scalars trimmed; blank/whitespace-only ⇒ field omitted.
4. `languages`: accept `string[]` or a comma-separated `string`; trim entries, drop blanks,
   de-duplicate (preserve first-seen order); empty ⇒ field omitted.
5. Result is a `Metadata` whose only possible keys are the five permitted ones.

## Barrel changes (`src/core/index.ts`)

```ts
// REMOVE (env source eliminated):
// export { readDefaultTags } from './settings/default-tags'

// ADD:
export {
  getDefaultTags,
  setDefaultTags,
  clearDefaultTags,
  DEFAULT_TAGS_CONFIG_KEY,
} from './settings/default-tags'
export type { DefaultTagsDeps, DefaultTagsInput } from './settings/default-tags'
```

> `readDefaultTags(env)` is removed entirely; no consumer remains after `defaults.get.ts`
> is re-sourced. `Metadata` continues to come from `#core/client` for browser-safe imports.

## Invariants

- **No secret dependency**: `DefaultTagsDeps` has no `appSecret`; storage works regardless of
  `NUXT_APP_SECRET`.
- **Title-exclusion is enforced in core**, not just the UI — a client cannot persist a Title
  default by any path.
- **Reads never throw**; writes are pure aside from the single KV upsert/delete.
- **Plaintext at rest** — values are not encrypted (contrast `api-key.ts`/`crypto.ts`).
