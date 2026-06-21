# REST Contract: Default Tag Values

**Feature**: 003-settings-default-tags | **Date**: 2026-06-21

Three Nitro routes under `server/api/settings/`. They mirror the `openai-key` get/put/delete
trio. All read/write the single `default_tags` row via `getAppConfigRepository()`. Tag
defaults are **non-secret**: no `NUXT_APP_SECRET` gate, no masking, no `test` route.

Shared response shape:

```ts
// Metadata from '#core/client' (only the supported subset is ever populated)
interface DefaultTagsResponse {
  defaultTags: Metadata // {} when none saved; never contains `title`
}
```

---

## GET /api/settings/defaults

Return the currently saved default tag values (for the Settings form **and** the
generation-form pre-fill). **Shape is unchanged from the 002/US10 version** so existing
consumers (`app/pages/index.vue`) need no change.

- **Auth**: none (single-user app).
- **Request**: no body.
- **200**: `{ "defaultTags": { ...saved subset... } }` — `{}` when nothing is saved.
- **Never 500s**: a missing/invalid/corrupt row degrades to `{ "defaultTags": {} }`.

Example:

```http
GET /api/settings/defaults
200 OK
{ "defaultTags": { "artist": "Jane Doe", "genre": "Podcast", "languages": ["eng"] } }
```

---

## PUT /api/settings/defaults

Save (replace) the default tag values.

- **Request body** (all optional):

  ```ts
  {
    artist?: string
    album?: string
    genre?: string
    comment?: string
    languages?: string[] | string   // array, or comma-separated string at the adapter
  }
  ```

- **Behavior**: sanitize (trim, drop blanks, drop duplicate/blank languages, **strip any
  `title` or unsupported field**), then upsert the `default_tags` row. If the sanitized set
  is empty, the row is deleted (save-all-blank ≡ clear).
- **200**: `{ "defaultTags": { ...sanitized saved subset... } }`.
- **Title handling**: any `title` in the body is silently ignored (never stored/returned).
- **No 409**: unlike the OpenAI key, there is no secret prerequisite, so there is no
  `KEY_STORAGE_DISABLED`-style rejection. Malformed JSON body → 400 via the shared error
  handler.

Example:

```http
PUT /api/settings/defaults
{ "artist": "  Jane Doe  ", "title": "ignored", "languages": ["eng","",  "eng"] }
200 OK
{ "defaultTags": { "artist": "Jane Doe", "languages": ["eng"] } }
```

---

## DELETE /api/settings/defaults

Clear the saved default tag values.

- **Request**: no body.
- **Behavior**: delete the `default_tags` row (idempotent — succeeds whether or not a row
  existed).
- **200**: `{ "defaultTags": {} }`.

Example:

```http
DELETE /api/settings/defaults
200 OK
{ "defaultTags": {} }
```

---

## Error model

Reuses the project's `respondError` envelope (as in `defaults.get.ts` /
`openai-key.*.ts`). Reads are total and do not error; writes only error on a malformed
request body (400). No route exposes secrets (there are none here).
