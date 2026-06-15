<!-- SPECKIT START -->
Active feature: **001-tts-generation-library** (branch `001-tts-generation-library`).

For technologies, project structure, shell commands, and other context, read the
current plan and its design artifacts:

- Plan: `specs/001-tts-generation-library/plan.md`
- Spec: `specs/001-tts-generation-library/spec.md`
- Research: `specs/001-tts-generation-library/research.md`
- Data model: `specs/001-tts-generation-library/data-model.md`
- API contract: `specs/001-tts-generation-library/contracts/rest-api.md`
- Quickstart: `specs/001-tts-generation-library/quickstart.md`

Stack: TypeScript (strict) on Node.js LTS; Nuxt 4 (Vue 3 + Nitro) web adapter over a
framework-agnostic `src/core/`; OpenAI TTS (MP3); SQLite (`better-sqlite3`) + filesystem
audio under `data/`; Vitest + `@nuxt/test-utils`; Docker Compose. Governed by the
constitution at `.specify/memory/constitution.md` (v2.3.0).
<!-- SPECKIT END -->
