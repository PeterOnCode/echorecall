# Quickstart & Validation: Default Audio Tag Values in Settings

**Feature**: 003-settings-default-tags | **Date**: 2026-06-21

Validates the spec's user stories end-to-end. See [data-model.md](./data-model.md),
[contracts/rest-api.md](./contracts/rest-api.md), and [contracts/core-api.md](./contracts/core-api.md)
for the authoritative shapes; this guide is for running and confirming behavior.

## Prerequisites

- Node 22.22.2 via mise (native `better-sqlite3`). Run tooling through the pinned runtime:
  `mise exec node@22.22.2 -- <cmd>`.
- Dependencies installed (`pnpm install` / `npm install`).
- `NUXT_APP_SECRET` is **not required** for this feature (tag defaults are non-secret).

## Automated tests (TDD — author red first)

Run the focused suites:

```bash
mise exec node@22.22.2 -- npm run test -- tests/unit/default-tags.test.ts \
  tests/integration/settings-defaults.test.ts \
  tests/component/DefaultTags.test.ts
```

Expected coverage:

- **`tests/unit/default-tags.test.ts`** (core, fake `AppConfigRepository`):
  - `getDefaultTags` returns `{}` when no row exists.
  - `setDefaultTags` trims scalars, drops blanks, parses/dedupes `languages`, and **never
    stores `title`** (or unknown fields).
  - `setDefaultTags` with an all-blank input **deletes** the row (returns `{}`).
  - round-trip: `set` then `get` returns the same sanitized subset.
  - `clearDefaultTags` removes the row (idempotent).
  - a corrupt/invalid JSON row makes `getDefaultTags` return `{}` (never throws).
- **`tests/integration/settings-defaults.test.ts`** (`@nuxt/test-utils`):
  - `GET` returns `{ defaultTags: {} }` initially.
  - `PUT` saves and echoes the sanitized set; a `title` in the body is ignored.
  - `GET` after `PUT` reflects the saved values.
  - `DELETE` returns `{ defaultTags: {} }` and a subsequent `GET` is empty.
- **`tests/component/DefaultTags.test.ts`** (`@nuxt/test-utils`):
  - the Settings section renders the five fields (no Title field).
  - editing + Save calls `PUT` with the entered values.
  - Clear calls `DELETE` and resets the fields.
  - saved/empty status is shown (mirrors how `OpenAiKeySettings` shows state).

> The previous env-based assertions in `settings-defaults.test.ts` / `DefaultTags.test.ts`
> are **replaced** — they must no longer reference `NUXT_DEFAULT_TAG_*`.

## Manual validation (dev server)

```bash
mise exec node@22.22.2 -- npm run dev
```

### Story 1 — Set defaults from Settings (P1)

1. Open **Settings → Default tag values**. Fields are empty.
2. Enter Artist = `Jane Doe`, Genre = `Podcast`, Languages = `eng`; **Save**.
3. Go to **Generate** and start a new item → Artist/Genre/Languages are pre-filled;
   **Title is blank**.
4. Restart the dev server; repeat step 3 → values still pre-fill. ✅ (FR-001..006, SC-002/003)

### Story 2 — Update / clear (P2)

1. In Settings, change Genre to `Audiobook`, leave others; **Save** → next new generation
   uses `Audiobook`, Artist unchanged.
2. Click **Clear** → next new generation starts with empty tag fields. ✅ (FR-007/008/010, SC-004)

### Env removal (clarified behavior)

1. Set `NUXT_DEFAULT_TAG_ARTIST=FromEnv` in `.env` and restart.
2. With no in-app defaults saved, start a new generation → Artist is **blank** (env ignored).
   ✅ (FR-009/013, SC-001/005)
3. Confirm `.env.example` no longer lists any `NUXT_DEFAULT_TAG_*` entries.

### Robustness

- Manually corrupt the `default_tags` row (e.g. set its `value` to `not-json` via a SQLite
  client), reload the form and the Settings tab → both load normally with empty defaults; no
  500. ✅ (FR-014)

## Done signals

- All three suites green.
- New generations pre-fill only from saved in-app values; Title always empty.
- Saving, updating, clearing all reflect on the next new generation.
- No tag default originates from the environment; `.env.example` and README updated.
