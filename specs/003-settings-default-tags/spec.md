# Feature Specification: Default Audio Tag Values in Settings

**Feature Branch**: `003-settings-default-tags`

**Created**: 2026-06-21

**Status**: Draft

**Input**: User description: "Audio ID default values settings on settings tab not in .env file"

## Clarifications

### Session 2026-06-21

- Q: How should the existing environment-provided default tags (`NUXT_DEFAULT_TAG_*`) relate to the new in-app Settings values? → A: Remove env entirely — only the Settings tab configures defaults; the `NUXT_DEFAULT_TAG_*` environment variables are no longer used. When no in-app value is saved, the field starts empty.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set default tag values from the Settings tab (Priority: P1)

A user who tags every generation with the same recurring metadata (e.g. their own
name as Artist, a recurring Album/collection name, a Genre, a standard Comment, and
one or more languages) wants to type those values once in the app and have every new
generation start pre-filled with them — without asking an administrator to edit a
deployment configuration file.

From the Settings tab the user opens a "Default tag values" section, enters values
for the supported fields, and saves. From then on, each new generation begins with
those values already filled in, ready to accept or adjust. The values survive app
restarts.

**Why this priority**: This is the core of the request — moving the default-tag
configuration out of the deployment environment file and into the in-app Settings
tab. Delivered alone it already replaces the file-editing workflow and provides
standalone value.

**Independent Test**: Open Settings, enter default values for the supported fields,
save, then start a new generation and confirm the form is pre-filled with exactly
those values; restart the app and confirm the saved values are still in effect.

**Acceptance Scenarios**:

1. **Given** no default tag values have been saved in the app, **When** the user opens
   the Settings tab, **Then** the "Default tag values" section is shown with empty fields.
2. **Given** the user is on the Settings tab, **When** they enter values for Artist,
   Album, Genre, Comment, and Languages and save, **Then** the values are persisted and
   a confirmation of the saved state is shown.
3. **Given** the user has saved default tag values, **When** they start a new
   generation, **Then** the generation form's tag fields are pre-filled with the saved
   values (Title remains blank).
4. **Given** the user has saved default tag values, **When** the app is restarted,
   **Then** the previously saved values are still applied to new generations.
5. **Given** the user edits a pre-filled field during a generation, **When** they change
   or clear it for that one generation, **Then** their per-generation edit is used for
   that item and the saved defaults are unchanged.

---

### User Story 2 - Update or clear saved defaults (Priority: P2)

A user's recurring metadata changes over time — they finish one collection and start
another, or they simply mistyped a value. They want to change the saved defaults, or
clear them entirely so new generations start blank again, all from the same Settings
section.

**Why this priority**: Editing config you can set is the natural complement to setting
it. Without it the feature is one-way, but Story 1 is still usable on its own, so this
is P2.

**Independent Test**: With defaults already saved, change one field and save — confirm
new generations use the new value; then clear the defaults and confirm new generations
start with no in-app defaults applied.

**Acceptance Scenarios**:

1. **Given** default tag values are saved, **When** the user changes one field and
   saves, **Then** subsequent new generations use the updated value and the other fields
   are unchanged.
2. **Given** default tag values are saved, **When** the user clears the saved defaults,
   **Then** the in-app defaults no longer apply to new generations.
3. **Given** the user leaves a single field blank while others have values, **When** they
   save, **Then** the blank field contributes no default while the others still apply.

---

### Edge Cases

- **Title is never defaulted.** Even if a value is somehow supplied for Title, new
  generations MUST start with an empty Title so each item gets a distinct, user-chosen
  name.
- **Whitespace-only entries** are treated as empty and contribute no default.
- **Languages list**: the user can provide zero, one, or several languages; blank or
  duplicate entries are ignored. (Whether a fixed picker or free-form list is used is a
  presentation detail for planning.)
- **Invalid or unreadable saved data** must never break generation: if saved defaults
  cannot be read, the system treats the defaults as empty rather than failing to open the
  form.
- **Existing deployments using the old environment variables**: the `NUXT_DEFAULT_TAG_*`
  variables are no longer read. After upgrade, new generations start with empty tag
  defaults until an operator re-enters the values in the Settings tab. There is no
  automatic migration of previously configured environment values.
- **Concurrent edits**: if defaults are changed in one place while a generation is being
  prepared elsewhere, the in-progress generation keeps the values it already loaded; the
  new defaults apply to subsequently started generations.
- **Save with all fields blank** is equivalent to clearing the in-app defaults.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Settings tab MUST provide a "Default tag values" section where users
  can view and edit the default values for the supported tag fields.
- **FR-002**: The supported default tag fields MUST be Artist, Album, Genre, Comment,
  and Languages — the same non-title fields previously supported by environment
  configuration.
- **FR-003**: Users MUST be able to save the entered default tag values from the Settings
  tab.
- **FR-004**: Saved default tag values MUST persist across application restarts.
- **FR-005**: When a user starts a new generation, the generation form's tag fields MUST
  be pre-filled from the effective default tag values.
- **FR-006**: Title MUST never be pre-filled from the saved defaults; every new
  generation starts with an empty Title.
- **FR-007**: Users MUST be able to update individual saved default fields without
  re-entering the others.
- **FR-008**: Users MUST be able to clear the saved in-app default tag values, after
  which the in-app defaults no longer apply.
- **FR-009**: The effective default for pre-filling MUST come solely from the in-app
  saved values; when no value is saved for a field, that field starts empty. Environment
  variables MUST NOT be consulted as a source of tag defaults.
- **FR-010**: Clearing the saved defaults MUST result in new generations starting with
  empty tag fields.
- **FR-011**: Blank or whitespace-only values MUST contribute no default and MUST NOT
  overwrite a field with empty content when other fields are being saved.
- **FR-012**: Editing a pre-filled value during a single generation MUST affect only that
  generation and MUST NOT alter the saved defaults.
- **FR-013**: The system MUST NOT read tag defaults from the `NUXT_DEFAULT_TAG_*`
  environment variables; environment-based configuration of default tags is removed.
- **FR-014**: Reading or applying default tag values MUST never cause the Settings tab or
  the generation form to fail to load; unreadable saved data degrades to empty defaults.
- **FR-015**: The Settings UI MUST indicate the current state of the default tags to the
  user (e.g., whether saved values are in effect, otherwise that no defaults are set),
  consistent with how other Settings sections communicate their state.

### Key Entities *(include if data involved)*

- **Default Tag Values**: A user-configurable set of default metadata applied to new
  generations. Attributes: Artist (text), Album (text), Genre (text), Comment (text),
  Languages (list of language codes). Title is explicitly excluded. Persisted in-app and
  editable from Settings.
- **Effective Defaults**: The set of defaults actually used to pre-fill a new generation,
  taken solely from the in-app saved values; any field with no saved value is empty, and
  Title is always empty.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can configure recurring default tags entirely from the Settings tab,
  with no environment/configuration-file editing available or required.
- **SC-002**: After saving defaults, 100% of newly started generations begin pre-filled
  with the saved non-title values, and Title is empty in 100% of cases.
- **SC-003**: Saved defaults remain in effect after an application restart with no
  re-entry required.
- **SC-004**: A user can change or clear their saved defaults and see the change reflected
  on the very next new generation.
- **SC-005**: After upgrade, no tag default originates from environment variables; the
  only way an end user observes a non-empty default is by saving values in the Settings
  tab.
- **SC-006**: A user can set up their recurring defaults in under one minute from opening
  the Settings tab.

## Assumptions

- **Mirrors the existing in-app OpenAI key pattern (US8) for "move config out of the
  environment file into Settings," but without secrecy**: default tag values are not
  sensitive, so they do not require encryption or the deployment secret that the OpenAI
  key requires. They are stored in plain form in the app's existing configuration store.
- **Environment configuration is removed, not kept as a fallback** (clarified
  2026-06-21): the in-app Settings tab is the *only* source of tag defaults. The
  `NUXT_DEFAULT_TAG_*` environment variables are no longer read, and there is no automatic
  migration of previously configured environment values — operators re-enter them in the
  Settings tab after upgrade.
- **Supported fields match the previously env-configured set**: Artist, Album, Genre,
  Comment, Languages — and Title is never defaulted.
- **Scope is the default values only**: this feature does not change how tags are written
  to audio files, the set of supported tag fields on a generation, or how generations are
  produced — only where the *defaults* come from and how they are configured.
- **Defaults apply to newly started generations**: changing defaults does not retroactively
  re-tag existing library items or generations already in progress.
- **Single-tenant configuration**: defaults are app-wide (one saved set), consistent with
  the current single-config model; per-user defaults are out of scope.
