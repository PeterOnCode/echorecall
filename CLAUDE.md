<!-- SPECKIT START -->
Active feature: **004-nuxt-ui-migration** (branch `004-nuxt-ui-migration`).

For technologies, project structure, shell commands, and other context, read the
current plan and its design artifacts:

- Plan: `specs/004-nuxt-ui-migration/plan.md`
- Spec: `specs/004-nuxt-ui-migration/spec.md`
- Research: `specs/004-nuxt-ui-migration/research.md`
- Data model (control inventory): `specs/004-nuxt-ui-migration/data-model.md`
- UI contract (component APIs + `data-test` ledger): `specs/004-nuxt-ui-migration/contracts/ui-contracts.md`
- Quickstart: `specs/004-nuxt-ui-migration/quickstart.md`

Prior features (running baseline): `specs/003-settings-default-tags/` (in-app default
tag values, merged #35), `specs/002-studio-enhancements/` (released v0.2.0),
`specs/001-tts-generation-library/`.

Stack: TypeScript (strict) on Node.js (pinned 22.22.2 via mise); Nuxt 4 (Vue 3 + Nitro)
web adapter over a framework-agnostic `src/core/`. 002 added: `@nuxt/ui` v4 (+color-mode),
`@nuxtjs/i18n` (en/hu, Hungarian default), batch generation + multi-format audio
(MP3/WAV/FLAC/Opus/AAC/PCM), ID3v2.4.0/Vorbis tagging via an `AudioTagger` port backed by
**`taglib-wasm`** (pure WASM, no system binary), title-slug + `YYYY/MM/DD` storage, server-side library search/sort/filter/
pagination, an encrypted in-app OpenAI key (`app_config`, AES-256-GCM, UI→env precedence),
and a Bumpp-driven version shown in the header. 003 moved default audio-tag values into the
**Settings tab** (plaintext `app_config`, env support removed). **004** is a
**presentation-only** migration: replace the remaining raw HTML controls on the Generate,
Library, and Settings surfaces with `@nuxt/ui` v4 components — `<input>`→`UInput`/`UInputNumber`,
`<select>`→`USelectMenu`, `<textarea>`→`UTextarea`, label groups→`UFormField`; the two bespoke
modals (`ConfirmDialog`, `BulkCleanDialog`) collapse onto **`UModal`** (fixes a dark-mode
hardcoded-`#fff` defect); the Library `<table>`→**`UTable`** (server-driven sort + `#expanded`
player/editor rows); the date-range filters→**`UPopover`+`UCalendar`** (the one intentional UX
change). Adds direct dep `@internationalized/date` (already in tree via `@nuxt/ui`); removes
the dead `LibraryList.vue`. **No `src/core/`/`server`/schema/contract changes.** Delivery: one
combined change. Tests: Vitest + `@nuxt/test-utils` (affected component specs rewritten
red-first; dark-mode/focus gated by new automated tests per the clarification). Requires
Node ≥ 22.6. Governed by the constitution at `.specify/memory/constitution.md` (v2.4.0).
<!-- SPECKIT END -->
