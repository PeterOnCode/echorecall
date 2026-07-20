# Feature Specification: Structured Generate Batch Import

**Feature Branch**: `008-batch-import`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: `specs/specs-plan.md` “Next implementation — Feature 008: Structured Generate batch import” section

## Clarifications

### Session 2026-07-19

- Q: How should YAML anchors and aliases be handled? → A: Reject all YAML anchors and aliases.
- Q: What candidate-count limit should apply to one batch file? → A: No candidate-count limit beyond the 5 MiB file-size limit.
- Q: How should duplicate property names in JSON be handled? → A: Reject the entire JSON document with a blocking parse error.
- Q: How should structured candidates be numbered in the preview? → A: Use one-based item numbers.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Import a YAML batch with inherited values (Priority: P1)

A user preparing several recordings downloads or writes an EchoRecall YAML batch document. The document can define shared defaults and one or more items, while each item can override selected values. When the user chooses the document, EchoRecall resolves every candidate from the current Generate values, the document defaults, and the item overrides, then presents the result for review before changing the queue.

**Why this priority**: YAML is the primary human-authored batch format and inheritance removes repetitive data entry. This journey delivers the feature's central value: preparing a generation queue outside the application without manually adding every row.

**Independent Test**: Start with known Generate values, import a YAML document containing defaults and item overrides, and verify that the preview shows every item in document order with the expected resolved text, voice, model, format, instructions, and metadata while the queue remains unchanged.

**Acceptance Scenarios**:

1. **Given** current Generate values and a valid YAML document with file defaults and multiple items, **When** the user selects the file, **Then** the preview lists all candidates in document order with values resolved from current values, file defaults, and per-item overrides in that precedence order.
2. **Given** a valid item that omits a property, **When** the preview is prepared, **Then** the property inherits the corresponding file default or current Generate value.
3. **Given** a valid item that explicitly clears optional instructions or an individual metadata field, **When** the preview is prepared, **Then** the cleared field is empty while unrelated inherited fields remain unchanged.
4. **Given** an item that supplies an array value, **When** the preview is prepared, **Then** that array replaces the inherited array rather than being combined with it.
5. **Given** a valid preview and an existing queue, **When** the user confirms import, **Then** all valid candidates are appended in document order and all pre-existing rows remain unchanged.

---

### User Story 2 - Review row-specific errors and import valid rows (Priority: P1)

Before importing, the user sees a read-only preview that identifies every candidate by one-based item number or original one-based text-file line number. Each row shows a text excerpt and its resolved generation settings. Invalid rows remain visible with specific errors, allowing the user to understand the source problem and still import valid rows from the same file.

**Why this priority**: Batch files are error-prone and may contain many items. A preview prevents accidental queue changes, while partial success avoids forcing users to discard an otherwise useful batch because of one bad row.

**Independent Test**: Import a file containing both valid and invalid candidates, verify that each error is attached to the correct source location, confirm the import, and verify that only valid candidates are appended and the invalid candidates remain excluded.

**Acceptance Scenarios**:

1. **Given** a file containing valid and invalid individual items, **When** parsing completes, **Then** the preview displays every candidate, labels each by one-based item number or original one-based line number, and associates each validation message with the affected candidate.
2. **Given** a preview row, **When** the user inspects it, **Then** the row shows a text excerpt plus its resolved voice, model, and format, and exposes any additional row-specific errors.
3. **Given** a mixed preview with at least one valid candidate, **When** the user confirms import, **Then** only valid candidates are appended and the user receives an accessible summary of imported and rejected counts.
4. **Given** a preview containing no valid candidates, **When** the user reviews it, **Then** confirmation is unavailable and the queue remains unchanged.
5. **Given** any preview, **When** the user cancels, **Then** no candidates are added and the existing queue remains unchanged.

---

### User Story 3 - Import equivalent JSON and plain-text batches (Priority: P2)

A user or external script can supply the same structured batch contract as JSON. Existing plain-text batch files also remain supported, with each trimmed nonblank line treated as one candidate. All accepted formats use the same preview-and-confirm experience and apply the same item validation rules.

**Why this priority**: JSON supports scripted workflows and preserving plain-text import avoids regression for existing users. Both broaden access to the core import value after the primary YAML journey is available.

**Independent Test**: Import equivalent YAML and JSON documents plus a plain-text file, then verify that the structured documents produce equivalent candidates and that each nonblank text line becomes one preview candidate with the expected inherited Generate values.

**Acceptance Scenarios**:

1. **Given** YAML and JSON documents representing the same contract and values, **When** each is imported from the same Generate state, **Then** their previews contain equivalent normalized candidates and validation outcomes.
2. **Given** a `.txt` file containing content and blank lines, **When** it is imported, **Then** each trimmed nonblank line becomes one candidate, blank lines are counted but not importable, and original line numbers identify the candidates.
3. **Given** an accepted `.txt`, `.yaml`, `.yml`, or `.json` file, **When** it is selected, **Then** the same read-only preview and explicit confirmation flow is used before the queue changes.
4. **Given** an oversized plain-text line, **When** the file is previewed, **Then** the line remains visible as an invalid candidate and other valid lines remain eligible for import.

---

### User Story 4 - Discover and reuse the batch contract (Priority: P2)

A user unfamiliar with the format can download a complete YAML example from the import interface and consult human-readable documentation. The documentation explains the contract, inheritance and clearing behavior, all validation rules, and how to represent the same document as JSON.

**Why this priority**: A structured import format only creates durable value when users can author correct files without reverse-engineering examples or application behavior.

**Independent Test**: Download the YAML example, verify it is a valid importable document, and use the documentation alone to identify every supported field, its inheritance and clearing behavior, validation boundaries, and the equivalent JSON representation.

**Acceptance Scenarios**:

1. **Given** the import interface, **When** the user requests the YAML example, **Then** a complete `echorecall-batch-v1.yaml` example is downloaded.
2. **Given** the downloaded example, **When** it is imported unchanged, **Then** it produces a valid preview with at least two candidates demonstrating shared defaults, per-item overrides, multiline text, metadata, and explicit clearing.
3. **Given** the batch-format documentation, **When** a user reads it, **Then** it describes every supported field, required values, precedence, missing-value inheritance, explicit clearing, array replacement, validation rules, and unknown-field handling.
4. **Given** a user who needs JSON, **When** they consult the documentation, **Then** they can view an equivalent JSON example using the same contract and rules.

### Edge Cases

- A selected file is empty, contains only blank text lines, or has a structured `items` list with no entries.
- A file contains more than 100 very short candidates but remains within the 5 MiB size limit.
- A file exceeds 5 MiB, uses an unsupported extension, or its extension does not match parseable content.
- A structured document is malformed, has a missing or incorrect schema identifier, uses an unsupported version, repeats a YAML key or JSON property name, contains a custom tag, or contains a YAML anchor or alias.
- File-level defaults are invalid even when one or more individual items would otherwise be valid.
- An item omits `text`, contains only whitespace, or exceeds 4,096 characters after trimming.
- An item contains an unknown field, an invalid catalog value, invalid metadata, or a value of the wrong type.
- An explicit `null` is used for a required field or a field that cannot be cleared.
- Multiple candidates contain identical text; each remains independently importable and order is preserved.
- The existing queue is empty, already contains rows, or changes between opening and confirming the preview.
- A filename contains non-ASCII characters or is long; imported rows still retain the original filename for display.

## Requirements *(mandatory)*

### Functional Requirements

**Format acceptance and contract**

- **FR-001**: The existing text-only upload action MUST be replaced by a unified **Import batch** workflow accepting `.txt`, `.yaml`, `.yml`, and `.json` files.
- **FR-002**: A selected file MUST NOT modify the current queue until the user explicitly confirms a completed preview.
- **FR-003**: YAML and JSON MUST represent one canonical batch contract containing the exact top-level fields `schema`, `version`, optional `defaults`, and `items`.
- **FR-004**: A canonical structured document MUST identify its schema as `echorecall.batch` and its version as `1`; a missing or different schema identifier or unsupported version MUST block import.
- **FR-005**: The contract MUST support `text`, `voiceId`, `model`, `format`, `instructions`, and existing metadata fields at the appropriate defaults or item level.
- **FR-006**: No unknown canonical field may be ignored. An unknown field at the document top level or anywhere within file-level defaults, including defaults metadata, MUST produce a blocking document error. An unknown field within an item or that item's metadata MUST invalidate only that item, MUST appear as a row-specific error, and MUST leave valid sibling items eligible for confirmation.
- **FR-007**: YAML input MUST follow YAML 1.2 value semantics and MUST reject duplicate keys, custom tags, anchors, and aliases. JSON input MUST reject duplicate property names. Any such violation MUST block the entire document before candidate validation.
- **FR-008**: Malformed structured documents and invalid file-level defaults MUST block the entire import and MUST leave the queue unchanged.
- **FR-009**: The workflow MUST reject files larger than 5 MiB before preview and explain the size limit to the user. It MUST NOT impose a separate candidate-count limit on files at or below 5 MiB.

**Resolution and validation**

- **FR-010**: Each structured candidate MUST resolve values in this order: current Generate values, optional file-level defaults, then optional per-item overrides.
- **FR-011**: Missing properties MUST inherit; explicit `null` MUST clear optional instructions or an individual optional metadata field; arrays supplied at a more specific level MUST replace inherited arrays rather than concatenate with them.
- **FR-012**: Candidate text MUST be trimmed, nonblank, and no longer than 4,096 characters.
- **FR-013**: Resolved voice, model, format, instructions, and metadata MUST satisfy the same accepted values and validation rules as items added directly from the Generate form.
- **FR-014**: Invalid individual items MUST remain visible with row-specific errors and MUST NOT prevent other valid items in the same file from being confirmed.
- **FR-015**: Structured candidates MUST retain document order throughout preview and confirmed import.
- **FR-016**: A `.txt` file MUST treat each trimmed nonblank line as one candidate, preserve original line order and line numbers, count blank and oversized lines, and validate candidates through the same rules used for structured items.
- **FR-017**: Duplicate candidate text MUST be allowed and MUST NOT be deduplicated.

**Preview and queue update**

- **FR-018**: The preview MUST identify structured candidates by one-based item number and text candidates by their original one-based line number.
- **FR-019**: Each preview row MUST show a text excerpt, resolved voice, model, and format, its valid or invalid state, and all row-specific validation errors in an inspectable, read-only form.
- **FR-020**: Confirmation MUST be available only when at least one valid candidate exists and MUST append all and only valid candidates from the current preview.
- **FR-021**: Confirmed candidates MUST receive fresh identities, queued status, `upload` as their source, and the original filename; no transient state from a prior queue row may be reused.
- **FR-022**: A confirmed import MUST append candidates without modifying, removing, reordering, or replacing existing queue rows.
- **FR-023**: Cancelling or dismissing a preview MUST leave the existing queue unchanged.
- **FR-024**: The workflow MUST announce parsing, preview readiness, import success, import failure, and valid/rejected counts in a form available to assistive technologies.

**Documentation, compatibility, and scope**

- **FR-025**: The import interface MUST offer a downloadable, valid `echorecall-batch-v1.yaml` example demonstrating file defaults, multiple items, multiline text, per-item overrides, metadata, and explicit clearing.
- **FR-026**: Human-readable documentation MUST define every field, precedence, inheritance, clearing, array replacement, validation rule, error behavior, and the equivalent JSON representation, and MUST include an equivalent JSON example.
- **FR-027**: All new user-visible text and status announcements MUST be available in English and Hungarian.
- **FR-028**: Save queue and Load queue MUST retain their existing saved-queue contract and queue-replacement behavior; batch import MUST remain a separate append-only workflow.
- **FR-029**: Existing Generate defaults, pending-row behavior, generation flow, source-filename display, and direct item creation MUST continue to behave unchanged outside the new import workflow.
- **FR-030**: This feature MUST NOT add XML import, user-defined mappings for arbitrary structured data, editing inside the preview, queue replacement through batch import, Library audio-file management, command-line import, or authentication.

### Key Entities *(include if feature involves data)*

- **Canonical Batch Document**: A versioned structured file with a fixed schema identifier, optional shared defaults, and an ordered collection of batch items; it can be serialized as YAML or JSON.
- **Batch Defaults**: Optional shared generation settings, instructions, and metadata applied between current Generate values and per-item overrides.
- **Batch Item**: One source entry containing required text plus optional overrides; it resolves to one candidate and retains its one-based document item number.
- **Import Candidate**: A read-only preview result containing source location, resolved values, text excerpt, validity, and row-specific errors; only a valid candidate can become a queue row.
- **Import Preview**: The complete review state for one selected file, including blocking document errors, ordered candidates, valid/rejected counts, filename, and confirmation eligibility.
- **Queue Row**: A confirmed valid candidate appended to the current generation queue with a fresh identity, queued status, upload source, and original filename.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a timed acceptance walkthrough with a valid 100-item YAML file already available, a user can activate **Import batch**, select the file, verify the preview's valid and rejected totals, inspect the resolved voice, model, and format for items 1 and 100, confirm the import, and receive the success announcement in under 2 minutes. Timing starts when the user activates **Import batch** and ends when the success announcement is presented; file-authoring time is excluded.
- **SC-002**: Equivalent YAML and JSON documents produce the same ordered candidates, resolved values, and validation outcomes in 100% of contract-equivalence tests.
- **SC-003**: For mixed-validity files, 100% of invalid candidates remain associated with their correct one-based item number or original one-based line number, while 100% of valid candidates remain eligible for import.
- **SC-004**: A confirmed import appends every valid candidate exactly once, in source order, while preserving every existing queue row unchanged in 100% of acceptance tests.
- **SC-005**: Cancelling a preview, selecting an oversized file, or encountering a blocking document error changes zero queue rows.
- **SC-006**: At least 90% of representative first-time users can author and successfully preview a valid YAML batch using only the downloadable example and documentation, without assistance.
- **SC-007**: 100% of new visible copy and status announcements are available in both supported languages, and all preview and confirmation actions are operable by keyboard and perceivable with assistive technology.
- **SC-008**: Existing plain-text import and saved-queue load acceptance scenarios retain 100% of their prior expected outcomes, except that plain-text import now adds the required preview and confirmation step.
- **SC-009**: On the reference desktop profile, every performance acceptance fixture at or below 5 MiB and containing no more than 100 candidates produces either a preview or a specific actionable error within 3 seconds in each of five consecutive runs. Timing starts when file selection completes and ends when the preview or actionable error is available to the user.

## Assumptions

- The current Generate form values at the time a file is selected provide the base values for candidate resolution; later form changes do not silently rewrite an already-open preview.
- If the queue changes after a preview opens, confirmation appends to the queue's then-current contents and never removes or rewrites rows added in the meantime.
- File extension selects the intended input format. Content that cannot be read as that format produces a blocking, actionable error rather than automatic format guessing.
- `null` clearing is limited to optional instructions and individual optional metadata fields. Required text and required generation settings cannot be cleared.
- YAML anchors and aliases are unsupported; reusable values are expressed through the canonical document's file-level defaults.
- Existing voice, model, format, instructions, metadata, queue, and saved-queue definitions remain authoritative; this feature adds an import path rather than redefining those concepts.
- Import is a local preparation workflow and does not itself start generation or make external service calls.
- The measurable responsiveness target covers batches of up to 100 candidates; larger batches within the 5 MiB limit remain accepted but carry no additional responsiveness guarantee.
- The SC-009 reference desktop profile has at least four logical processor cores, 8 GiB of memory, a current supported browser, and no concurrent processor-intensive workload. The performance acceptance fixtures comprise one valid 100-candidate file for each accepted extension and one representative blocking-error file for each structured format; every fixture remains at or below 5 MiB.
