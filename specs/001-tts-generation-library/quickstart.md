# Quickstart & Validation: Text-to-Speech Generation with Persistent Library

**Feature**: `001-tts-generation-library` | **Date**: 2026-06-15

A runnable guide to prove the feature works end-to-end. Details live in
[spec.md](./spec.md), [data-model.md](./data-model.md), and
[contracts/rest-api.md](./contracts/rest-api.md) — not duplicated here.

## Prerequisites

- Node.js LTS and pnpm installed (local dev), or Docker + Docker Compose (deployment).
- An OpenAI API key with TTS access.
- Environment variable `NUXT_OPENAI_API_KEY=<key>` (server-only; never committed).

## Local development

```bash
pnpm install
echo "NUXT_OPENAI_API_KEY=sk-..." > .env      # not committed
pnpm dev                                       # Nuxt dev server
```

Open the app, then validate the user stories below.

## Run the tests (TDD — these are written before implementation)

```bash
pnpm test            # Vitest: core unit + server integration
pnpm test:component  # @nuxt/test-utils component tests
```

Expected: contract checklist in [contracts/rest-api.md](./contracts/rest-api.md) and the
data-model integrity rules are covered; the TTS provider is mocked at the port boundary
(no live network calls in the suite).

## Docker Compose (persistence proof)

```bash
docker compose up --build -d
```

`docker-compose.yml` mounts a volume at `./data` (SQLite DB + `audio/` MP3s) so the
library survives container recreation.

## Acceptance validation (maps to spec)

### US1 — Generate and listen (P1)
1. Enter text, select a voice, click Generate.
2. **Expect**: progress feedback, then audio plays in the browser. *(FR-001/003/004/005, SC-001)*
3. Enter empty text → **expect** a clear rejection, no generation. *(FR-007)*
4. Paste >4,096 chars → **expect** the limit is shown, input preserved. *(FR-008)*
5. Simulate provider failure (invalid key / offline) → **expect** a clear error and your
   text + voice remain in the form; nothing is saved. *(FR-006, SC-004)*

### US2 — Automatic library capture (P2)
1. Generate two items → **expect** both appear in the library, newest-first. *(FR-009/012)*
2. `docker compose restart` (or restart `pnpm dev`) → **expect** both still listed. *(FR-011, SC-002)*
3. Replay a past item → **expect** playback with **no** new generation. Confirm via
   provider call count / network tab: zero TTS requests. *(FR-013, SC-003)*

### US3 — Retrieve and manage (P3)
1. Download an entry → **expect** an `<id>.mp3` file that plays locally. *(FR-014)*
2. Delete an entry → **expect** a confirmation prompt; after confirming, it disappears
   and stays gone after a restart; its audio is no longer retrievable. *(FR-015, SC-006)*

## Done signals

- All contract checklist items pass.
- All three user stories validate as above.
- Test suite is green with zero live provider calls.
