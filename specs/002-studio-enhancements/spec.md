# Feature Specification: TTS Studio Enhancements — Batch Generation, Rich Tagging, Managed Library & Settings

**Feature Branch**: `002-studio-enhancements`

**Created**: 2026-06-17

**Status**: Draft

**Input**: User description: "@specs/specs-plan.md — Batch text-to-speech generation, rich audio tagging, a managed library, and an app Settings surface (theme, language, OpenAI key), presented across Generate / Library / Settings. Re-implements echoquize's studio enhancements in EchoRecall."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate a batch of clips from a list (Priority: P1)

A user wants to turn many texts into separate audio clips in one pass. They type items one at a time and/or upload a plain-text file (one item per line); every item lands in a single generation list, and one action produces audio for all of them.

**Why this priority**: This is the headline capability — it turns a single-shot tool into a batch workstation. On its own it is a usable, demonstrable increment.

**Independent Test**: Add two items by typing, then upload a file with several lines (including a blank line and one over-length line); confirm the list holds one item per valid line in order with an accurate added/skipped/rejected summary, and that a single Generate action produces audio for every item.

**Acceptance Scenarios**:

1. **Given** an empty list, **When** the user types text and adds it, **Then** it appears as one item in the list.
2. **Given** any list, **When** the user uploads a UTF-8 `.txt` file under 5 MB, **Then** one item is appended per non-blank line in file order, existing items are preserved, and a summary reports how many were added, skipped (blank), and rejected (over 4,096 characters).
3. **Given** a populated list, **When** the user starts generation, **Then** audio is produced for every item using that item's own settings, each result is playable inline and downloadable, and every successful result is saved to the library.
4. **Given** a multi-item batch, **When** generation completes, **Then** all clips are also offered together as a single downloadable archive.
5. **Given** a provider/network failure on one item mid-batch, **When** it fails, **Then** that item reports a clear reason and is not saved, while the other items still complete.

---

### User Story 2 - Attach rich, standards-based metadata (Priority: P1)

A user wants each generated file to carry full metadata (title, artist, album, genre, comment, recording date, track, languages, and custom text/URL entries) so files are well-organized in any audio player; the metadata is remembered and editable later.

**Why this priority**: The metadata foundation the other tagging behaviors build on; it directly increases the value of every saved file.

**Independent Test**: Fill the full metadata set on the form, generate a taggable file, confirm the file carries the metadata, and confirm reopening the item later shows the same values.

**Acceptance Scenarios**:

1. **Given** the generation form, **When** the user sets Title, Artist, Album, Genre, Comment, Recording date, Track, Language(s), and custom text/URL entries and generates an MP3, **Then** the file carries those values written to the ID3v2.4.0 standard.
2. **Given** the recording-date field, **When** the user enters a year only or a full date, **Then** both are accepted.
3. **Given** a FLAC or Opus target, **When** metadata is set, **Then** fields with a native equivalent are written and fields without one are skipped with a notice (no error).
4. **Given** an AAC or PCM target, **When** metadata is set, **Then** tagging is skipped with a notice and the generation still completes.
5. **Given** a saved item, **When** it is reopened after a restart, **Then** all metadata (including custom and multi-value entries) is still present.

---

### User Story 3 - Edit each queued item before generating (Priority: P2)

A user reviewing the list wants to fix a typo, switch a voice, change a format, adjust voice instructions, or set per-item metadata on one row — without removing and re-adding the item.

**Why this priority**: High everyday value for batch users; depends on the metadata set from US2.

**Independent Test**: Add several items, edit one row's text, voice, model, format, instructions, and metadata, and confirm only that row changes and the edits show immediately.

**Acceptance Scenarios**:

1. **Given** a list item, **When** the user edits its text, voice, model, format, instructions, or metadata, **Then** only that item changes and the new values show immediately.
2. **Given** a list item, **When** its text is edited to empty or over 4,096 characters, **Then** the edit is rejected with a clear message and the previous valid value is kept.
3. **Given** a list item using the instructions-capable model with voice instructions, **When** its model is changed to one that does not use instructions, **Then** the instructions are retained on the row but not applied at generation.
4. **Given** a list item with metadata, **When** its format is changed to an untaggable one (AAC/PCM), **Then** the user is told its metadata will be skipped and the entered values are not discarded.
5. **Given** a row edit, **When** the user generates, **Then** the output reflects the edited values for that item only.

---

### User Story 4 - Recognizable filenames and dated organization (Priority: P2)

A user wants saved files named from their title so they are recognizable on disk and in downloads, organized into year/month/day folders, while staying unique.

**Why this priority**: A visible quality improvement and the naming foundation reused by library renaming (US5).

**Independent Test**: Generate two items with the same title and confirm the first is named from its title-slug and the second gets a numeric suffix, with neither overwriting the other, both under a date folder matching their creation date.

**Acceptance Scenarios**:

1. **Given** a title "My Great Clip!", **When** a file is generated, **Then** its name is a filesystem-safe slug of the title (transliterated to ASCII, lowercased, separators normalized, capped at 64 characters) with the format extension appended.
2. **Given** an existing file with that name in the same dated folder, **When** another file with the same title is generated, **Then** the new file receives a numeric suffix and the existing file is never overwritten.
3. **Given** an empty title, or one that slugifies to nothing, **When** a file is generated, **Then** the system falls back to a unique identifier so a valid filename always exists.
4. **Given** a generation on a given UTC date, **When** the file is saved, **Then** it is stored under a `YYYY/MM/DD` folder for that date, and previously saved files remain accessible in place.

---

### User Story 5 - Manage saved items in the library (Priority: P2)

A user browsing the library wants to correct a saved item — rename its file and edit its full metadata — by selecting it and saving, without re-generating, and to delete items they no longer want.

**Why this priority**: Completes the metadata story; depends on the metadata set (US2) and the slug rules / dated folder (US4).

**Independent Test**: Select a saved item, change its filename and several metadata fields, save, and confirm the file is renamed, metadata updated, and preview/download still work; then delete another item and confirm it is gone after a refresh.

**Acceptance Scenarios**:

1. **Given** a saved item, **When** the user selects it, **Then** an editor shows its current filename and full metadata set.
2. **Given** the editor, **When** the user types a new filename and saves, **Then** the name is normalized by the same slug rules, the file is renamed, the stored reference updated, and the final name reported; the extension is not editable.
3. **Given** a new filename that collides in the dated folder, **When** the user saves, **Then** a numeric suffix is appended and the final name reported; an empty or un-sluggable name is rejected and the original kept.
4. **Given** the user edits the title field, **When** they save, **Then** the file is NOT auto-renamed (renaming happens only via the filename field).
5. **Given** a saved item, **When** the user deletes it (after confirming), **Then** both the entry and its stored audio are removed and it no longer appears, including after a restart.

---

### User Story 6 - Find and organize the library (Priority: P2)

As the library grows, a user wants to search it, sort it, filter it, page through it, and clean out batches of old items.

**Why this priority**: Keeps a growing library usable; builds on the persisted library without changing generation.

**Independent Test**: With many saved items, search by a word in a title/text/tag, sort by title, filter by voice, page through results, and bulk-clean a date range — confirming each composes and returns the expected items.

**Acceptance Scenarios**:

1. **Given** saved items, **When** the user searches by free text, **Then** items whose title, source text, metadata, or filename match are returned.
2. **Given** saved items, **When** the user sorts, **Then** they can order by creation date (default newest-first), title, voice, or format, ascending or descending.
3. **Given** saved items, **When** the user applies a filter (e.g. by date or voice), **Then** it composes with the current search and sort.
4. **Given** a large library, **When** the user browses, **Then** results are paginated and remain responsive.
5. **Given** multiple items, **When** the user bulk-cleans by date/voice (after confirming), **Then** the matching records and their stored audio are removed.

---

### User Story 7 - Personalize appearance and language (Priority: P3)

A user wants to choose a light or dark appearance and their interface language, and have those choices remembered.

**Why this priority**: Self-contained quality-of-life improvement; no effect on generated content.

**Independent Test**: Switch to dark mode and to English, reload, and confirm both choices persist and apply across every area of the app.

**Acceptance Scenarios**:

1. **Given** the app, **When** the user selects light, dark, or system appearance, **Then** it applies app-wide, persists across sessions, and defaults to following the operating system.
2. **Given** the app, **When** the user switches language between English and Hungarian (default Hungarian), **Then** the interface text changes and the choice persists.
3. **Given** any language, **When** content is generated or displayed, **Then** generated audio, user input text, metadata values, and filenames are never translated.

---

### User Story 8 - Configure the OpenAI key in the app (Priority: P3)

A self-hosting operator wants to set the OpenAI key from the Settings screen — without editing files or redeploying — while keeping it secret.

**Why this priority**: Improves operator convenience; constrained by strict secret-handling.

**Independent Test**: Set a key in Settings, confirm only a masked status is shown, confirm it overrides the environment-provided key, clear it, and confirm generation reverts to the environment key.

**Acceptance Scenarios**:

1. **Given** Settings, **When** the user sets, replaces, or clears the OpenAI key, **Then** the UI shows only a masked status and never displays the stored key.
2. **Given** both a UI-set key and an environment key, **When** a generation runs, **Then** the UI-set key is used; clearing the UI key reverts to the environment key.
3. **Given** a stored in-app key, **When** the system handles it, **Then** it is kept encrypted at rest, never sent to the client, never written to logs, and never echoed in error messages.
4. **Given** Settings, **When** the user runs a "test key" action, **Then** the system reports whether the active key works.
5. **Given** no UI key and no environment key, **When** the user attempts to generate, **Then** the system fails with a clear "no key configured" message and saves nothing.

---

### User Story 9 - See and release the app version (Priority: P3)

Anyone using a deployed instance wants to see the running version near the title, and a maintainer wants to release a new version with one command.

**Why this priority**: Small visibility + release-tooling improvement; independent of the core flows.

**Independent Test**: Open the app and confirm the version appears near the title; run the bump command for a patch release and confirm the displayed version updates with no further edits.

**Acceptance Scenarios**:

1. **Given** the app is running, **When** any area loads, **Then** the current version is shown near the title; if it cannot be determined, the app still loads (version omitted or shown as a neutral placeholder) and performs no remote version check.
2. **Given** the current version, **When** a maintainer runs one command to bump major/minor/patch, **Then** the single authoritative version updates, a release commit and tag are created, and the UI reflects the new version with no further manual edit.

---

### User Story 10 - Pre-filled default tag values (Priority: P3)

A user who tags generations the same way every time wants the metadata fields pre-filled with their defaults, while still being able to override per generation.

**Why this priority**: Convenience layered on the metadata set (US2); low effort.

**Independent Test**: Configure default tag values, open the generation form, and confirm the fields are pre-filled and still overridable, with Title left blank.

**Acceptance Scenarios**:

1. **Given** configured default tag values, **When** the form loads or a new list item is added, **Then** the non-title metadata fields are pre-filled with those defaults and unset defaults stay blank.
2. **Given** pre-filled defaults, **When** the user changes or clears a field before generating, **Then** the user's value is used.
3. **Given** the Title field, **When** defaults are applied, **Then** Title is never defaulted; and missing/invalid default configuration leaves fields blank without failing startup.

---

### Edge Cases

- **All-blank upload**: a file with only blank lines creates 0 items; the summary reports all lines skipped.
- **Mixed valid/over-length upload**: valid lines are queued, over-length lines listed as rejected, and nothing is generated until the user starts generation.
- **Duplicate titles in the same day folder**: the second file receives a numeric suffix; no file is overwritten.
- **Un-sluggable title** (emoji-only or non-Latin with no ASCII transliteration): falls back to a unique identifier.
- **Over-long title**: the slug is truncated to 64 characters before any collision suffix.
- **Format change after tagging** (list or library): switching to an untaggable format warns that metadata will be skipped but retains entered values.
- **Library rename collision / empty name**: a colliding name gets a suffix (final name reported); an empty/un-sluggable name is rejected and the original kept.
- **Version metadata unavailable**: the header omits the version rather than failing at startup.
- **Invalid default-tag configuration**: the affected field stays blank and the app still starts.
- **Deleting or bulk-cleaning an item that is currently playing**: playback stops gracefully and the item is removed.
- **Empty library or no search results**: an empty-state message is shown rather than a blank/broken list.
- **Stored audio missing while its entry still exists**: the entry shows an "unavailable" state instead of breaking the library.
- **In-app key cleared mid-generation**: the next request resolves the active key (UI key if set, otherwise environment).

## Requirements *(mandatory)*

### Functional Requirements

**Batch generation (US1)**

- **FR-001**: System MUST let the user build a single generation list by typing items one at a time and/or by uploading one UTF-8 `.txt` file.
- **FR-002**: System MUST create one list item per non-blank line of an uploaded file, preserving the file's original line order and appending to existing items (never replacing them).
- **FR-003**: System MUST trim each line, skip blank/whitespace-only lines, and reject lines longer than 4,096 characters (identifying them) while still adding the valid lines.
- **FR-004**: System MUST reject an uploaded file that is 5 MB or larger.
- **FR-005**: System MUST present, after an upload, an accurate summary of items added, blank lines skipped, and lines rejected for length.
- **FR-006**: System MUST generate audio for every list item with a single action, applying each item's own settings and metadata.
- **FR-007**: System MUST make each generated result playable inline and downloadable, and MUST save every successful generation to the library.
- **FR-008**: System MUST offer the clips of a multi-item batch together as a single downloadable archive, in addition to per-item download.
- **FR-009**: System MUST enforce a maximum of 4,096 characters per item and communicate the limit.
- **FR-010**: The generation list and uploaded files MUST NOT be persisted; nothing is generated until the user starts generation.

**Synthesis controls (US1/US3)**

- **FR-011**: System MUST let the user choose a voice (from the provider's catalog), a model, an output format, and a speaking speed at the form level.
- **FR-012**: Offered output formats MUST include MP3, WAV, FLAC, Opus, AAC, and PCM.
- **FR-013**: The voice-instructions input MUST be applied only for the instructions-capable model; changing to another model MUST retain the entered instructions without applying them.
- **FR-014**: Speaking speed MUST be a form-level setting and MUST NOT be editable per list item.

**Per-item editing (US3)**

- **FR-015**: Users MUST be able to edit a list item's text, voice, model, output format, instructions, and metadata; an edit MUST affect only that item and be reflected immediately.
- **FR-016**: Editing an item's text MUST re-validate the 4,096-character limit; empty or over-length edits MUST be rejected with a clear message and the previous valid value retained.
- **FR-017**: Changing an item's format to an untaggable one MUST warn that its metadata will be skipped without discarding entered values.

**Metadata (US2)**

- **FR-018**: The metadata set MUST include Title, Artist, Album, Genre, Comment, Recording date/time, Track number, Language(s), and repeatable custom text and custom URL entries, available everywhere metadata is edited (form, list items, library editor).
- **FR-019**: For MP3 and WAV, metadata MUST be written conforming to the ID3v2.4.0 standard.
- **FR-020**: The recording date/time field MUST accept both a full timestamp and a year-only value.
- **FR-021**: For FLAC and Opus, supported fields MUST map to native metadata equivalents and fields without one MUST be skipped with a notice; AAC and PCM MUST be treated as untaggable and skipped gracefully, with generation still completing.
- **FR-022**: Custom text and custom URL entries MUST be description-keyed so multiple distinct entries can coexist on one item.
- **FR-023**: Saving metadata MUST replace the full set (clearing a field removes it; setting it writes it).
- **FR-024**: Metadata values MUST be persisted so they display and can be re-edited later and survive restarts; existing library entries without the new fields MUST keep working.

**Filenames & storage (US4)**

- **FR-025**: System MUST name each newly generated file from its title using a filesystem-safe slug (transliterated to ASCII, lowercased, separators normalized, capped at 64 characters) with the format extension appended.
- **FR-026**: System MUST guarantee filename uniqueness within the file's dated folder by appending a numeric suffix on collision and MUST never overwrite an existing file.
- **FR-027**: When the title is empty or yields an empty slug, System MUST fall back to a unique identifier so a valid filename always exists.
- **FR-028**: System MUST store newly generated audio under a `YYYY/MM/DD` folder derived from the UTC creation date; existing files MUST remain accessible in place with no migration or rename.
- **FR-029**: The stored record MUST reference the actual saved file so preview, download, delete, rename, and metadata edits all resolve to the real file.

**Library management (US5)**

- **FR-030**: Users MUST be able to select a saved item and edit its filename and full metadata set, saving changes to both the file and the stored record.
- **FR-031**: Library renaming MUST follow the same slug rules (64-character cap, collision suffix scoped to the dated folder) and report the final name; an empty/un-sluggable new name MUST be rejected (keeping the original); the extension MUST NOT be editable; editing the title MUST NOT auto-rename the file.
- **FR-032**: Users MUST be able to delete a saved item; deletion MUST require confirmation and MUST then remove both the record and its stored audio permanently.
- **FR-033**: Saved entries' filename and metadata MUST be mutable, while their generated audio and source text MUST remain immutable (no re-synthesis); per-item re-generate is out of scope.

**Library discovery (US6)**

- **FR-034**: Users MUST be able to search the library by free text over title, source text, metadata, and filename.
- **FR-035**: Users MUST be able to sort the library by creation date (default newest-first), title, voice, or format, ascending or descending.
- **FR-036**: Users MUST be able to filter the library (e.g. by date and voice) and browse it with pagination; search, sort, filter, and pagination MUST compose.
- **FR-037**: Users MUST be able to bulk-clean multiple items by date/voice; the action MUST require confirmation and remove both records and stored audio.

**Appearance & language (US7)**

- **FR-038**: Users MUST be able to choose a light, dark, or system color theme that applies app-wide and persists across sessions, defaulting to the operating-system preference.
- **FR-039**: The interface MUST be available in English and Hungarian, defaulting to Hungarian, switchable by the user and persisted.
- **FR-040**: Only interface text MUST be localized; generated audio, user input text, metadata values, and filenames MUST never be translated.

**OpenAI key (US8)**

- **FR-041**: Users MUST be able to set, replace, and clear the OpenAI key from Settings; the UI MUST show only a masked status and MUST NOT display the stored key.
- **FR-042**: A UI-set key MUST take precedence over an environment-provided key; clearing the UI key MUST revert to the environment value.
- **FR-043**: An in-app key MUST be stored encrypted at rest and MUST remain server-side — never sent to the client, written to logs, or echoed in error messages (per constitution v2.4.0).
- **FR-044**: Users MUST be able to test the active key and see whether it works.
- **FR-045**: When no key is configured (neither in-app nor environment), generation MUST fail with a clear, actionable message and save nothing.

**Version (US9)**

- **FR-046**: System MUST display the application version near the title on load from a single authoritative source; if it cannot be determined, the app MUST still start (version omitted or placeholder) and MUST perform no remote version check.
- **FR-047**: Maintainers MUST be able to bump the version's major, minor, or patch part with a single command that updates the single authoritative version and records a release commit and tag, with the UI reflecting the new version with no further manual edit.

**Default tags (US10)**

- **FR-048**: Non-title metadata fields MUST be pre-fillable from deployment-provided default values on the form and for new list items; Title MUST NOT be defaulted; users MUST be able to override or clear any default; invalid/missing configuration MUST fall back to blank without failing startup.

**Interface (cross-cutting)**

- **FR-049**: The application MUST present its capabilities across three areas — Generate, Library, and Settings — using consistent, accessible interface controls.

### Key Entities *(include if feature involves data)*

- **Generation (library entry)**: one saved generation — unique identifier, source text, voice, model, output format, creation timestamp, the full metadata set, and a reference to its stored audio file (its real path). Filename and metadata are mutable; audio and source text are immutable.
- **List item (batch queue item)**: an ephemeral, per-session generation request — text, voice, model, format, instructions, metadata. Not persisted.
- **Metadata (tag set)**: the expanded set with per-format applicability — full support for MP3/WAV (ID3v2.4.0), native equivalents for FLAC/Opus, skipped for AAC/PCM.
- **Voice**: a selectable provider voice (identifier + display name); a read-only catalog.
- **Default tag configuration**: deployment-provided default metadata values applied to new generations and new list items; not user-editable in-app.
- **Application settings**: theme, language, and the encrypted OpenAI key — app-level configuration distinct from generations.
- **Application version**: the single authoritative version value shown in the UI.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can turn a multi-line text file into a fully populated generation list in a single upload, with no per-line manual entry.
- **SC-002**: After an upload, the reported added / skipped-blank / rejected-too-long counts exactly match the uploaded file's contents.
- **SC-003**: A user can generate audio for an entire list with one action and download all results together as one archive.
- **SC-004**: 100% of newly generated files have a human-readable, title-derived name, and no generation ever overwrites an existing file.
- **SC-005**: A user can set and later edit the full metadata set on any taggable format, and the values survive an application restart.
- **SC-006**: Newly generated files are locatable by date within a year/month/day structure, and previously saved files remain playable.
- **SC-007**: A user can locate a specific saved item via search/sort/filter and start playing it within 10 seconds of opening the library, even with a large library.
- **SC-008**: A user can rename a saved file and edit all its metadata from the library, and every subsequent preview, download, and delete resolves to the renamed file.
- **SC-009**: A user can switch theme and language and have both choices persist across restarts, with zero effect on generated audio or stored text.
- **SC-010**: An operator can configure the OpenAI key entirely in the app (no file editing or redeploy), the full key is never displayed or logged, and a UI-set key overrides the environment value.
- **SC-011**: Anyone can identify the running version from the header at a glance, and a maintainer can release a new version with a single command reflected in the UI with no further edits.
- **SC-012**: A user who configured default tags sees them pre-filled on every new generation without retyping and can still override them.

## Assumptions

- **Single-user / self-hosted**: no authentication or multi-user separation (carried from the prior feature; access control remains the operator's responsibility).
- **Provider configured at deployment**: the text-to-speech provider, its voice catalog, and the available models and output formats are configured at deployment; this is the same provider as the current app.
- **Input length**: the maximum input length remains 4,096 characters per item; automatic splitting of long text is out of scope.
- **Uploads**: uploaded `.txt` files are UTF-8 and under 5 MB; the uploaded file itself is never stored.
- **Metadata standards**: ID3v2.4.0 applies to MP3/WAV; FLAC/Opus use native metadata equivalents; AAC and PCM are untaggable — consistent with audio-format reality.
- **Deployment configuration**: default tag values and the secret used to encrypt the in-app key are supplied via deployment/environment configuration.
- **Presentation preferences**: theme and language are presentation-only preferences persisted per browser/device; they are not part of the shared business logic and are not exposed via non-web surfaces.
- **Naming/migration**: title-derived naming and dated-folder storage apply to new files only; existing entries are left in place (no bulk rename/move), and their records are made compatible with the new fields.
- **Technology deferral**: specific technology choices (UI component library, version-bump tool, storage and encryption mechanisms) are deferred to the implementation plan and governed by the constitution.
- **Governance**: the in-app OpenAI key capability is permitted by constitution v2.4.0 (key may be set in-app, persisted encrypted at rest, server-only, with the environment variable as a fallback).
- **Out of scope**: per-item re-generation of saved audio, and reaching these capabilities from a non-web (CLI) surface beyond what the shared core naturally exposes.
