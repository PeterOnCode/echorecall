<!--
SYNC IMPACT REPORT
==================
Version change: 2.2.0 → 2.3.0
Bump rationale: MINOR — the Technology Stack was materially changed to match
  EchoRecall's actual architecture (rebuild of echoquize): the core AI capability
  is OpenAI text-to-speech (not Claude), and persistence (SQLite + local
  filesystem) and deployment (Docker / Docker Compose) tooling are now declared.
  New/changed stack guidance = MINOR; this is not a typo (PATCH) nor a principle
  change (MAJOR) — all five principles are untouched.
Modified principles: none — all five core principles unchanged.
Added sections: none (the Technology Stack section was expanded, not added).
Removed sections: none.
Changed stack entries:
  - AI integration → Text-to-speech: replaced "Claude (Anthropic SDK,
    claude-sonnet-4-6)" with "OpenAI TTS API (OpenAI SDK)".
  - Added "Persistence": SQLite for generation metadata; local filesystem for
    generated audio artifacts; the library MUST survive restarts.
  - Added "Packaging & deployment": ships as a Docker image run via Docker Compose.
Templates requiring updates:
  ✅ plan-template.md   — technology-agnostic; Constitution Check is derived from
                          this file at plan time; web + cli structure options present
  ✅ spec-template.md   — technology-agnostic; no change required
  ✅ tasks-template.md  — generic scaffold; no change required
  (verified 2026-06-15: grep found no template references to the changed entries)
Follow-up TODOs:
  - TODO(test-http-mocking): ky is fetch-based (undici on Node). Older nock
    releases only patch node:http and will NOT intercept fetch. Confirm the
    chosen nock version supports fetch interception, or switch to MSW /
    @mswjs/interceptors (fetch-native). Resolve before the first HTTP CLI test.
  - TODO(openai-key-handling): OpenAI TTS requires an API key. Define how the key
    is supplied (environment configuration) and ensure it is never persisted to
    SQLite or written to logs. Resolve during the plan for the first generation
    feature.
-->

# EchoRecall Constitution

## Core Principles

### I. TypeScript-First

The project MUST be written in strict TypeScript, including Vue single-file
components (`<script setup lang="ts">`). `any` is forbidden without an explicit,
documented justification comment. All public APIs and shared-core exports MUST
carry full type signatures. `tsconfig.json` and Nuxt's generated TypeScript
config MUST run in `strict` mode with no weakening overrides.

**Rationale**: Type safety catches entire classes of bugs at compile time and
makes the codebase self-documenting — critical when rebuilding an existing tool
and when the same core is consumed by two independent interfaces.

### II. Test-First (NON-NEGOTIABLE)

TDD is mandatory:

1. Write tests. Get user/reviewer approval.
2. Confirm tests fail (red).
3. Implement until tests pass (green).
4. Refactor.

The Red-Green-Refactor cycle MUST be respected. No implementation task is
accepted without a preceding failing test or an explicit documented exemption.
Shared-core logic MUST be covered by unit tests; web UI behaviour MUST be
covered by component/integration tests (via `@nuxt/test-utils`); HTTP
interactions MUST be tested against mocked network responses, never live calls.

**Rationale**: Rebuilding echoquize means the acceptance criteria are known
upfront. Tests encode that knowledge before code can drift, and a tested core
keeps the web UI and CLI in agreement.

### III. Modular Architecture

Features MUST be implemented as self-contained modules with clear boundaries.
Each module MUST be independently importable, testable, and replaceable without
touching other modules. Domain logic lives in the shared core (see Principle IV);
cross-cutting utilities live in a dedicated `src/core/shared/` location only.
No ad-hoc cross-module imports, and no presentation layer (web or CLI) may import
from another presentation layer — both depend only on the core.

**Rationale**: Modular boundaries prevent the second-system effect when porting
an existing application; they also make incremental delivery per user story
possible and keep the two interfaces decoupled.

### IV. Shared Core, Multiple Interfaces

EchoRecall ships two user-facing surfaces — a Nuxt web UI and a native
command-line interface — over a single framework-agnostic core.

- All domain/business logic MUST live in a shared core (`src/core/` or a
  dedicated `core` package) that has NO dependency on Nuxt, Vue, Nitro, or any
  terminal/CLI library.
- The Nuxt web app and the CLI MUST be thin adapters: Vue components,
  composables, Nitro routes, and CLI command handlers translate input/output but
  MUST NOT contain domain logic.
- Every capability MUST be reachable from the core programmatically. A feature
  exposed in one interface SHOULD be reachable from the other unless the spec
  explicitly scopes it to a single surface.
- The CLI MUST follow stdin/args → stdout, errors → stderr, and support both
  JSON and human-readable output via a `--format` flag.

**Rationale**: A headless core lets logic be unit-tested without a browser or a
spawned process, keeps the two interfaces at feature parity, and prevents domain
rules from leaking into presentation code where they cannot be reused.

### V. Simplicity & YAGNI

Complexity MUST be justified in writing. Abstractions are added only when the
same pattern appears three or more times. Features not required by the current
specification are deferred, not anticipated. No premature generalisation.

**Rationale**: Porting projects accumulate scope creep from "while we're at it"
impulses. This principle keeps the build focused and the codebase auditable.

## Technology Stack

- **Language**: TypeScript (latest stable, strict mode)
- **Web framework**: Nuxt 4 (Vue 3, Nitro server, Vite) for the web UI
- **Runtime**: Node.js LTS for both the Nuxt web app / Nitro server and the CLI
- **CLI command parser**: cac (commander is an acceptable alternative)
- **CLI styling**: chalk
- **HTTP client**: ky (fetch-based)
- **Control-flow dispatch**: ts-pattern (exhaustive command/result matching)
- **Text-to-speech**: OpenAI TTS API via the official OpenAI SDK. Converting text
  to spoken audio is EchoRecall's core capability; the API key MUST be supplied
  via environment configuration and MUST NOT be persisted to storage or written
  to logs.
- **Persistence**: SQLite for generation metadata (text, voice, timestamps,
  identifiers); the local filesystem for generated audio artifacts. The library
  MUST persist across application and container restarts.
- **Package manager**: pnpm (preferred) or npm
- **Test framework**: Vitest; `@nuxt/test-utils` for web UI component/integration
  tests; nock for HTTP mocking in CLI/core tests (see Follow-up TODO in the Sync
  Impact Report — verify fetch interception)
- **Linting/formatting**: ESLint + Prettier with project-shared config
- **Build**: Nuxt build for the web app; tsup or tsc for the shared core and CLI
- **Packaging & deployment**: ships as a Docker image run via Docker Compose;
  persistent SQLite data and audio files MUST live on mounted volumes so they
  survive container recreation.

Technology choices outside this list MUST be approved as a constitution amendment.

## Development Workflow

- All work begins from a feature branch created with `/speckit-git-feature`.
- Specs (`/speckit-specify`) and plans (`/speckit-plan`) are required before any
  implementation begins.
- Tasks (`/speckit-tasks`) drive implementation; each task maps to one user story.
- Web UI and CLI changes both follow the spec → plan → tasks flow; neither
  surface may introduce domain logic outside the shared core (Principle IV).
- Commits are made via `/speckit-git-commit` after each logical unit of work.
- No direct pushes to `main`. All changes arrive via pull request.
- Constitution Check in `plan.md` MUST be completed before Phase 0 research.

## Governance

This constitution supersedes all other practices and informal agreements.

**Amendment procedure**:
1. Open a spec (`/speckit-specify`) describing the proposed change and rationale.
2. Update this file and increment `CONSTITUTION_VERSION` per semantic versioning:
   - MAJOR: principle removed or redefined in a backward-incompatible way.
   - MINOR: new principle or section added.
   - PATCH: wording clarification, typo fix, non-semantic refinement.
3. All open plans and task lists MUST be reviewed for conflicts after amendment.
4. Compliance is reviewed at the start of each plan phase (Constitution Check).

All PRs and reviews MUST verify compliance with the five core principles. Any
deviation requires a Complexity Tracking entry in `plan.md` with explicit
justification.

**Version**: 2.3.0 | **Ratified**: 2026-06-15 | **Last Amended**: 2026-06-15
