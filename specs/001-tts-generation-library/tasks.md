---
description: "Task list for Text-to-Speech Generation with Persistent Library"
---

# Tasks: Text-to-Speech Generation with Persistent Library

**Input**: Design documents from `/specs/001-tts-generation-library/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rest-api.md

**Tests**: INCLUDED and REQUIRED — the constitution's Principle II (Test-First) is
NON-NEGOTIABLE. Every test task MUST be written and confirmed failing (red) before its
implementation task (green), then refactor. TTS provider is mocked at the core port; no
live network calls in the suite.

**Organization**: Grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (maps to spec.md user stories)
- All paths are repo-relative per plan.md structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and tooling

- [X] T001 Initialize Nuxt 4 + strict TypeScript project with pnpm at repo root (`package.json`, `nuxt.config.ts`, `tsconfig.json` with `strict: true`)
- [X] T002 [P] Install runtime dependencies: `openai`, `better-sqlite3`, `@types/better-sqlite3`
- [X] T003 [P] Install and configure Vitest + `@nuxt/test-utils` (`vitest.config.ts`, `tests/setup.ts`)
- [X] T004 [P] Configure ESLint + Prettier shared config (`eslint.config.mjs`, `.prettierrc`)
- [X] T005 [P] Add `.gitignore` for `data/`, `node_modules/`, `.nuxt/`, `.output/`, `.env`
- [X] T006 Create source tree skeleton: `src/core/{tts,library,shared}/`, `app/{components,composables,pages}/`, `server/{api,utils}/`, `tests/{unit,integration,component}/`, `data/audio/`
- [X] T007 Configure TS path alias `~~/core` → `src/core` in `tsconfig.json` and `nuxt.config.ts`
- [X] T008 Configure Nitro `runtimeConfig.openaiApiKey` from `NUXT_OPENAI_API_KEY` (server-only) in `nuxt.config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared domain, persistence backbone, DI, and app shell used by ALL stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T009 [P] Define shared domain types (`Generation`, `Voice`, `GenerationInput`) in `src/core/shared/types.ts`
- [X] T010 [P] Define typed domain errors (`EmptyInput`, `InputTooLong`, `InvalidVoice`, `ProviderUnavailable`, `NotFound`) in `src/core/shared/errors.ts`
- [X] T011 [P] Implement UUID id generation (`crypto.randomUUID` wrapper) in `src/core/shared/ids.ts`
- [X] T012 [P] Define `TtsProvider` port + `VOICES` catalog constant in `src/core/tts/provider.ts`
- [X] T013 [P] Define `GenerationRepository` port in `src/core/library/repository.ts`
- [X] T014 Implement domain-error → `ApiError` envelope/status mapper in `server/utils/errors.ts` (depends on T010)
- [X] T015 [P] Unit test (RED) for SQLite repository — save/get/list newest-first/delete — in `tests/unit/sqlite-repository.test.ts`
- [X] T016 [P] Unit test (RED) for audio-store — write/read/delete + missing-file — in `tests/unit/audio-store.test.ts`
- [X] T017 [P] Unit test (RED) for library-service — atomic save, cascade delete, orphan cleanup on failure — in `tests/unit/library-service.test.ts`
- [X] T018 Implement `better-sqlite3` repository (connection, schema+index bootstrap, CRUD, newest-first) in `src/core/library/sqlite-repository.ts` (depends on T013, T015)
- [X] T019 Implement filesystem audio-store (read/write/delete MP3 under `data/audio/`) in `src/core/library/audio-store.ts` (depends on T010, T016)
- [X] T020 Implement `library-service` (save/list/get/delete; atomic file-then-row save, cascade delete) in `src/core/library/library-service.ts` (depends on T017, T018, T019)
- [X] T021 [P] Implement public core API exports in `src/core/index.ts`
- [X] T022 Implement DI container singletons (repository, audioStore, libraryService, ttsProvider) in `server/utils/container.ts` (depends on T020, T021)
- [X] T023 Create base app shell (`app/app.vue`, `app/pages/index.vue` skeleton) (depends on T007)

**Checkpoint**: Foundation ready — persistence, ports, DI, and app shell exist

---

## Phase 3: User Story 1 - Generate and listen (Priority: P1) 🎯 MVP

**Goal**: Enter text, pick a voice, generate spoken audio that plays in the browser (and is persisted under the hood).

**Independent Test**: Enter text, select a voice, generate → hear audio. Empty/too-long/invalid-voice/provider-failure each show a clear message with input preserved.

### Tests for User Story 1 (write first, confirm RED) ⚠️

- [X] T024 [P] [US1] Unit test for generate use-case (validation + mocked `TtsProvider`: empty→EmptyInput, >4096→InputTooLong, bad voice→InvalidVoice, provider throw→ProviderUnavailable, success→MP3 bytes) in `tests/unit/generate.test.ts`
- [ ] T025 [P] [US1] Integration test `POST /api/generations` (201 + saved entry; 400 EMPTY_INPUT/INPUT_TOO_LONG/INVALID_VOICE; 502 PROVIDER_UNAVAILABLE with nothing persisted) in `tests/integration/generations-post.test.ts`
- [ ] T026 [P] [US1] Integration test `GET /api/voices` returns non-empty catalog in `tests/integration/voices-get.test.ts`
- [ ] T027 [P] [US1] Integration test `GET /api/generations/:id/audio` returns `audio/mpeg` and makes NO provider call in `tests/integration/audio-get.test.ts`
- [ ] T028 [P] [US1] Component test `GenerateForm` (submit shows progress; error preserves text+voice) in `tests/component/GenerateForm.test.ts`

### Implementation for User Story 1

- [X] T029 [US1] Implement OpenAI TTS adapter (`gpt-4o-mini-tts`, `response_format: mp3`, key from injected config) in `src/core/tts/openai-provider.ts` (depends on T012)
- [X] T030 [US1] Implement generate use-case (validate input → call provider → return MP3 bytes; map errors) in `src/core/tts/generate.ts` (depends on T024, T029)
- [X] T031 [US1] Wire `ttsProvider` (OpenAI adapter) into `server/utils/container.ts` (depends on T029)
- [X] T032 [US1] Implement `GET /api/voices` route in `server/api/voices.get.ts` (depends on T012)
- [X] T033 [US1] Implement `POST /api/generations` route (generate → auto-save via libraryService → return `Generation`) in `server/api/generations.post.ts` (depends on T030, T020, T014)
- [X] T034 [US1] Implement `GET /api/generations/[id]/audio` route (stream stored MP3, `audio/mpeg`, no provider call) in `server/api/generations/[id]/audio.get.ts` (depends on T020, T014)
- [X] T035 [US1] Implement `useGeneration` composable (call voices + POST, track idle/submitting/success/error) in `app/composables/useGeneration.ts` (depends on T032, T033)
- [X] T036 [P] [US1] Implement `GenerateForm.vue` (text input w/ 4096 counter, voice select, submit, progress, error display preserving input) in `app/components/GenerateForm.vue` (depends on T035)
- [X] T037 [P] [US1] Implement `AudioPlayer.vue` (HTML5 audio for the returned `audioUrl`) in `app/components/AudioPlayer.vue`
- [X] T038 [US1] Wire `GenerateForm` + `AudioPlayer` into `app/pages/index.vue` (depends on T036, T037)

**Checkpoint**: US1 fully functional — generate + listen works end-to-end (MVP)

---

## Phase 4: User Story 2 - Automatic library capture (Priority: P2)

**Goal**: Every successful generation is browsable in a persistent library that survives restarts and can be replayed without regenerating.

**Independent Test**: Generate two items, restart the app, open the library → both listed newest-first; replay one with zero provider calls.

### Tests for User Story 2 (write first, confirm RED) ⚠️

- [ ] T039 [P] [US2] Integration test `GET /api/generations` (newest-first ordering; entries persist across a fresh repository/process) in `tests/integration/generations-get.test.ts`
- [ ] T040 [P] [US2] Component test `LibraryList` (renders entries; empty-state message; replay triggers AudioPlayer) in `tests/component/LibraryList.test.ts`

### Implementation for User Story 2

- [ ] T041 [US2] Implement `GET /api/generations` route (list newest-first) in `server/api/generations.get.ts` (depends on T020, T014)
- [ ] T042 [US2] Implement `useLibrary` composable (fetch list, select item for replay) in `app/composables/useLibrary.ts` (depends on T041)
- [ ] T043 [P] [US2] Implement `LibraryList.vue` (list of past generations, empty-state, replay button reusing `AudioPlayer`) in `app/components/LibraryList.vue` (depends on T042, T037)
- [ ] T044 [US2] Integrate `LibraryList` into `app/pages/index.vue` and refresh it after a successful generation (depends on T043, T038)

**Checkpoint**: US1 + US2 work — generate, persist, browse, and replay

---

## Phase 5: User Story 3 - Retrieve and manage (Priority: P3)

**Goal**: Download any past generation's audio and delete entries (with confirmation, permanent).

**Independent Test**: Download an entry → playable `<id>.mp3`; delete an entry → confirmation prompt, then it's gone (after restart too) and its audio 404s.

### Tests for User Story 3 (write first, confirm RED) ⚠️

- [ ] T045 [P] [US3] Integration test `DELETE /api/generations/:id` (204; row + file removed; subsequent audio GET → 404; unknown id → 404) in `tests/integration/generations-delete.test.ts`
- [ ] T046 [P] [US3] Integration test audio download (`?download=1` sets `Content-Disposition: attachment`) in `tests/integration/audio-download.test.ts`
- [ ] T047 [P] [US3] Component test delete flow (`ConfirmDialog` confirm → delete; cancel → no-op) in `tests/component/LibraryItemActions.test.ts`

### Implementation for User Story 3

- [ ] T048 [US3] Implement `DELETE /api/generations/[id]` route (permanent delete via libraryService) in `server/api/generations/[id].delete.ts` (depends on T020, T014)
- [ ] T049 [US3] Add `?download=1` attachment handling to `server/api/generations/[id]/audio.get.ts` (depends on T034)
- [ ] T050 [P] [US3] Implement `ConfirmDialog.vue` (reusable confirm prompt) in `app/components/ConfirmDialog.vue`
- [ ] T051 [US3] Add download + delete (with `ConfirmDialog`) actions to `LibraryList.vue` / `useLibrary.ts` (depends on T048, T049, T050, T043)

**Checkpoint**: All three user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Deployment packaging, accessibility, and end-to-end validation

- [ ] T052 [P] Add `Dockerfile` (Node LTS build of the Nuxt app)
- [ ] T053 Add `docker-compose.yml` mounting `./data` as a volume (SQLite + audio persistence) and passing `NUXT_OPENAI_API_KEY`
- [ ] T054 [P] Accessibility pass: form labels, audio controls, focus/keyboard on dialog (`app/components/*`)
- [ ] T055 [P] Add `README.md` with setup + run instructions referencing `quickstart.md`
- [ ] T056 Run full `quickstart.md` validation end-to-end (all contract-checklist items + US1–US3 acceptance)
- [ ] T057 Final lint + typecheck + full test suite green (`pnpm lint`, `pnpm typecheck`, `pnpm test`)

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)**: no dependencies
- **Foundational (P2)**: depends on Setup — BLOCKS all user stories
- **US1 (P3)** → **US2 (P4)** → **US3 (P5)**: each depends only on Foundational and is independently testable. US2 and US3 surface/extend persistence already built in Foundational; US3 reuses the audio route from US1.
- **Polish (P6)**: after the desired stories are complete

### Story independence

- **US1**: needs Foundational only. Delivers generate + listen (MVP).
- **US2**: needs Foundational only (list + replay over the existing persistence). Reuses `AudioPlayer` from US1 but is testable on its own via the API + component.
- **US3**: needs Foundational; extends the US1 audio route and the US2 list UI, but its delete/download behavior is independently testable.

### Within each story

- Test tasks (RED) before implementation (GREEN), then refactor — NON-NEGOTIABLE.
- Core (ports/use-cases) before routes; routes before composables; composables before components; components before page wiring.

---

## Parallel Opportunities

- Setup: T002, T003, T004, T005 in parallel.
- Foundational: T009–T013 in parallel; the three RED unit tests T015–T017 in parallel (before their implementations T018–T020).
- US1 tests T024–T028 in parallel; then `GenerateForm` (T036) and `AudioPlayer` (T037) in parallel.
- Across stories: once Foundational is done, US1/US2/US3 can be staffed in parallel by different developers (mind the shared files: `index.vue`, `LibraryList.vue`, `audio.get.ts`).

### Parallel example — User Story 1 tests

```text
Task: "Unit test generate use-case in tests/unit/generate.test.ts"
Task: "Integration test POST /api/generations in tests/integration/generations-post.test.ts"
Task: "Integration test GET /api/voices in tests/integration/voices-get.test.ts"
Task: "Integration test GET audio in tests/integration/audio-get.test.ts"
Task: "Component test GenerateForm in tests/component/GenerateForm.test.ts"
```

---

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP & validate** generate+listen → demo.

### Incremental delivery

Setup + Foundational → US1 (MVP, demo) → US2 (library, demo) → US3 (manage, demo). Each story adds value without breaking the previous.

---

## Notes

- [P] = different files, no incomplete dependencies.
- Provider is mocked at the `TtsProvider` port in all tests; the real `openai-provider` is exercised only by its own narrow adapter test (kept out of the default suite if it would require a live key).
- Secret hygiene: never log or persist `NUXT_OPENAI_API_KEY` (research §4).
- Commit after each task or logical group (e.g., via `/speckit-git-commit`).
- Total: 57 tasks — Setup 8, Foundational 15, US1 15, US2 6, US3 7, Polish 6.
