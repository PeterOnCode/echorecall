# Implementation Plan: Default Audio Tag Values in Settings

**Branch**: `003-settings-default-tags` | **Date**: 2026-06-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-settings-default-tags/spec.md`

## Summary

Move the default audio-tag values (Artist, Album, Genre, Comment, Languages — never
Title) out of environment configuration and into the **Settings tab**, persisted in-app
and surviving restarts. Per the clarification (2026-06-21), the `NUXT_DEFAULT_TAG_*`
environment variables are **removed entirely**: the Settings tab becomes the sole source
of tag defaults; an unset field is empty; clearing the saved values returns new
generations to blank.

Technical approach: reuse the existing `app_config` key/value store (already backing the
US8 in-app OpenAI key) via the `AppConfigRepository` port — but **without encryption**,
because tag defaults are non-secret. Add core `getDefaultTags` / `setDefaultTags` /
`clearDefaultTags` functions that read/write a single `default_tags` row (JSON), applying
the same sanitization the env reader used (trim, drop blanks, never store Title). The
existing `GET /api/settings/defaults` route is re-sourced from the store and gains `PUT`
and `DELETE` siblings (mirroring the `openai-key` routes). A `DefaultTagsSettings.vue`
section + `useDefaultTags()` composable are added to the Settings page. The generation
form pre-fill in `app/pages/index.vue` is unchanged in shape (`{ defaultTags: Metadata }`)
— it simply now reflects the in-app saved values.

## Technical Context

**Language/Version**: TypeScript (latest stable, `strict`) on Node.js 22.22.2 (pinned via mise) / Node LTS in Docker

**Primary Dependencies**: Nuxt 4 (Vue 3, Nitro, Vite); `@nuxt/ui` v4; `@nuxtjs/i18n` (en/hu); `better-sqlite3` (existing `app_config` table). No new dependencies — this feature reuses the `AppConfigRepository` port already shipped for US8.

**Storage**: SQLite (`better-sqlite3`), existing `app_config(key TEXT PRIMARY KEY, value TEXT)` table under the mounted `data/` volume. One new row keyed `default_tags` holding a JSON-serialized, sanitized tag set. **Plaintext (non-secret)** — unlike the OpenAI key, no AES-256-GCM and no `NUXT_APP_SECRET` requirement.

**Testing**: Vitest (core unit test for `getDefaultTags`/`setDefaultTags`/`clearDefaultTags` with a fake `AppConfigRepository`, mirroring `tests/unit/api-key.test.ts`); `@nuxt/test-utils` for the `DefaultTagsSettings.vue` component and the `GET/PUT/DELETE /api/settings/defaults` integration route (mirroring `tests/integration/settings-key.test.ts`). No live network.

**Target Platform**: Dockerized Node.js (Nitro) server serving the SSR/SPA browser client via Docker Compose; modern evergreen browsers.

**Project Type**: Web application — Nuxt full-stack (Vue + Nitro) over a shared framework-agnostic core. No CLI surface exists yet; the capability is exposed from `src/core/` so a future CLI can reach it.

**Performance Goals**: Not performance-sensitive — a single small KV read on form load and on Settings open; one KV write on save/clear. A user can configure defaults in under one minute (SC-006) and changes take effect on the very next new generation (SC-004).

**Constraints**: Strict TS, no unjustified `any` (JSON parse result is narrowed, not cast to `any`). Core has no Nuxt/Vue/Nitro dependency. Title is never stored or pre-filled. Reads never throw — unreadable/corrupt rows degrade to `{}` so neither the Settings tab nor the generation form can 500. No authentication (single-user, operator-secured; defaults are app-wide).

**Scale/Scope**: Single-user, self-hosted. 1 extended core module (`core/settings/default-tags`), 3 server routes (1 re-sourced + 2 new), 1 new composable, 1 new Settings component, i18n keys (en/hu), and config/docs cleanup (`.env.example`, README). One product-visible behavior change: env-provided defaults are no longer honored.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against EchoRecall Constitution **v2.4.0**:

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ PASS | All new code strict TS incl. Vue `<script setup lang="ts">`; core `getDefaultTags`/`setDefaultTags`/`clearDefaultTags` fully typed over the existing `Metadata` type. Stored JSON is parsed then validated field-by-field (narrowing), not `any`-cast. |
| II. Test-First (NON-NEGOTIABLE) | ✅ PASS | TDD. Sanitization + get/set/clear + corrupt-row→`{}` are pure and unit-tested in core with a fake `AppConfigRepository`. Routes via `@nuxt/test-utils` integration; the Settings section via component test. Existing `tests/integration/settings-defaults.test.ts` and `tests/component/DefaultTags.test.ts` are rewritten (env source → store source) red-first. |
| III. Modular Architecture | ✅ PASS | Domain logic stays in the self-contained `core/settings` module; routes, the `useDefaultTags()` composable, and `DefaultTagsSettings.vue` are thin adapters. No presentation→presentation imports; Settings UI is web-only per spec. |
| IV. Shared Core, Multiple Interfaces | ✅ PASS | The get/set/clear capability lives in framework-agnostic `src/core/settings/` and is exported from `#core`, so it is reachable programmatically (and by a future CLI). The Settings tab is explicitly web-scoped by the spec; no CLI exists to reach parity with today. |
| V. Simplicity & YAGNI | ✅ PASS | Reuses the existing `app_config` table and `AppConfigRepository` port — no new table, schema migration, dependency, or abstraction. The set/get/clear shape mirrors `api-key.ts` minus crypto; that is the 2nd consumer of `AppConfigRepository`, not a premature generalization (the port already exists). |

**Result**: All five core principles PASS. **No new technology** is introduced, so the
Technology Stack governance clause is not engaged (contrast 002, which added libraries).
This is a pure re-sourcing of an existing capability onto an existing store.

**Constitution Follow-up TODOs status**:
- `TODO(openai-key-handling)` → already resolved (US8); unaffected.
- `TODO(test-http-mocking)` → unaffected: this feature makes no HTTP calls; no fetch interception needed.

**Governance note (env removal)**: removing the `NUXT_DEFAULT_TAG_*` variables is a
product behavior change but **not** a constitution change — the constitution's stack
clauses never enumerated those variables. The README/`.env.example` cleanup is tracked as
a task, not an amendment.

## Project Structure

### Documentation (this feature)

```text
specs/003-settings-default-tags/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── rest-api.md
│   └── core-api.md
├── checklists/
│   └── requirements.md  # from /speckit-specify + /speckit-clarify
├── spec.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/core/settings/
├── default-tags.ts          # REWORKED: env reader → store-backed get/set/clear + sanitize
├── app-config-repository.ts # REUSED unchanged (AppConfigRepository + SQLite impl)
├── api-key.ts               # pattern reference (set/get/clear shape) — unchanged
└── crypto.ts                # NOT used by default tags (non-secret)

src/core/index.ts            # barrel: drop readDefaultTags export; add getDefaultTags/setDefaultTags/clearDefaultTags + DEFAULT_TAGS_CONFIG_KEY

server/api/settings/
├── defaults.get.ts          # REWORKED: read from store (was process.env)
├── defaults.put.ts          # NEW: save sanitized defaults
└── defaults.delete.ts       # NEW: clear defaults

server/utils/container.ts    # REUSED: getAppConfigRepository() (no change)

app/pages/settings.vue       # add <DefaultTagsSettings /> + drop the "later story" comment
app/components/settings/
└── DefaultTagsSettings.vue   # NEW: Artist/Album/Genre/Comment/Languages form + Save/Clear
app/composables/
└── useDefaultTags.ts         # NEW: load/save/clear over the 3 routes (mirrors useSettings.ts)
app/pages/index.vue          # wording only: "deployment defaults" → "saved defaults" (shape unchanged)

i18n/locales/en.json         # add settings.defaultTags.* keys
i18n/locales/hu.json         # add settings.defaultTags.* keys (Hungarian)

.env.example                 # REMOVE the NUXT_DEFAULT_TAG_* block
README.md                    # update default-tags docs (env → Settings tab)

tests/unit/default-tags.test.ts               # NEW: core get/set/clear + sanitize + corrupt→{}
tests/integration/settings-defaults.test.ts   # REWRITTEN: GET/PUT/DELETE over the store
tests/component/DefaultTags.test.ts           # REWRITTEN: DefaultTagsSettings edit/save/clear
```

**Structure Decision**: Single existing Nuxt full-stack app over a shared core. This
feature re-points one core module from `process.env` to the existing `app_config` store
and adds the thin web adapters (2 routes, 1 composable, 1 component) that mirror the US8
OpenAI-key trio. No new top-level structure.

## Complexity Tracking

> No Constitution Check violations. No new dependencies, tables, or abstractions — the
> feature reuses the `AppConfigRepository` port and `app_config` table shipped in 002.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _(none)_ | — | — |
