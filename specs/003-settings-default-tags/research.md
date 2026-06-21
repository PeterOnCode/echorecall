# Research: Default Audio Tag Values in Settings

**Feature**: 003-settings-default-tags | **Date**: 2026-06-21

All Technical Context items resolved from the established 002 stack — no open
`NEEDS CLARIFICATION`. This document records the design decisions, the rationale, and the
alternatives weighed.

## D1. Source of truth: in-app store only (env removed)

- **Decision**: The Settings tab is the **only** source of tag defaults. The
  `NUXT_DEFAULT_TAG_*` environment variables are no longer read. When no value is saved,
  the field is empty.
- **Rationale**: Resolved by the user during `/speckit-clarify` (2026-06-21). Removes the
  dual-source ambiguity and matches the user's intent ("not in .env file").
- **Alternatives considered**:
  - *Keep env as a per-field fallback (UI→env, mirroring US8 key)* — rejected by the user;
    would retain the file-editing path the feature exists to remove.
  - *Seed in-app values from env once on first run* — rejected by the user; adds a
    migration code path and a hidden coupling to the very variables being removed.

## D2. Persistence: reuse the existing `app_config` table, plaintext

- **Decision**: Store one row in the existing `app_config(key, value)` SQLite table, keyed
  `default_tags`, whose `value` is the JSON serialization of the sanitized tag set. Access
  it through the existing `AppConfigRepository` port (and `getAppConfigRepository()` in the
  Nitro container). **No encryption.**
- **Rationale**: The table, the port, and the singleton accessor already exist (US8). Tag
  metadata (artist name, album, genre, comment, language codes) is **not secret**, so the
  AES-256-GCM/`NUXT_APP_SECRET` machinery the OpenAI key needs is unnecessary — and
  requiring a secret just to set an artist name would be a usability regression. Reuse
  satisfies Constitution V (no new table/dependency/abstraction).
- **Alternatives considered**:
  - *New dedicated `default_tags` table with typed columns* — rejected (YAGNI; a single KV
    row is enough for one app-wide set; no querying/relational needs).
  - *Encrypt like the OpenAI key* — rejected; non-secret data, and it would reintroduce the
    `NUXT_APP_SECRET` gate that makes the feature fail closed for no benefit.
  - *JSON file on disk* — rejected; the SQLite store is already the persistence boundary and
    is on the mounted volume.

## D3. Serialization & sanitization rules

- **Decision**: On **write**, sanitize then JSON-serialize: trim scalar fields
  (`artist`, `album`, `genre`, `comment`); drop blank/whitespace-only fields; parse
  `languages` to a trimmed, non-empty, de-duplicated string array; **never** persist
  `title` (or any field outside the supported five). If the sanitized set is empty, delete
  the row (save-all-blank ≡ clear, per the spec edge case). On **read**, JSON-parse and
  re-validate field-by-field with the same rules, so even a hand-edited or legacy row can
  only ever yield a clean `Metadata`.
- **Rationale**: Preserves the exact guarantees of the old `readDefaultTags` env reader
  (trim, drop-blank, Title-never, comma-split languages) and keeps Title-exclusion enforced
  at the core boundary regardless of what the client sends. Re-validating on read means a
  corrupt/partial row degrades gracefully rather than poisoning the form.
- **Alternatives considered**: *Trust the stored JSON shape on read* — rejected; a corrupt
  or externally-edited row could carry a `title` or wrong types and leak into generations.

## D4. Read is total (never throws)

- **Decision**: `getDefaultTags` returns `{}` for a missing row, invalid JSON, or any parse
  error — it never throws. `GET /api/settings/defaults` therefore cannot 500.
- **Rationale**: Matches the current route's contract ("invalid/missing config yields an
  empty object, so this never 500s") and FR-014. The generation-form pre-fill is best-effort
  and must not be able to break form load.

## D5. REST shape: GET/PUT/DELETE mirroring `openai-key`

- **Decision**: Keep `GET /api/settings/defaults` returning `{ defaultTags: Metadata }`
  (unchanged shape). Add `PUT /api/settings/defaults` (body = the editable fields) returning
  the saved `{ defaultTags }`, and `DELETE /api/settings/defaults` returning
  `{ defaultTags: {} }`. No `test` sub-route (nothing to verify — non-secret, no provider).
- **Rationale**: The `openai-key` get/put/delete trio is the house pattern for in-app
  settings; following it keeps the adapter thin and reviewable. Preserving the GET response
  shape means `app/pages/index.vue` needs no change to how it reads/pre-fills.
- **Alternatives considered**: *Single POST that toggles save/clear* — rejected; PUT/DELETE
  is clearer and matches the existing key routes and the composable shape.

## D6. No data migration of old env values

- **Decision**: Existing `NUXT_DEFAULT_TAG_*` values are **not** imported. After upgrade,
  defaults are empty until re-entered in Settings.
- **Rationale**: Directly follows D1 (the user rejected the "seed once" option). A migration
  would re-couple the new store to the variables being deleted.
- **Operator impact**: Documented in the spec (edge case + assumption) and surfaced in
  `README`/`.env.example` cleanup so upgraders know to re-enter values once.

## D7. Web UI: composable + Settings section mirroring US8

- **Decision**: Add `useDefaultTags()` (load/save/clear over the three routes, holding
  reactive `values`, `saving`, `error`, and a saved/empty status) mirroring
  `app/composables/useSettings.ts`; add `DefaultTagsSettings.vue` (Artist, Album, Genre,
  Comment, Languages inputs + Save + Clear) mirroring `OpenAiKeySettings.vue`; mount it in
  `app/pages/settings.vue`. The Languages input reuses the same entry UX the generation form
  already uses for languages, for consistency.
- **Rationale**: Reuses proven patterns (Constitution III/V), keeps Settings sections
  visually and behaviorally consistent, and confines domain logic to core.
- **Alternatives considered**: *Inline the form in `settings.vue`* — rejected; a dedicated
  component matches the existing one-section-per-component layout (`AppearanceSettings`,
  `LanguageSettings`, `OpenAiKeySettings`).

## D8. i18n

- **Decision**: Add `settings.defaultTags.*` keys to `i18n/locales/en.json` and
  `hu.json` (labels, hints, save/clear actions, saved/empty status, error strings).
- **Rationale**: 002 requires both locales (Hungarian default); the Settings UI is fully
  localized. No user-facing string is hard-coded.

## D9. No CLI surface

- **Decision**: Expose `getDefaultTags`/`setDefaultTags`/`clearDefaultTags` from `#core`;
  do not build a CLI command (none exists in the repo today).
- **Rationale**: Constitution IV requires the capability be reachable from the core
  programmatically — it is. The spec scopes the UI to the Settings tab. A future CLI can
  consume the same core functions without rework.
