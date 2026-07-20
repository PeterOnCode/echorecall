# Data Model: Structured Generate Batch Import

**Feature**: 008-batch-import | **Date**: 2026-07-19

All entities are in-memory values. This feature adds no persisted entity, database table, server DTO, or migration.

## 1. Canonical batch document

```ts
interface BatchDocumentV1 {
  schema: 'echorecall.batch'
  version: 1
  defaults?: BatchDefaults
  items: BatchItem[]
}

interface BatchDefaults {
  voiceId?: string
  model?: Model
  format?: Format
  instructions?: string | null
  metadata?: MetadataPatch
}

interface BatchItem extends BatchDefaults {
  text: string
}
```

Relationships:

- One document owns zero or more ordered items and at most one defaults object.
- Defaults cannot contain `text`.
- Every object is exact: unknown keys are errors.
- `schema`, `version`, and `items` are required at document scope.
- `text` is required at item scope and cannot be null.

Lifecycle: source text → serialization parse → raw unknown tree → document/default validation → item resolution/validation → preview.

## 2. Metadata patch

`MetadataPatch` has the same keys as the existing `Metadata`, but each present key also accepts `null` to explicitly remove the inherited value.

| Field | Raw override type | Normalized type/rule |
|-------|-------------------|----------------------|
| `title` | `string \| null` | string; blank is treated as absent for title derivation |
| `artist` | `string \| null` | string |
| `album` | `string \| null` | string |
| `genre` | `string \| null` | string |
| `comment` | `string \| null` | string |
| `recordedAt` | `string \| null` | string; existing Metadata representation (year/date/timestamp) |
| `track` | `string \| null` | string; accepted/previewed, then re-derived at generation |
| `languages` | `string[] \| null` | nonblank strings; supplied array replaces; empty removes field |
| `customText` | `{ description: string; value: string }[] \| null` | exact entries; members nonblank; array replaces |
| `customUrl` | `{ description: string; url: string }[] \| null` | exact entries; members nonblank; no new URL-scheme restriction; array replaces |
| `notes` | `string \| null` | string |
| `encodedBy` | `string \| null` | string |
| `albumArtist` | `string \| null` | string |
| `composer` | `string \| null` | string |
| `bpm` | `number \| null` | finite non-negative integer |
| `rating` | `number \| null` | integer 0–5 |

`metadata` itself must be an object when present; `metadata: null` is invalid. A null child removes only that child. Missing fields inherit. Unknown metadata or nested entry keys are errors.

## 3. Base snapshot and resolution

```ts
interface BatchBaseInput {
  voiceId: string
  model: Model
  format: Format
  instructions?: string
  metadata: Metadata
}

interface ResolvedQueueInput extends BatchBaseInput {
  text: string
}
```

The page captures `BatchBaseInput` when the user selects a file. Generate currently has no instructions control, so `instructions` is normally absent unless supplied by document defaults/items. Base metadata uses the same visible-field projection as a directly added queue item.

Resolution is deterministic:

1. clone the base snapshot;
2. overlay file defaults;
3. overlay the item;
4. trim/validate item text;
5. validate the fully resolved generation settings and metadata;
6. emit a valid normalized input or invalid candidate.

Missing inherits. `instructions: null` removes. Metadata merges per field. Metadata null removes that field. Arrays replace. No resolved value retains raw `null`.

## 4. Source location and issues

```ts
type BatchSourceLocation =
  | { kind: 'item'; number: number } // one-based document item
  | { kind: 'line'; number: number } // original one-based text line

interface BatchIssue {
  code: BatchIssueCode
  path: string
  details?: Record<string, string | number>
}
```

Candidate issue codes:

- `missingField`
- `unknownField`
- `wrongType`
- `emptyText`
- `textTooLong`
- `invalidVoice`
- `invalidModel`
- `invalidFormat`
- `invalidMetadata`

`path` uses stable source-oriented notation such as `items[1].text` or `items[2].metadata.languages[0]`. The displayed item number remains one-based even if an internal array index is zero-based. Multiple issues may attach to one invalid candidate.

## 5. Import candidate

```ts
interface CandidateDisplay {
  excerpt: string
  voiceId?: string
  model?: string
  format?: string
}

type ImportCandidate =
  | {
      valid: true
      location: BatchSourceLocation
      display: CandidateDisplay
      issues: []
      input: ResolvedQueueInput
    }
  | {
      valid: false
      location: BatchSourceLocation
      display: CandidateDisplay
      issues: BatchIssue[]
    }
```

Only the valid branch carries a normalized queue input. This is the type-level boundary preventing invalid rows from being appended. `display` is best effort so a malformed row can still show a useful excerpt and any recognized generation values.

## 6. Blocking document error

```ts
type BatchDocumentErrorCode =
  | 'unsupportedExtension'
  | 'tooLarge'
  | 'readFailed'
  | 'malformed'
  | 'duplicateKey'
  | 'duplicateProperty'
  | 'customTag'
  | 'anchor'
  | 'alias'
  | 'unknownField'
  | 'schema'
  | 'version'
  | 'invalidRoot'
  | 'invalidDefaults'

interface BatchDocumentError {
  scope: 'file' | 'document' | 'defaults'
  code: BatchDocumentErrorCode
  path?: string
  line?: number
  column?: number
  details?: Record<string, string | number>
}
```

File/parse/document/default failures are blocking and create no candidates eligible for confirmation. Item-local failures are candidate issues instead.

## 7. Import preview

```ts
interface BatchPreview {
  filename: string
  format: 'text' | 'yaml' | 'json'
  candidates: ImportCandidate[]
  counts: {
    valid: number
    rejected: number
    blank: number
  }
  canConfirm: boolean
}

type BatchParseResult =
  | { ok: true; preview: BatchPreview }
  | { ok: false; error: BatchDocumentError }
```

Invariants:

- candidate order equals source order;
- `valid + rejected === candidates.length`;
- `blank` is separate because blank `.txt` lines are not candidates;
- `canConfirm === (valid > 0)`;
- duplicate text remains represented as separate candidates;
- there is no candidate-count limit; file size is the only file-level scale guard;
- the UI shows candidates in pages of at most 100 without changing the core order.

## 8. Plain-text compatibility model

Each trimmed nonblank line becomes a candidate at its original line number. Oversized nonblank lines become invalid candidates. Internal blank lines increment `blank`; a single conventional trailing newline is ignored. A wholly empty/whitespace-only document preserves shipped behavior by producing no candidates and zero blank count.

## 9. UI workflow state

```ts
type BatchImportState =
  | { kind: 'idle' }
  | { kind: 'reading'; filename: string }
  | { kind: 'parsing'; filename: string }
  | { kind: 'preview'; preview: BatchPreview; page: number }
  | { kind: 'blocked'; filename?: string; error: BatchDocumentError }
  | { kind: 'imported'; filename: string; added: number; rejected: number }
```

Transitions:

```text
idle ─select→ reading ─success→ parsing ─success→ preview
                    │                    └failure→ blocked
                    └failure→ blocked
preview ─cancel→ idle
preview ─confirm(valid>0)→ imported → idle/next selection
blocked ─dismiss/new selection→ idle/reading
```

Queue state changes only on the confirm transition.

## 10. Queue append mapping

For each valid normalized input, in preview order:

```ts
interface QueueItem extends ResolvedQueueInput {
  clientId: string              // newly minted
  status: 'queued'
  source: 'upload'
  sourceName: string            // original filename
  metadataEdited?: boolean      // true for structured; false for text
}
```

Never copy `clientId`, `status`, `error`, `result`, selection, or active-row state from raw input. Deep-clone metadata and arrays. Append to the then-current queue; do not mutate existing rows or reorder them.

After import:

- structured metadata is row-specific (`metadataEdited: true`) and survives pre-generation form projection;
- text metadata remains live (`metadataEdited: false`) as shipped;
- later form Voice/Model/Format changes still apply to every pending row;
- nonblank imported Title survives generation derivation;
- Track is regenerated from current full-queue position plus start-track immediately before generation.
