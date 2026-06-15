# Phase 0 Research: Text-to-Speech Generation with Persistent Library

**Feature**: `001-tts-generation-library` | **Date**: 2026-06-15

All Technical Context items were resolvable from the constitution (v2.3.0) and the
spec clarifications; no `NEEDS CLARIFICATION` markers remain. This document records
the supporting decisions, including the two constitution Follow-up TODOs.

## 1. SQLite access layer

- **Decision**: Use `better-sqlite3` directly with a thin repository module. No ORM.
- **Rationale**: Synchronous API is simple and fast for a single-user, single-process
  self-hosted app; mature and widely used; trivial to unit-test. Avoids an ORM's
  abstraction tax, satisfying Principle V (YAGNI).
- **Alternatives considered**: `node:sqlite` (still experimental on current LTS — stability risk);
  Drizzle/Prisma (extra layer and migration tooling not justified for a handful of columns).

## 2. Text-to-speech provider

- **Decision**: Official `openai` SDK calling the TTS endpoint. Voice is user-selected
  from a fixed catalog of OpenAI voices; model and output format are fixed defaults
  (`gpt-4o-mini-tts`, `response_format: "mp3"`). The voice catalog is a constant in
  the core (the provider does not expose a list endpoint).
- **Rationale**: Matches the constitution's mandated provider. MP3 output matches the
  clarified format decision. Fixing model/format matches the "voice only" clarification
  and keeps the data model minimal.
- **Alternatives considered**: Raw HTTP via `ky` (re-implements what the SDK gives for
  free); `tts-1`/`tts-1-hd` models (kept as a single fixed default; selectable models
  are out of scope).

## 3. Test HTTP mocking strategy — resolves `TODO(test-http-mocking)`

- **Decision**: Mock the TTS provider at the **core port boundary**. `core/tts/provider.ts`
  defines a `TtsProvider` interface; tests inject a fake implementation. The OpenAI
  network call lives only inside `openai-provider.ts`, which is exercised by a small,
  separately-gated adapter test. Core use-case and server-route tests never touch the network.
- **Rationale**: The OpenAI SDK uses `fetch` (undici); older `nock` patches `node:http`
  and would not intercept it — exactly the constitution's concern. Port-boundary mocking
  sidesteps this entirely, gives faster deterministic tests, and aligns with Principles
  II–IV. If a real HTTP-level mock is ever needed, use MSW / `@mswjs/interceptors`
  (fetch-native) rather than nock.
- **Alternatives considered**: `nock` (will not reliably intercept fetch); live calls
  (forbidden by Principle II).

## 4. OpenAI API key handling — resolves `TODO(openai-key-handling)`

- **Decision**: Key is read server-side only via Nitro `runtimeConfig` from the
  `OPENAI_API_KEY` (`NUXT_OPENAI_API_KEY`) environment variable, injected into the
  `openai-provider` at construction time in `server/utils/container.ts`. It is never
  sent to the client, never written to SQLite, and never logged. Error messages
  surfaced to users describe the failure without echoing the key.
- **Rationale**: Satisfies the constitution constraint and standard secret-handling.
  `runtimeConfig` keeps server-only secrets out of the client bundle by design.
- **Alternatives considered**: Public runtime config / client-side key (would leak the
  secret); storing in SQLite (explicitly forbidden).

## 5. Audio artifact storage

- **Decision**: Store each generation's MP3 on the filesystem at `data/audio/<id>.mp3`,
  with the path/id recorded in SQLite. Serve via a Nitro route that streams the file
  with `Content-Type: audio/mpeg`; downloads set `Content-Disposition: attachment`.
- **Rationale**: Keeps binary blobs out of SQLite (smaller DB, easy backup/serving);
  filesystem + DB both live under the mounted `data/` volume so they persist together.
- **Alternatives considered**: BLOB-in-SQLite (bloats DB, complicates streaming);
  object storage (overkill for self-hosted single-user).

## 6. Identifiers

- **Decision**: `crypto.randomUUID()` for generation ids (also the audio filename stem).
- **Rationale**: Built-in, collision-free, no dependency; opaque and URL-safe.
- **Alternatives considered**: Auto-increment integers (enumerable; couples filename to
  DB sequence); nanoid (extra dependency for no added benefit).

## 7. Core ↔ Nuxt wiring

- **Decision**: Expose the core through `src/core/index.ts`; reference it from Nuxt via a
  TypeScript path alias (e.g. `~~/core` → `src/core`). The Nitro layer constructs the
  concrete provider + repository once in `server/utils/container.ts` and passes them to
  core services.
- **Rationale**: Keeps the dependency direction one-way (adapters → core), enforces
  Principle IV, and makes the core importable by a future CLI without change.
- **Alternatives considered**: Core logic inside `server/` (violates Principle IV);
  publishing core as a separate workspace package (defer until a second interface exists — YAGNI).

## 8. Library ordering & validation rules (from spec)

- **Decision**: List ordered by creation timestamp descending (newest-first). Input
  validation in core: reject empty/whitespace (`EmptyInput`), reject >4,096 chars
  (`InputTooLong`) before any provider call. Provider/network failures map to
  `ProviderUnavailable`; nothing is persisted on failure.
- **Rationale**: Directly encodes FR-006/007/008 and the clarified limit; centralizing
  validation in core keeps the web adapter thin and the rules unit-testable.
- **Alternatives considered**: Validating in the Vue/Nitro layer (would duplicate rules
  across the future CLI; violates Principle IV).

## Resolved unknowns summary

| Topic | Resolution |
|-------|-----------|
| SQLite layer | `better-sqlite3`, thin repo, no ORM |
| TTS provider | `openai` SDK, `gpt-4o-mini-tts`, mp3, voice-only |
| HTTP test mocking | Port-boundary fake; MSW if ever needed; not nock |
| API key | Server-only `runtimeConfig`; never persisted/logged |
| Audio storage | Filesystem `data/audio/<id>.mp3`, streamed by Nitro |
| IDs | `crypto.randomUUID()` |
| Core wiring | `src/core` + path alias; DI in `server/utils/container.ts` |
| Ordering/validation | Newest-first; core-side input validation |
