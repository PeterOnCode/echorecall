# Feature Specification: Text-to-Speech Generation with Persistent Library

**Feature Branch**: `001-tts-generation-library`

**Created**: 2026-06-15

**Status**: Draft

**Input**: User description: "Text-to-speech generation with a persistent library (web surface). EchoRecall turns written text into spoken audio and keeps a permanent, browsable record of everything generated. This is the rebuild of echoquize's core flow, delivered on the web first."

## Clarifications

### Session 2026-06-15

- Q: Which text-to-speech controls should v1 expose to the user? → A: Voice only (speed, model, and output format use fixed defaults).
- Q: How should access to the web UI be protected in v1? → A: No built-in authentication; the operator secures network access (localhost / reverse proxy / VPN).
- Q: What audio format should generated speech be stored and downloaded in? → A: MP3.
- Q: How should deleting a library entry behave in v1? → A: Require a confirmation step, then permanently delete (no trash/restore).
- Q: What maximum input length should a single generation allow? → A: 4,096 characters.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate and listen (Priority: P1)

A user opens EchoRecall, pastes or types some text, selects a voice, and triggers
generation. Within a short wait, the spoken audio plays back in the browser.

**Why this priority**: This is the core value of the product — turning text into
speech. On its own it is a usable, demonstrable product even before any history
or management exists.

**Independent Test**: Enter text, pick a voice, generate, and confirm audio plays
in the browser. Delivers the primary value (text in, speech out) with no other
feature present.

**Acceptance Scenarios**:

1. **Given** the user has entered non-empty text and selected a voice, **When** they start generation, **Then** the system produces spoken audio for that text in that voice and makes it playable in the browser.
2. **Given** a generation is in progress, **When** the user is waiting, **Then** the system shows clear progress feedback until the audio is ready.
3. **Given** generation has completed successfully, **When** the audio is ready, **Then** the user can play it with a single action.

---

### User Story 2 - Automatic library capture (Priority: P2)

Every successful generation is automatically recorded in a persistent library.
The user can see a list of past generations and replay any of them later — even
after closing and reopening the app — without regenerating.

**Why this priority**: Persistence is the second pillar of EchoRecall's identity
("keeps a permanent, browsable record"). It builds directly on P1 and turns a
one-shot tool into a reusable library, but P1 must exist first.

**Independent Test**: Generate two items, restart the application, open the
library, and confirm both items are listed and can be replayed without a new
generation.

**Acceptance Scenarios**:

1. **Given** a generation completes successfully, **When** it finishes, **Then** the system automatically saves an entry recording the source text, the chosen voice, and the creation date, with no extra action from the user.
2. **Given** saved generations exist, **When** the user opens the library, **Then** the system shows them as a browsable list of past generations.
3. **Given** the application has been restarted, **When** the user opens the library, **Then** all previously saved generations are still present.
4. **Given** a saved generation, **When** the user replays it from the library, **Then** the system plays the stored audio without contacting the text-to-speech provider again.

---

### User Story 3 - Retrieve and manage (Priority: P3)

From the library, the user can download the audio file of any past generation and
delete entries they no longer want.

**Why this priority**: Download and delete make the library practically useful and
keep it tidy, but they are refinements on top of an existing, persisted library
(P2). The product is valuable without them.

**Independent Test**: From a populated library, download one entry's audio to the
local device and delete another entry, then confirm the deleted entry is gone
(including after a refresh) and the downloaded file plays.

**Acceptance Scenarios**:

1. **Given** a saved generation, **When** the user downloads it, **Then** the system provides the audio file for that generation to the user's device.
2. **Given** a saved generation, **When** the user deletes it, **Then** the system removes both the entry and its stored audio, and the entry no longer appears in the library (including after a restart).
3. **Given** a generation the user wants to keep but with different audio, **When** they want a change, **Then** they create a new generation rather than editing the existing entry (entries are immutable).

---

### Edge Cases

- **Empty or whitespace-only input**: The system rejects the request with a clear message and does not contact the provider or create a library entry.
- **Input over the length limit**: The system blocks generation, communicates the maximum allowed length, and preserves the entered text.
- **Provider unavailable / network error / timeout**: The system shows a clear, human-readable reason, preserves the entered text and voice selection, and saves nothing to the library.
- **Provider returns no audio or incomplete audio**: Treated as a failed generation — not saved, with a clear error.
- **Repeated identical input**: Generating the same text and voice again creates a new, separate library entry (no automatic de-duplication).
- **Rapid repeated submissions**: A single submit produces at most one generation and one library entry.
- **Deleting an entry that is currently playing**: Playback stops gracefully and the entry is removed.
- **Empty library**: The library shows an empty-state message rather than a blank or broken list.
- **Stored audio missing or unreadable while its entry still exists**: The entry shows an unavailable state instead of crashing the library.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to enter free-form text to be converted to speech.
- **FR-002**: System MUST allow a user to select a voice from the voices offered by the configured text-to-speech provider before generating.
- **FR-003**: System MUST generate spoken audio from the entered text in the selected voice when the user initiates generation.
- **FR-004**: System MUST make the generated audio playable in the browser once generation completes.
- **FR-005**: System MUST show clear progress feedback while a generation is in progress.
- **FR-006**: System MUST, on any generation failure, show a clear human-readable reason and preserve the user's entered text and voice selection.
- **FR-007**: System MUST reject empty or whitespace-only input before contacting the provider, with a clear message.
- **FR-008**: System MUST enforce a maximum input length of 4,096 characters, prevent generation beyond it, and communicate the limit to the user.
- **FR-009**: System MUST automatically save every successful generation to a persistent library, recording at minimum the source text, the selected voice, the creation timestamp, and a unique identifier.
- **FR-010**: System MUST store each generation's audio so it can be replayed later without regenerating.
- **FR-011**: System MUST persist the library so all entries and their audio remain available after the application is restarted or redeployed.
- **FR-012**: System MUST present the library as a browsable list of past generations.
- **FR-013**: Users MUST be able to replay any past generation from the library without contacting the provider again.
- **FR-014**: Users MUST be able to download the audio file for any past generation.
- **FR-015**: Users MUST be able to delete a library entry; deletion MUST require a confirmation step and MUST then permanently remove both its metadata and its stored audio (no trash or restore).
- **FR-016**: System MUST treat saved generations as immutable — there is no edit or re-synthesis of an existing entry; different audio requires a new generation.

### Key Entities *(include if feature involves data)*

- **Generation (library entry)**: One text-to-speech result. Key attributes: unique identifier, source text, selected voice, creation timestamp, and a reference to its stored audio. Standalone in v1 (no grouping or relationships).
- **Voice**: A selectable speaking voice offered by the configured provider. Key attributes: identifier/display name. A read-only catalog the user chooses from.
- **Audio artifact**: The stored, playable and downloadable audio produced for a generation. Bound one-to-one to a Generation; removed when its Generation is deleted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can go from pasted text to playing audio on a single screen using only a voice selection and one generate action (no more than 3 interactions total).
- **SC-002**: 100% of successful generations appear in the library and remain available after an application restart.
- **SC-003**: A past generation can be replayed from the library with zero additional provider requests.
- **SC-004**: 100% of failed generations show a specific, human-readable reason and result in zero loss of the user's entered text.
- **SC-005**: A user can locate and start replaying a specific past generation within 10 seconds of opening the library.
- **SC-006**: After a user deletes an entry, it no longer appears in the library and its audio is no longer retrievable, including after a restart.

## Assumptions

- **Single-user / self-hosted**: v1 assumes single-user, local/self-hosted use; there are no user accounts or per-user separation.
- **Access control**: The application has no built-in authentication. Restricting who can reach the web UI is the operator's responsibility (e.g., binding to localhost, a reverse proxy, or a VPN).
- **Voice-only controls**: v1 exposes voice selection only. Other synthesis parameters (model, speaking speed, output format) use fixed sensible defaults and are out of scope.
- **Audio format**: Generated audio is produced, stored, and downloaded as MP3.
- **Input length limit**: Maximum input length is 4,096 characters per generation; longer input is rejected with guidance. Splitting/chunking long text is out of scope for v1.
- **Library ordering**: The library is ordered newest-first.
- **Deletion is permanent**: Deleting an entry is permanent (no trash/undo) and is confirmed before it happens.
- **Provider configured at deployment**: The text-to-speech provider and its available voices are configured at deployment; the app reads the voice catalog from that configuration.
- **Connectivity**: Network access to the provider is required to create new generations but NOT to replay or download existing library entries.
- **Durable storage**: Persistent storage for entry metadata and audio lives on durable storage that survives application restarts and redeploys.

## Out of Scope (v1)

- **Command-line / non-web surfaces**: This feature targets the web surface only. Reaching the same capabilities from a command-line interface is deferred to a later feature (with feature parity).
- **User accounts and multi-user separation**: No sign-in, no per-user libraries.
- **Editing or re-synthesizing existing entries**: Entries are immutable; changing audio means creating a new generation.
- **Organizing the library**: No folders, tags, or search over past generations.
- **Long-text handling**: No automatic splitting/chunking of input beyond the maximum length limit.
- **Extended synthesis controls**: No model, speaking-speed, or output-format selection beyond the single voice choice.

## Dependencies

- Requires access to a configured external text-to-speech provider (credentials supplied via deployment/environment configuration) in order to create new generations.
