# Batch import format

EchoRecall can preview and import line-based `.txt` files or structured YAML 1.2 and JSON
documents. Structured files use the same `echorecall.batch` version 1 contract. Importing is
local to the browser: the queue changes only after you review the preview and confirm it.

Download the canonical [`echorecall-batch-v1.yaml`](../public/examples/echorecall-batch-v1.yaml)
example to start authoring a file.

## Document shape

| Field | Required | Type | Meaning |
|---|---|---|---|
| `schema` | yes | exact string `echorecall.batch` | Contract discriminator |
| `version` | yes | number `1` | Contract version |
| `defaults` | no | object | Shared overrides applied to every item |
| `items` | yes | array | Ordered generation candidates |

Only these top-level fields are accepted. A missing or different schema, unsupported version,
malformed root, invalid defaults, or unknown field at document/default scope blocks the import.

## Defaults and item fields

| Field | In `defaults` | In an item | Accepted value |
|---|---|---|---|
| `text` | forbidden | required | String, trimmed nonblank, at most 4,096 characters |
| `voiceId` | optional | optional | A supported voice identifier |
| `model` | optional | optional | `tts-1`, `tts-1-hd`, or `gpt-4o-mini-tts` |
| `format` | optional | optional | `mp3`, `wav`, `flac`, `opus`, `aac`, or `pcm` |
| `instructions` | optional | optional | String or `null` |
| `metadata` | optional | optional | Metadata patch object; the object cannot be `null` |

An unknown item field invalidates that item while valid siblings remain eligible for confirmation.
An unknown field in `defaults` blocks the whole document.

## Resolution and inheritance

Each item resolves in this precedence order:

1. current Generate values captured when the file is selected;
2. file `defaults`;
3. item overrides.

Missing properties inherit the less-specific value. An explicit `null` clears inherited
`instructions` or one optional metadata field; it is invalid for required values. Metadata merges
field by field. A supplied array replaces the inherited array rather than concatenating it, and an
empty array clears that array field. No normalized queue item retains a raw `null`.

## Metadata fields

| Field | Accepted value | Rule |
|---|---|---|
| `title` | string or `null` | A nonblank title is preserved |
| `artist` | string or `null` | Text tag |
| `album` | string or `null` | Text tag |
| `genre` | string or `null` | Text tag |
| `comment` | string or `null` | Text tag |
| `recordedAt` | string or `null` | Existing EchoRecall year/date/timestamp value |
| `track` | string or `null` | Accepted in preview; see Track behavior |
| `languages` | string array or `null` | Every entry is nonblank; array replaces |
| `customText` | array or `null` | Exact `{ description, value }` nonblank string entries |
| `customUrl` | array or `null` | Exact `{ description, url }` nonblank string entries |
| `notes` | string or `null` | Text tag |
| `encodedBy` | string or `null` | Text tag |
| `albumArtist` | string or `null` | Text tag |
| `composer` | string or `null` | Text tag |
| `bpm` | number or `null` | Finite non-negative integer |
| `rating` | number or `null` | Integer from 0 through 5 |

Metadata objects and nested custom entries are exact: unknown keys are errors. `null` removes only
the named metadata field. `metadata` itself must be an object when present.

## Validation and errors

Files must be no larger than 5 MiB. There is no separate candidate-count limit, document order is
preserved, and duplicate candidate text is allowed.

YAML uses YAML 1.2 core values and permits comments and multiline strings. EchoRecall accepts one
document only and rejects duplicate YAML keys, custom tags, anchors, aliases, and merge keys.
JSON uses strict JSON syntax and rejects duplicate JSON properties—including escaped-equivalent
names—as well as comments and trailing commas.

Syntax, schema/version, document shape, file defaults, and unknown document/default fields are
blocking errors. An invalid item stays visible with its errors while valid siblings can still be
confirmed. Confirmation appends all and only valid candidates; cancellation changes nothing.

## Track behavior

A supplied nonblank Title survives import. Track is accepted and previewed, but it is always
re-derived from the full queue order and configured first-track value immediately before
generation. Reordering the queue therefore updates the generated track numbers.

## Canonical YAML

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
    languages: [eng]
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

## Equivalent JSON

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
