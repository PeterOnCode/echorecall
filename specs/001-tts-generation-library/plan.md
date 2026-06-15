# Implementation Plan: Text-to-Speech Generation with Persistent Library

**Branch**: `001-tts-generation-library` | **Date**: 2026-06-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-tts-generation-library/spec.md`

## Summary

Deliver EchoRecall's core web flow: a user enters text, picks a voice, and generates
spoken audio (MP3) that plays in the browser; every successful generation is captured
automatically in a persistent library that survives restarts and can be replayed,
downloaded, and deleted. Technical approach: a framework-agnostic TypeScript **core**
(TTS generation + library persistence) consumed by a thin **Nuxt 4** web adapter
(Vue UI + Nitro server routes). Speech is synthesized via the **OpenAI TTS API**;
metadata is stored in **SQLite** and audio files on the **local filesystem**, both on
mounted volumes so a **Docker Compose** deployment keeps the library intact across
container recreation.

## Technical Context

**Language/Version**: TypeScript (latest stable, `strict`) on Node.js LTS

**Primary Dependencies**: Nuxt 4 (Vue 3, Nitro, Vite); `openai` SDK (TTS); `better-sqlite3` (SQLite driver); Node `node:fs`/`node:crypto` built-ins. `ky` available per constitution for any non-SDK HTTP, not required by this feature.

**Storage**: SQLite for generation metadata (`better-sqlite3`); local filesystem for MP3 audio artifacts. Both under a single `data/` directory mounted as a Docker volume.

**Testing**: Vitest (core unit tests); `@nuxt/test-utils` (component/integration); TTS provider mocked at the core **port boundary** (injected fake), not via live calls — see research for the nock/fetch decision.

**Target Platform**: Dockerized Node.js LTS server (Nitro) serving a browser SPA/SSR client; run via Docker Compose. Modern evergreen browsers for playback (HTML5 `<audio>`, MP3).

**Project Type**: Web application — Nuxt full-stack (Vue frontend + Nitro server) over a shared framework-agnostic core. CLI surface deferred (out of scope for v1) but the core stays CLI-able.

**Performance Goals**: Replaying or downloading a library item makes **zero** provider requests. Library list renders in <1s for typical sizes (hundreds–low thousands of entries). New-generation latency is bounded by the provider; UI shows progress throughout.

**Constraints**: Strict TypeScript, no unjustified `any`. Core has **no** dependency on Nuxt/Vue/Nitro or any CLI library. OpenAI API key supplied via environment only; never persisted to SQLite or written to logs. Audio is MP3. Max input 4,096 characters. No built-in authentication (operator-secured). Single-user.

**Scale/Scope**: Single-user, self-hosted. One feature, ~6 server endpoints, 3 core modules (tts, library, shared), a single primary screen (generate + library). Library expected to grow to low thousands of entries over time; SQLite handles this comfortably (pagination deferred).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against EchoRecall Constitution v2.3.0:

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All code strict TS, incl. Vue `<script setup lang="ts">`; core exports fully typed; no `any` without justification. |
| II. Test-First (NON-NEGOTIABLE) | ✅ PASS | TDD red-green-refactor. Core logic unit-tested; web behavior via `@nuxt/test-utils`; provider mocked at the port (no live HTTP). |
| III. Modular Architecture | ✅ PASS | Self-contained `core/tts`, `core/library`, `core/shared` modules; web (Vue) and server (Nitro) are adapters; no presentation→presentation imports. |
| IV. Shared Core, Multiple Interfaces | ✅ PASS | All domain logic in framework-agnostic `src/core/` (no Nuxt/Vue/Nitro deps). Nitro routes + Vue components are thin adapters. Feature explicitly scoped to web per spec; core remains reachable by a future CLI. |
| V. Simplicity & YAGNI | ✅ PASS | No ORM (thin SQLite repo), no auth, voice-only controls, no pagination/search. Abstractions limited to the one provider port needed for testability. |

**Result**: PASS — no violations. Complexity Tracking section intentionally empty.

Two constitution Follow-up TODOs are resolved in Phase 0 research:
- `TODO(test-http-mocking)` → mock the TTS provider at the core port; avoid relying on nock to intercept the OpenAI SDK's fetch.
- `TODO(openai-key-handling)` → key via Nitro `runtimeConfig` (server-only env), never persisted/logged.

## Project Structure

### Documentation (this feature)

```text
specs/001-tts-generation-library/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── rest-api.md      # HTTP contract for the web server routes
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
└── core/                       # framework-agnostic domain — NO Nuxt/Vue/Nitro/CLI deps
    ├── tts/
    │   ├── provider.ts         # TtsProvider port (interface) + Voice type
    │   ├── openai-provider.ts  # OpenAI TTS adapter (implements TtsProvider)
    │   └── generate.ts         # generate use-case: validate input → call provider → MP3 bytes
    ├── library/
    │   ├── repository.ts       # GenerationRepository port
    │   ├── sqlite-repository.ts# better-sqlite3 implementation
    │   ├── audio-store.ts      # filesystem MP3 read/write/delete
    │   └── library-service.ts  # save / list / get / delete use-cases (composes repo + audio-store)
    ├── shared/
    │   ├── errors.ts           # typed domain errors (EmptyInput, InputTooLong, ProviderUnavailable, NotFound)
    │   ├── ids.ts              # id generation (crypto.randomUUID)
    │   └── types.ts            # shared domain types
    └── index.ts                # public core API surface

app/                            # Nuxt 4 app (thin web adapter)
├── components/                 # GenerateForm.vue, LibraryList.vue, AudioPlayer.vue, ConfirmDialog.vue
├── composables/                # useGeneration.ts, useLibrary.ts (call server routes via ky/$fetch)
└── pages/
    └── index.vue               # primary screen: generate + library

server/                         # Nitro server (thin adapter → core)
├── api/
│   ├── voices.get.ts
│   ├── generations.post.ts          # create generation (+ auto-save)
│   ├── generations.get.ts           # list (newest-first)
│   ├── generations/[id].delete.ts   # confirm handled client-side; permanent delete
│   └── generations/[id]/audio.get.ts# stream/download MP3
└── utils/
    └── container.ts            # wires core: provider + repository + service (DI)

tests/
├── unit/                       # core unit tests (Vitest) — tts, library, shared
├── integration/                # server routes ↔ core, SQLite + fs round-trips
└── component/                  # @nuxt/test-utils component tests

data/                           # runtime, git-ignored, Docker volume mount
├── echorecall.db               # SQLite database
└── audio/                      # <generation-id>.mp3 files

Dockerfile
docker-compose.yml
```

**Structure Decision**: Web-application layout with an explicit framework-agnostic
core. Domain logic (TTS generation, library persistence) lives in `src/core/`,
depending only on the OpenAI SDK, the SQLite driver, and Node built-ins — never on
Nuxt/Vue/Nitro (Principle IV). The Nuxt `app/` (Vue UI) and `server/` (Nitro API)
are thin adapters: components call composables, composables call server routes,
server routes call the core via a small DI container. Runtime state (SQLite DB +
MP3 files) lives under `data/`, mounted as a Docker volume so the library survives
container recreation. A `.gitignore` entry for `data/` (and `node_modules/`,
`.nuxt/`, `.output/`) will be added in the setup tasks.

## Complexity Tracking

> No constitution violations — section intentionally empty.
