# Queue Append Contract

This contract defines the only mutation performed by batch import.

## Operation

```ts
interface AppendImportedOptions {
  metadataMode: 'structured' | 'text'
}

function appendImported(
  inputs: readonly ResolvedQueueInput[],
  filename: string,
  options: AppendImportedOptions,
): QueueItem[]
```

The caller passes only valid candidates, in preview order. The function returns the newly appended rows for summary/testing.

## Preconditions

- The user explicitly confirmed the current preview.
- At least one valid candidate exists.
- Inputs are normalized core outputs, not raw file objects.
- Filename is the original selected filename.

## Mapping

Each normalized input maps to one new row:

| Queue field | Value |
|-------------|-------|
| `clientId` | newly minted unique client ID |
| `text` | normalized input text |
| `voiceId` | resolved input voice |
| `model` | resolved input model |
| `format` | resolved input format |
| `instructions` | resolved input instructions when present |
| `metadata` | deep clone of resolved metadata |
| `status` | `queued` |
| `source` | `upload` |
| `sourceName` | original filename |
| `metadataEdited` | `true` for structured imports; `false`/absent for text imports |
| `error`, `result` | absent |

Do not copy transient identifiers or states from raw data. Imported rows begin unselected and do not become the active row automatically.

## Atomic observable behavior

- Append all and only valid preview candidates exactly once.
- Preserve preview/source order among appended rows.
- Existing queue rows retain object identity, values, order, status, selection, and active state.
- Rows added by another action after preview opened remain before the imported rows and are not rewritten.
- Confirmation never clears/replaces the queue.
- Cancellation or blocking errors never call append.

The implementation may push rows sequentially inside one synchronous call; “atomic” means no public partial-success result or validation failure occurs because inputs are already normalized.

## Interaction with Feature 007

- **Voice/Model/Format**: Later form-control changes remain apply-to-all for pending rows and may intentionally update imported rows.
- **Metadata**: Structured file metadata is row-specific (`metadataEdited: true`) so form metadata projection immediately before generation does not erase resolved defaults/overrides. Text rows retain existing live form metadata.
- **Title**: A supplied nonblank title survives; an absent/blank title is derived from the item's first text line.
- **Track**: Always re-derived from full queue position and configured start-track immediately before generation, regardless of imported value.
- **Status/cost/generation**: New rows participate in existing queue filtering, selection, pricing, generation, failure, cancellation, and remove-on-success behavior without a new path.

## Separation from saved queue loading

| Workflow | Input contract | Mutation |
|----------|----------------|----------|
| Import batch | `echorecall.batch` v1 YAML/JSON or line-based text | Append confirmed valid candidates |
| Load queue | existing `echorecall.queue` v1 JSON | Replace queue after its existing confirmation rules |

The batch JSON parser must never route `echorecall.queue` documents into Load queue or silently reinterpret them.
