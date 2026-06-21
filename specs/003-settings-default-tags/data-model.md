# Data Model: Default Audio Tag Values in Settings

**Feature**: 003-settings-default-tags | **Date**: 2026-06-21

This feature introduces **no new database table or schema migration**. It adds one row to
the existing `app_config` key/value table (shipped in 002 for the encrypted OpenAI key).

## Entities

### DefaultTags (conceptual)

The app-wide set of default tag values applied to new generations. It is a **subset of the
existing `Metadata` type** (`src/core/shared/types.ts`) restricted to the five supported,
non-title fields.

| Field | Type | Rules |
|-------|------|-------|
| `artist` | `string?` | Trimmed; omitted when blank/whitespace-only. |
| `album` | `string?` | Trimmed; omitted when blank/whitespace-only. |
| `genre` | `string?` | Trimmed; omitted when blank/whitespace-only. |
| `comment` | `string?` | Trimmed; omitted when blank/whitespace-only. |
| `languages` | `string[]?` | Each entry trimmed; blank entries dropped; duplicates removed; omitted when the resulting list is empty. ISO 639-2 codes (multi-value, ID3 TLAN) — same shape the generation form already uses. |
| `title` | — | **Never stored, never returned.** Excluded at the core boundary even if a client sends it. |

- The in-memory representation is exactly `Metadata` with only the fields above possibly
  present. An empty default set is `{}`.
- There is **one** app-wide set (single-tenant). No per-user variants.

### app_config row (persistence)

Reuses the existing table — definition unchanged:

```sql
CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

| Column | Value for this feature |
|--------|------------------------|
| `key` | `default_tags` (constant `DEFAULT_TAGS_CONFIG_KEY`) |
| `value` | JSON serialization of the sanitized `DefaultTags` set, e.g. `{"artist":"Jane Doe","languages":["eng"]}` |

- **Coexistence**: the OpenAI key row (`openai_api_key`) and this row (`default_tags`) live
  in the same table without interaction.
- **Absence semantics**: no row ⇒ no defaults ⇒ `getDefaultTags()` returns `{}`.

## Lifecycle / State Transitions

```
(no row) ──setDefaultTags(non-empty)──▶ (row: default_tags = JSON)
   ▲                                          │
   │                                          ├─ setDefaultTags(non-empty)  ─▶ (row updated)
   │                                          │
   └── clearDefaultTags()  ◀──────────────────┤
   └── setDefaultTags(all-blank)  ◀────────────┘   (save-all-blank ≡ clear: row deleted)
```

- **Set (non-empty)**: upsert the `default_tags` row with the sanitized JSON.
- **Set (all fields blank after sanitization)**: delete the row (equivalent to clear).
- **Clear**: delete the row.
- **Read**: parse + re-validate the row → `Metadata`; any failure (missing/invalid/corrupt)
  yields `{}` (total, never throws).

## Validation Rules (authoritative, enforced in core)

1. Only `artist`, `album`, `genre`, `comment`, `languages` may be persisted (FR-002).
2. `title` is never persisted or returned, regardless of input (FR-006).
3. Scalar fields are trimmed; blank/whitespace-only ⇒ field omitted (FR-011).
4. `languages` accepts an array (or comma-joined input at the adapter); each entry trimmed,
   blanks dropped, duplicates removed; empty list ⇒ field omitted.
5. A fully-empty sanitized set deletes the row (clear).
6. Read re-applies rules 1–4 so a corrupt/hand-edited row can only yield a clean subset.
7. Read never throws; invalid JSON ⇒ `{}` (FR-014).

## Relationships

- **DefaultTags → Generation pre-fill**: on new-generation form load, the effective defaults
  pre-fill the editable tag fields (Title excluded). Per-generation edits do not write back
  to the stored defaults (FR-012). Changing the stored defaults does not retroactively re-tag
  existing library items (spec assumption).
- **No FK / no relational links**: it is a standalone KV row.

## Removed configuration

The following environment variables are **no longer read** and are removed from
`.env.example` (FR-013):

```
NUXT_DEFAULT_TAG_ARTIST
NUXT_DEFAULT_TAG_ALBUM
NUXT_DEFAULT_TAG_GENRE
NUXT_DEFAULT_TAG_COMMENT
NUXT_DEFAULT_TAG_LANGUAGES
```

No automatic migration of their prior values (research D6).
