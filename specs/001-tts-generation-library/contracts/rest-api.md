# API Contract: Text-to-Speech Generation with Persistent Library

**Feature**: `001-tts-generation-library` | **Surface**: Nitro HTTP routes (web)

All JSON bodies are UTF-8. Timestamps are ISO 8601 UTC. No authentication (operator-secured).

## Shared types

```ts
type Voice = { id: string; label: string }

type Generation = {
  id: string            // UUID
  text: string          // source text (≤ 4096 chars)
  voiceId: string       // member of the voice catalog
  createdAt: string     // ISO 8601 UTC
  audioUrl: string      // "/api/generations/<id>/audio"
}
```

## Error envelope

Non-2xx responses return:

```ts
type ApiError = { error: { code: ErrorCode; message: string } }
```

| `code` | HTTP | Meaning |
|--------|------|---------|
| `EMPTY_INPUT` | 400 | Text was empty or whitespace-only (FR-007) |
| `INPUT_TOO_LONG` | 400 | Text exceeded 4,096 characters (FR-008) |
| `INVALID_VOICE` | 400 | `voiceId` not in the catalog (FR-002) |
| `PROVIDER_UNAVAILABLE` | 502 | TTS provider failed/timed out (FR-006); nothing persisted |
| `NOT_FOUND` | 404 | No generation with that id |

The key is never included in any error `message`.

---

## GET /api/voices

List the selectable voice catalog (FR-002).

- **Response 200**: `{ voices: Voice[] }`

## POST /api/generations

Generate speech and auto-save it to the library (FR-001, FR-003, FR-009).

- **Request body**: `{ text: string; voiceId: string }`
- **Response 201**: `Generation` (the saved entry)
- **Errors**: `EMPTY_INPUT`, `INPUT_TOO_LONG`, `INVALID_VOICE` (400); `PROVIDER_UNAVAILABLE` (502)
- **Notes**: Validation runs before any provider call. On `PROVIDER_UNAVAILABLE`, no row
  and no audio file are created. Success guarantees a readable audio file (data-model atomic save).

## GET /api/generations

List saved generations, newest-first (FR-012).

- **Response 200**: `{ generations: Generation[] }` (empty array when none — FR drives empty-state UI)

## GET /api/generations/:id/audio

Stream the MP3 for playback or download (FR-013, FR-014).

- **Query**: `?download=1` → sets `Content-Disposition: attachment; filename="<id>.mp3"`
- **Response 200**: binary MP3, `Content-Type: audio/mpeg`. Serves the stored file only —
  makes **no** provider request (SC-003).
- **Errors**: `NOT_FOUND` (404) when the id is unknown; `NOT_FOUND` is also returned when
  the row exists but the audio file is missing/unreadable (surfaced as "unavailable" in UI).

## DELETE /api/generations/:id

Permanently delete an entry and its audio (FR-015). Confirmation is handled in the UI
before this call.

- **Response 204**: no content; row and `data/audio/<id>.mp3` removed.
- **Errors**: `NOT_FOUND` (404)

---

## Contract test checklist (Phase 2 will turn these into tests)

- [ ] `GET /api/voices` returns a non-empty catalog.
- [ ] `POST /api/generations` with valid body returns 201 + a `Generation`; entry appears in `GET /api/generations`.
- [ ] `POST` with empty/whitespace text → 400 `EMPTY_INPUT`, nothing saved.
- [ ] `POST` with >4096 chars → 400 `INPUT_TOO_LONG`, nothing saved.
- [ ] `POST` with unknown voice → 400 `INVALID_VOICE`, nothing saved.
- [ ] `POST` when provider fails → 502 `PROVIDER_UNAVAILABLE`, nothing saved, no orphan file.
- [ ] `GET /api/generations` is ordered newest-first.
- [ ] `GET .../audio` returns `audio/mpeg` and makes no provider call; `?download=1` sets attachment header.
- [ ] `DELETE` removes row + file and returns 204; subsequent `GET .../audio` → 404.
- [ ] After process restart, previously created entries still list and replay.
