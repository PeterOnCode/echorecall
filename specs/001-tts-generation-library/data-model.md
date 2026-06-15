# Phase 1 Data Model: Text-to-Speech Generation with Persistent Library

**Feature**: `001-tts-generation-library` | **Date**: 2026-06-15

Derived from the spec's Key Entities and Functional Requirements. Only **successful**
generations are persisted; in-progress and failed attempts are transient UI state and
are never written (FR-006, FR-009).

## Entity: Generation (library entry)

One persisted text-to-speech result. Immutable after creation (FR-016).

| Field | Type | Rules |
|-------|------|-------|
| `id` | string (UUID v4) | Primary key. Generated via `crypto.randomUUID()`. Also the audio filename stem. |
| `text` | string | Required. Non-empty after trim (FR-007). Length ≤ 4,096 chars (FR-008). The source text, stored verbatim. |
| `voiceId` | string | Required. Must match an `id` in the Voice catalog (FR-002). |
| `createdAt` | string (ISO 8601 UTC) | Required. Set at save time. Sort key for newest-first listing. |

- **Derived**: `audioPath` = `audio/<id>.mp3` relative to the `data/` root (not stored as
  a column — derived from `id`, since format is fixed MP3).
- **Relationships**: 1:1 with an Audio artifact. Standalone otherwise (no grouping/tags in v1).
- **Lifecycle**: `created` → (optionally) `deleted`. No edit/update path. Deletion is
  permanent and removes the row and the audio file together (FR-015).

### SQLite schema

```sql
CREATE TABLE IF NOT EXISTS generations (
  id         TEXT PRIMARY KEY,
  text       TEXT NOT NULL,
  voice_id   TEXT NOT NULL,
  created_at TEXT NOT NULL          -- ISO 8601 UTC
);

CREATE INDEX IF NOT EXISTS idx_generations_created_at
  ON generations (created_at DESC); -- newest-first listing
```

## Entity: Voice

A selectable speaking voice offered by the provider. **Not stored in the database** —
a read-only catalog constant in the core (the provider exposes no list endpoint).

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Stable provider voice identifier (e.g. `alloy`). Referenced by `Generation.voiceId`. |
| `label` | string | Human-readable display name for the UI. |

- **Source of truth**: `core/tts/provider.ts` constant. Served read-only via `GET /api/voices`.
- **Validation**: A generation request's `voiceId` MUST be a member of this catalog,
  else the request is rejected before any provider call.

## Entity: Audio artifact

The stored MP3 produced for a Generation.

| Aspect | Value |
|--------|-------|
| Location | `data/audio/<generationId>.mp3` (filesystem) |
| Format | MP3 (`audio/mpeg`) — fixed (clarification) |
| Cardinality | Exactly one per Generation |
| Creation | Written atomically when a generation succeeds, before the DB row is committed |
| Deletion | Removed together with its Generation row (FR-015) |
| Missing-file handling | If the row exists but the file is absent/unreadable, the entry surfaces an "unavailable" state instead of erroring the whole library (edge case) |

## Integrity rules

- **Atomic save**: Persist audio file first, then insert the DB row. If the row insert
  fails, the orphan file is cleaned up; if the audio write fails, no row is created.
  Net effect: a library entry always has a readable audio file at creation time.
- **No duplicates merging**: Identical `text` + `voiceId` produces a new, independent row
  (no de-duplication) — matches the spec edge case.
- **Cascade delete**: Deleting a Generation deletes both its row and `data/audio/<id>.mp3`.
- **Secret hygiene**: The OpenAI API key is never a field on any entity and never stored.

## Transient (non-persisted) generation state

Tracked only in the web client for UX (FR-005/006); never written to storage:

`idle → submitting → (success | error)` — on `error`, the user's `text` and `voiceId`
selection are preserved in the form.
