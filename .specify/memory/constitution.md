<!--
SYNC IMPACT REPORT
==================
Version change: 2.5.0 → 2.6.0
Bump rationale: MINOR — the Technology Stack gains a new approved entry for
  structured-data parsing: the `yaml` package in the shared core. This permits
  standards-compliant YAML 1.2 parsing and JSON duplicate-property preflight for
  untrusted batch documents while requiring strict duplicate-key checks and rejection
  of custom tags, anchors, and aliases. It expands the approved stack without adding,
  removing, or redefining a core principle. Requested by feature 008-batch-import,
  whose plan identified the dependency as a pre-implementation governance gate.
Modified principles: none — all five core principles unchanged.
Modified sections:
  - Technology Stack: ADDED a "Structured-data parsing (shared core)" entry permitting
    direct `yaml` use in `src/core/` for YAML 1.2 parsing and source-aware syntax
    validation, including JSON duplicate-property preflight. Untrusted input MUST use
    strict parsing and reject duplicate keys/properties, custom tags, anchors, and
    aliases unless a future constitution amendment explicitly broadens that policy.
Added sections: none (new bullet within existing Technology Stack section).
Removed sections: none.
Templates requiring updates:
  ✅ plan-template.md   — technology-agnostic; Constitution Check derived at plan time; no change
  ✅ spec-template.md   — technology-agnostic; no change required
  ✅ tasks-template.md  — generic scaffold; no change required
  ✅ templates/commands — directory absent; no command templates to update
  (verified 2026-07-19: no template hardcodes the technology-stack list)
Active feature artifacts:
  ✅ specs/008-batch-import/plan.md — governance gate updated to approved
  ✅ specs/008-batch-import/research.md — dependency approval recorded
  ✅ specs/008-batch-import/quickstart.md — obsolete amendment prerequisite removed
Runtime docs:
  ✅ AGENTS.md remains aligned — core/adapters/testing rules are unchanged
  ✅ CLAUDE.md already points to the active Feature 008 plan
  ✅ README.md update deferred until Feature 008 ships; it describes the current
    runtime and MUST NOT claim an unimplemented dependency or import workflow
Follow-up TODOs:
  - TODO(test-http-mocking): unchanged — confirm fetch interception (MSW /
    @mswjs/interceptors vs nock) before the first HTTP CLI test.
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
- **Audio visualization (web UI)**: `wavesurfer.js` (with its regions and zoom
  plugins) MAY be used in the Nuxt web UI for client-side waveform display, zoom, and
  loop-region playback. This is a presentation-only concern: it MUST remain in the web
  adapter (`app/`), MUST NOT be imported by `src/core/` or the CLI (Principle IV), and
  MUST be used solely to display and play audio — never to modify, trim, transcode, or
  export it.
- **Structured-data parsing (shared core)**: `yaml` MAY be used as a direct dependency
  in the framework-independent shared core for standards-compliant YAML 1.2 parsing,
  source-aware syntax validation, and JSON duplicate-property preflight. Parsing
  untrusted documents MUST enable strict duplicate-key/property checks and MUST reject
  custom tags, anchors, and aliases unless a future constitution amendment explicitly
  approves broader semantics. Serialization-specific rules and normalization MUST remain
  in `src/core/`; web and CLI code MUST remain thin file/input adapters (Principle IV).
- **Runtime**: Node.js LTS for both the Nuxt web app / Nitro server and the CLI
- **CLI command parser**: cac (commander is an acceptable alternative)
- **CLI styling**: chalk
- **HTTP client**: ky (fetch-based)
- **Control-flow dispatch**: ts-pattern (exhaustive command/result matching)
- **Text-to-speech**: OpenAI TTS API via the official OpenAI SDK. Converting text
  to spoken audio is EchoRecall's core capability. The API key MAY be supplied via
  environment configuration OR set in-app via the Settings UI; a UI-set key takes
  precedence over the `OPENAI_API_KEY` environment variable, which remains a
  fallback. A key set in-app MUST be persisted encrypted at rest using a server-side
  secret. In all cases the key MUST remain server-only: it MUST NOT be sent to the
  client, MUST NOT be written to logs, and MUST NOT be echoed in error messages.
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

**Version**: 2.6.0 | **Ratified**: 2026-06-15 | **Last Amended**: 2026-07-19
