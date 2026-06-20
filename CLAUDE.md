<!-- SPECKIT START -->
Latest shipped feature: **002-studio-enhancements** — all user stories (US1–US10) plus
Phase 13 polish are merged to `master`. No feature is currently in progress; start a new
one with `/speckit-specify`. (Only the manual T109 quickstart walkthrough is unsigned-off.)

For technologies, project structure, shell commands, and other context, read the
002 plan and its design artifacts (they describe the now-shipped feature set):

- Plan: `specs/002-studio-enhancements/plan.md`
- Spec: `specs/002-studio-enhancements/spec.md`
- Research: `specs/002-studio-enhancements/research.md`
- Data model: `specs/002-studio-enhancements/data-model.md`
- REST contract: `specs/002-studio-enhancements/contracts/rest-api.md`
- Core API contract: `specs/002-studio-enhancements/contracts/core-api.md`
- Quickstart: `specs/002-studio-enhancements/quickstart.md`

002 is now the running baseline, built on the original `specs/001-tts-generation-library/`.

Stack: TypeScript (strict) on Node.js (pinned 22.22.2 via mise); Nuxt 4 (Vue 3 + Nitro)
web adapter over a framework-agnostic `src/core/`. 002 adds: `@nuxt/ui` v4 (+color-mode),
`@nuxtjs/i18n` (en/hu, Hungarian default), batch generation + multi-format audio
(MP3/WAV/FLAC/Opus/AAC/PCM), ID3v2.4.0/Vorbis tagging via an `AudioTagger` port backed by
**`taglib-wasm`** (pure WASM, no system binary), title-slug + `YYYY/MM/DD` storage, server-side library search/sort/filter/
pagination, an encrypted in-app OpenAI key (`app_config`, AES-256-GCM, UI→env precedence),
and a Bumpp-driven version shown in the header. Persistence: SQLite (`better-sqlite3`,
migrated in place) + filesystem audio under `data/`. Tests: Vitest + `@nuxt/test-utils`
(providers/tagger mocked at their ports). Docker Compose (no extra system packages; WASM tagger via npm). Requires Node ≥ 22.6.
Governed by the constitution at `.specify/memory/constitution.md` (v2.4.0).
<!-- SPECKIT END -->
