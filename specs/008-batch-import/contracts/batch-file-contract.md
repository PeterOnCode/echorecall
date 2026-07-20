# EchoRecall Batch File Contract v1

**Schema**: `echorecall.batch` | **Version**: `1` | **Serializations**: YAML 1.2 or JSON

This is the author-facing contract for structured Generate imports. YAML and JSON represent the same fields and produce identical normalized candidates.

## Document shape

| Field | Required | Type | Meaning |
|-------|----------|------|---------|
| `schema` | yes | exact string `echorecall.batch` | Contract discriminator |
| `version` | yes | number `1` | Contract version |
| `defaults` | no | Batch defaults object | Shared overrides applied to every item |
| `items` | yes | array of batch item objects | Ordered generation candidates |

Unknown fields are errors. A wrong/missing schema, unsupported version, malformed root, invalid defaults, or unknown top-level/default field blocks the whole import.

## Defaults and item fields

| Field | Defaults | Item | Type |
|-------|----------|------|------|
| `text` | forbidden | required | string, trimmed nonblank, max 4,096 characters |
| `voiceId` | optional | optional | supported voice identifier |
| `model` | optional | optional | `tts-1`, `tts-1-hd`, or `gpt-4o-mini-tts` |
| `format` | optional | optional | `mp3`, `wav`, `flac`, `opus`, `aac`, or `pcm` |
| `instructions` | optional | optional | string or `null` |
| `metadata` | optional | optional | metadata patch object; the object itself cannot be `null` |

Unknown item fields invalidate that item, not valid siblings. Unknown defaults fields block the document.

## Resolution

For each item, EchoRecall resolves:

1. current Generate values captured when the file is selected;
2. file-level `defaults`;
3. per-item overrides.

Missing properties inherit. `instructions: null` clears inherited instructions. Metadata merges field by field; `null` clears only that metadata field. A supplied array replaces the inherited array rather than concatenating. An empty array clears that array field.

The current Generate page has no instructions input, so instructions normally originate only in the file. Current Generate metadata contributes only fields active in the form snapshot; explicit file metadata is accepted regardless of field visibility.

## Metadata fields

| Field | Type | Notes |
|-------|------|-------|
| `title` | string or `null` | Preserved when nonblank; otherwise derived from text at generation |
| `artist` | string or `null` | |
| `album` | string or `null` | |
| `genre` | string or `null` | |
| `comment` | string or `null` | |
| `recordedAt` | string or `null` | Existing EchoRecall year/date/timestamp representation |
| `track` | string or `null` | Previewed/imported, but re-derived from queue order/start-track at generation |
| `languages` | string array or `null` | Every entry must be nonblank; array replaces |
| `customText` | array or `null` | Exact `{ description, value }` nonblank string entries; array replaces |
| `customUrl` | array or `null` | Exact `{ description, url }` nonblank string entries; array replaces |
| `notes` | string or `null` | |
| `encodedBy` | string or `null` | |
| `albumArtist` | string or `null` | |
| `composer` | string or `null` | |
| `bpm` | number or `null` | Finite non-negative integer |
| `rating` | number or `null` | Integer from 0 through 5 |

Metadata and nested custom-entry objects are exact; unknown keys are errors. `null` is legal only for instructions and individual metadata fields. Required text and generation settings cannot be cleared with null.

## Canonical YAML example

```yaml
schema: echorecall.batch
version: 1

defaults:
  voiceId: nova
  model: gpt-4o-mini-tts
  format: mp3
  instructions: Speak clearly
  metadata:
    artist: EchoRecall
    album: Example batch
    languages:
      - eng

items:
  - text: |-
      The first queue item can contain
      multiple lines of text.

  - text: The second queue item.
    voiceId: alloy
    instructions: null
    metadata:
      title: Custom title
      track: "2"
      artist: null
```

## Equivalent JSON example

```json
{
  "schema": "echorecall.batch",
  "version": 1,
  "defaults": {
    "voiceId": "nova",
    "model": "gpt-4o-mini-tts",
    "format": "mp3",
    "instructions": "Speak clearly",
    "metadata": {
      "artist": "EchoRecall",
      "album": "Example batch",
      "languages": ["eng"]
    }
  },
  "items": [
    {
      "text": "The first queue item can contain\nmultiple lines of text."
    },
    {
      "text": "The second queue item.",
      "voiceId": "alloy",
      "instructions": null,
      "metadata": {
        "title": "Custom title",
        "track": "2",
        "artist": null
      }
    }
  ]
}
```

## Syntax and safety rules

YAML:

- YAML 1.2 core scalar semantics;
- one document only;
- comments and multiline strings allowed;
- duplicate mapping keys rejected;
- all explicit/custom tags rejected;
- all anchors and aliases rejected, even an unused anchor;
- merge keys disabled.

JSON:

- strict JSON syntax enforced;
- duplicate property names rejected, including decoded/escaped-equivalent names;
- comments and trailing commas rejected.

Both:

- maximum file size 5 MiB;
- no separate candidate-count limit;
- document order preserved;
- duplicate text allowed;
- invalid file defaults block the import;
- invalid individual items remain previewable while valid siblings can be confirmed.

## Generate behavior after import

Confirmation appends valid candidates and preserves existing queue rows. Later changes to the Generate Voice, Model, or Format control remain explicit apply-to-all changes and can update pending imported rows. Structured metadata is treated as row-specific so form metadata projection does not erase it. Title is retained when supplied; Track is always recalculated from current queue position and the configured first-track value immediately before generation.
