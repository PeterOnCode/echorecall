# Import Preview Contract

This contract defines the boundary between the framework-independent batch core and the browser UI.

## Core request

```ts
interface ParseBatchRequest {
  content: string
  filename: string
  format: 'text' | 'yaml' | 'json'
  base: BatchBaseInput
}

type BatchParseResult =
  | { ok: true; preview: BatchPreview }
  | { ok: false; error: BatchDocumentError }
```

The browser determines format from `.txt`, `.yaml`/`.yml`, or `.json`, rejects files over 5 MiB, reads text, and supplies a frozen base snapshot. The core never reads browser `File` objects.

## Blocking errors

| Scope | Codes | UI behavior |
|-------|-------|-------------|
| File adapter | `unsupportedExtension`, `tooLarge`, `readFailed` | Alert; no preview/queue change |
| Serialization | `malformed`, `duplicateKey`, `duplicateProperty`, `customTag`, `anchor`, `alias` | Alert with source location when available |
| Document | `invalidRoot`, `unknownField`, `schema`, `version` | Alert; no candidates confirmable |
| Defaults | `invalidDefaults`, `unknownField` | Alert with field path; no candidates confirmable |

Blocking errors include stable code, scope, optional path, optional one-based line/column, and primitive details. Core messages are never localized strings.

## Candidate issues

| Code | Meaning |
|------|---------|
| `missingField` | Required item field absent |
| `unknownField` | Unknown item/metadata/nested field |
| `wrongType` | Field exists with the wrong runtime type |
| `emptyText` | Text blank after trimming |
| `textTooLong` | Trimmed text exceeds 4,096 characters |
| `invalidVoice` | Resolved voice is not in the catalog |
| `invalidModel` | Resolved model is not in the catalog |
| `invalidFormat` | Resolved format is not in the catalog |
| `invalidMetadata` | Metadata value or nested entry violates its field rule |

An invalid candidate may have multiple issues. Only a valid candidate exposes `ResolvedQueueInput`.

## Preview invariants

- Structured locations are one-based item numbers; text locations are original one-based line numbers.
- Candidates preserve source order.
- `counts.valid + counts.rejected === candidates.length`.
- Blank text lines are counted separately and do not become candidates.
- `canConfirm` is true exactly when `counts.valid > 0`.
- Duplicate text produces distinct candidates.
- Candidate display always attempts to provide excerpt/voice/model/format, but missing malformed values may render a localized placeholder.
- The UI paginates candidates at 100 rows per page; pagination does not alter preview order or confirmation scope.
- Confirm imports all valid candidates across every page, not only the visible page.

## Browser workflow

```text
idle
  └─ select supported file → reading → parsing
       ├─ blocking error → alert/blocked → dismiss or select another
       └─ preview → inspect/page
            ├─ cancel/dismiss → idle (zero queue changes)
            └─ confirm (valid > 0) → append all valid → success summary
```

Opening a preview freezes its base snapshot. Later Generate form changes do not rewrite the preview. Queue changes made while the preview is open are allowed; confirmation appends to then-current rows.

## Accessibility and localization

- File trigger, dialog title, row state, issue association, pagination, confirm, and cancel have accessible names.
- Parsing and preview-ready/count summaries use polite status announcements.
- Blocking failures use alert semantics.
- Import completion announces added and rejected counts.
- Dialog focus enters predictably, remains trapped by the modal, and returns to Import batch on close.
- Every issue/status/action label is keyed in both English and Hungarian; core codes remain language-neutral.
