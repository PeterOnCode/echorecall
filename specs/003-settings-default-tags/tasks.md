# Tasks: Default Audio Tag Values in Settings

**Input**: Design documents from `specs/003-settings-default-tags/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (rest-api.md, core-api.md), quickstart.md

**Tests**: REQUIRED — the constitution mandates Test-First (Principle II, NON-NEGOTIABLE). Every implementation task is preceded by a failing test (red → green).

**Organization**: Tasks are grouped by user story (US1 P1, US2 P2). The shared core get/set/clear trio is a blocking prerequisite and lives in Foundational.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 (user-story phases only)
- All paths are repo-relative.

## Conventions (project-specific — apply throughout)

- **Run tests/typecheck via the pinned runtime**: `mise exec node@22.22.2 -- npm run test ...` and `mise exec node@22.22.2 -- npm run typecheck` (bash shell defaults to Node 25; native `better-sqlite3` needs 22.22.2).
- **Typecheck import rule**: in `.vue`/composables, **auto-import components** (no `~` import) and import composable/core *types* by relative path or `#core/client` — the `~` alias fails `nuxt typecheck`.
- **Inputs commit on `@blur`** (validate-and-restore), because VTU `setValue` on a text field also fires `change`; mirror the existing metadata inputs.
- Mirror the existing US8 trio: `app/composables/useSettings.ts`, `app/components/settings/OpenAiKeySettings.vue`, `server/api/settings/openai-key.{get,put,delete}.ts`, `tests/unit/api-key.test.ts`, `tests/integration/settings-key.test.ts`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a known-green baseline on the feature branch before red-first work.

- [ ] T001 Confirm the baseline suite is green on branch `003-settings-default-tags`: run `mise exec node@22.22.2 -- npm run test` and note the current `tests/integration/settings-defaults.test.ts` + `tests/component/DefaultTags.test.ts` pass against the env-based code (they will be rewritten in later phases).

**Checkpoint**: Clean baseline; ready to author failing tests.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The framework-agnostic core that BOTH user stories depend on — store-backed `getDefaultTags`/`setDefaultTags`/`clearDefaultTags` over the existing `AppConfigRepository`, replacing the removed env reader.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [ ] T002 [P] Write the core unit test `tests/unit/default-tags.test.ts` (red first), modeled on `tests/unit/api-key.test.ts` with a fake `AppConfigRepository`. Cover: `getDefaultTags` → `{}` when no row; `setDefaultTags` trims scalars, drops blanks, parses + de-dupes `languages`, and **never stores `title`/unknown fields**; `setDefaultTags` with all-blank input **deletes** the row (returns `{}`); set→get round-trip; `clearDefaultTags` removes the row (idempotent); a corrupt/invalid-JSON row makes `getDefaultTags` return `{}` (never throws). See `contracts/core-api.md` + `data-model.md`.
- [ ] T003 Rework `src/core/settings/default-tags.ts`: remove `readDefaultTags(env)`; add `export const DEFAULT_TAGS_CONFIG_KEY = 'default_tags'`, `DefaultTagsDeps`/`DefaultTagsInput` types, a shared `sanitize()` (rules in `contracts/core-api.md`), and `getDefaultTags`/`setDefaultTags`/`clearDefaultTags`. Non-secret: no crypto, no `appSecret`. Reads are total (never throw). Make T002 pass.
- [ ] T004 Update the barrel `src/core/index.ts`: drop `export { readDefaultTags } ...`; add `export { getDefaultTags, setDefaultTags, clearDefaultTags, DEFAULT_TAGS_CONFIG_KEY } from './settings/default-tags'` and `export type { DefaultTagsDeps, DefaultTagsInput } from './settings/default-tags'`.

**Checkpoint**: `mise exec node@22.22.2 -- npm run test -- tests/unit/default-tags.test.ts` green; `#core` no longer exports `readDefaultTags`.

---

## Phase 3: User Story 1 - Set default tag values from the Settings tab (Priority: P1) 🎯 MVP

**Goal**: A user enters Artist/Album/Genre/Comment/Languages in Settings, saves, and every new generation pre-fills those values (Title blank); values survive restart.

**Independent Test**: In Settings, save defaults; on Generate a new item is pre-filled with exactly those non-title values; restart the server and confirm they still apply.

### Tests for User Story 1 (write FIRST, ensure they FAIL) ⚠️

- [ ] T005 [P] [US1] Rewrite `tests/integration/settings-defaults.test.ts` (drop all `NUXT_DEFAULT_TAG_*` env assertions), modeled on `tests/integration/settings-key.test.ts`: `GET /api/settings/defaults` → `{ defaultTags: {} }` initially; `PUT` saves + echoes the sanitized set and **ignores a `title` in the body**; `GET` after `PUT` reflects saved values. See `contracts/rest-api.md`.
- [ ] T006 [P] [US1] Rewrite `tests/component/DefaultTags.test.ts` (red) for the new `DefaultTagsSettings.vue`: renders the five fields and **no Title field**; editing + Save calls `PUT /api/settings/defaults` with the entered values; pre-filled from `GET` on mount. Reuse the Settings component test scaffolding (`mockNuxtImport` for `useI18n`, etc.) from `tests/component/Settings.appearance-language.test.ts`.

### Implementation for User Story 1

- [ ] T007 [US1] Re-source `server/api/settings/defaults.get.ts`: return `{ defaultTags: getDefaultTags({ config: getAppConfigRepository() }) }` (was `readDefaultTags(process.env)`); keep the `respondError` wrapper and the never-500 guarantee.
- [ ] T008 [P] [US1] Add `server/api/settings/defaults.put.ts`: `readBody`, call `setDefaultTags({ config: getAppConfigRepository() }, body)`, return `{ defaultTags }`. Mirror `server/api/settings/openai-key.put.ts` (minus the secret/409 path).
- [ ] T009 [US1] Add `app/composables/useDefaultTags.ts` (mirror `app/composables/useSettings.ts`): reactive `values`, `saving`, `error`, derived saved/empty status; `load()` (GET) and `save(values)` (PUT). Import `Metadata` type from `#core/client`.
- [ ] T010 [US1] Add `app/components/settings/DefaultTagsSettings.vue` (mirror `OpenAiKeySettings.vue`): Artist/Album/Genre/Comment text inputs + Languages input (reuse the generation form's languages entry UX) + Save button; commit inputs on `@blur`; calls `useDefaultTags()`; all strings via `t('settings.defaultTags.*')`. Depends on T009.
- [ ] T011 [US1] Mount `<DefaultTagsSettings />` in `app/pages/settings.vue` and remove the stale `// default tags (US10) are added in a later story` comment. Depends on T010.
- [ ] T012 [P] [US1] Add `settings.defaultTags.*` keys (title, per-field labels, languages hint, save action, saved/empty status, error strings) to `i18n/locales/en.json`.
- [ ] T013 [P] [US1] Add the matching `settings.defaultTags.*` Hungarian keys to `i18n/locales/hu.json` (Hungarian is the default locale — no missing-key fallback).
- [ ] T014 [US1] Update `app/pages/index.vue` wording only (response shape unchanged): rename the "deployment defaults" comment + `defaultsApplied` hint to "saved defaults" so the pre-fill copy matches the in-app source.

**Checkpoint**: T005/T006 green. User can set defaults in Settings, see them pre-fill a new generation (Title blank), and they persist across restart — MVP complete.

---

## Phase 4: User Story 2 - Update or clear saved defaults (Priority: P2)

**Goal**: From the same section, change saved values (next generation uses the new ones) or clear them entirely (new generations start blank).

**Independent Test**: With defaults saved, change one field and Save → next new generation uses the new value; then Clear → next new generation starts with empty tag fields.

### Tests for User Story 2 (write FIRST, ensure they FAIL) ⚠️

- [ ] T015 [US2] Extend `tests/integration/settings-defaults.test.ts`: `DELETE /api/settings/defaults` → `{ defaultTags: {} }` and a subsequent `GET` is empty; re-`PUT` with changed values updates the stored set (same file as T005 — sequential).
- [ ] T016 [US2] Extend `tests/component/DefaultTags.test.ts`: a Clear control calls `DELETE` and resets the fields; the saved/empty status reflects current state (same file as T006 — sequential).

### Implementation for User Story 2

- [ ] T017 [P] [US2] Add `server/api/settings/defaults.delete.ts`: call `clearDefaultTags({ config: getAppConfigRepository() })`, return `{ defaultTags: {} }`. Mirror `server/api/settings/openai-key.delete.ts`.
- [ ] T018 [US2] Extend `app/composables/useDefaultTags.ts` with `clear()` (DELETE, reset reactive `values`). Depends on T009.
- [ ] T019 [US2] Add a Clear button + saved/empty status indicator to `app/components/settings/DefaultTagsSettings.vue` (mirror how `OpenAiKeySettings.vue` shows source/state); wire to `clear()`. Depends on T010, T018.

**Checkpoint**: T015/T016 green. Update and Clear both reflect on the next new generation.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Complete the env removal, docs, and full-suite verification.

- [ ] T020 [P] Remove the `NUXT_DEFAULT_TAG_ARTIST/ALBUM/GENRE/COMMENT/LANGUAGES` block (and its comment) from `.env.example`.
- [ ] T021 [P] Update `README.md`: document default tags as a Settings-tab feature; remove the `NUXT_DEFAULT_TAG_*` docs; add the upgrade note that operators must re-enter prior env values once (no automatic migration). See spec Assumptions + research D6.
- [ ] T022 Verify env removal: `grep -rn "NUXT_DEFAULT_TAG\|readDefaultTags" src server app tests .env.example` returns **no code references** (only README prose if any). Confirms FR-013 / SC-005.
- [ ] T023 Run the full suite and typecheck via the pinned runtime: `mise exec node@22.22.2 -- npm run test` and `mise exec node@22.22.2 -- npm run typecheck` (watch the known `runtimeConfig.public`/`~`-alias/i18n-composer typecheck gotchas). All green.
- [ ] T024 [P] A11y + i18n parity pass on `DefaultTagsSettings.vue`: labeled inputs/`aria` consistent with the other Settings sections; no hard-coded user-facing strings; en/hu keys at parity. Walk the `quickstart.md` manual scenarios (Stories 1–2, env-removal, corrupt-row robustness).

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** → **US1 (Phase 3)** → **US2 (Phase 4)** → **Polish (Phase 5)**.
- **Foundational blocks everything**: T002→T003→T004 before any route/composable/component task.
- **US1 before US2**: US2's Clear button (T019) extends the US1 component (T010); the US2 test tasks extend the US1 test files (same files, sequential).
- **Within US1**: T009 (composable) → T010 (component) → T011 (mount); routes T007/T008 independent of the UI; i18n T012/T013 independent.
- **Story independence**: US1 is a fully shippable MVP without US2 (Save + pre-fill + persist). US2 adds Clear + status only.

## Parallel Execution Examples

- **Foundational**: T002 (test) can be authored in parallel with reading the contracts; T003/T004 are sequential (barrel depends on the module).
- **US1 in parallel** after Foundational: `T005`, `T006` (test files) together; then `T008` (PUT route), `T012` (en i18n), `T013` (hu i18n) in parallel while `T009→T010→T011` proceed on the UI chain; `T007` (GET re-source) and `T014` (index wording) are independent.
- **Polish**: `T020`, `T021`, `T024` are parallel; `T022`/`T023` run after code changes land.

## Implementation Strategy

- **MVP = Phases 1–3 (US1)**: ship "set defaults in Settings → pre-fill new generations → persists across restart." This already replaces the `.env` workflow and delivers the core user value.
- **Increment 2 = Phase 4 (US2)**: add update/clear controls.
- **Finalize = Phase 5**: remove env support, update docs, verify the full suite + typecheck. The env removal (T020/T022) is intentionally last so the app keeps working through US1/US2 development and the regression is a single, deliberate step.
