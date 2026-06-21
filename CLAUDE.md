<!-- SPECKIT START -->
Active feature: **003-settings-default-tags** (branch `003-settings-default-tags`).

For technologies, project structure, shell commands, and other context, read the
current plan and its design artifacts:

- Plan: `specs/003-settings-default-tags/plan.md`
- Spec: `specs/003-settings-default-tags/spec.md`
- Research: `specs/003-settings-default-tags/research.md`
- Data model: `specs/003-settings-default-tags/data-model.md`
- REST contract: `specs/003-settings-default-tags/contracts/rest-api.md`
- Core API contract: `specs/003-settings-default-tags/contracts/core-api.md`
- Quickstart: `specs/003-settings-default-tags/quickstart.md`

Prior features (running baseline): `specs/002-studio-enhancements/` (released v0.2.0),
`specs/001-tts-generation-library/`.

Stack: TypeScript (strict) on Node.js (pinned 22.22.2 via mise); Nuxt 4 (Vue 3 + Nitro)
web adapter over a framework-agnostic `src/core/`. 002 added: `@nuxt/ui` v4 (+color-mode),
`@nuxtjs/i18n` (en/hu, Hungarian default), batch generation + multi-format audio
(MP3/WAV/FLAC/Opus/AAC/PCM), ID3v2.4.0/Vorbis tagging via an `AudioTagger` port backed by
**`taglib-wasm`** (pure WASM, no system binary), title-slug + `YYYY/MM/DD` storage, server-side library search/sort/filter/
pagination, an encrypted in-app OpenAI key (`app_config`, AES-256-GCM, UI→env precedence),
and a Bumpp-driven version shown in the header. **003** moves default audio-tag values
(Artist/Album/Genre/Comment/Languages — never Title) from `NUXT_DEFAULT_TAG_*` env vars
into the **Settings tab**, persisted **plaintext** in the existing `app_config` table
(reusing the `AppConfigRepository` port, no encryption/no `NUXT_APP_SECRET`); env support
is **removed** (no migration). New core `getDefaultTags`/`setDefaultTags`/`clearDefaultTags`;
`GET/PUT/DELETE /api/settings/defaults`. Persistence: SQLite (`better-sqlite3`,
migrated in place) + filesystem audio under `data/`. Tests: Vitest + `@nuxt/test-utils`
(providers/tagger mocked at their ports). Docker Compose (no extra system packages; WASM tagger via npm). Requires Node ≥ 22.6.
Governed by the constitution at `.specify/memory/constitution.md` (v2.4.0).
<!-- SPECKIT END -->
