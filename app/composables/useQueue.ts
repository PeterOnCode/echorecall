import type { Format, ListItem, Metadata, Model } from '#core/client'
import { parseUploadText } from '#core/client'

export type ItemStatus = 'queued' | 'generating' | 'done' | 'failed'

/** A queue row plus its transient per-item generation status (never persisted). */
export interface QueueItem extends ListItem {
  status: ItemStatus
  error?: string
  result?: { id: string; audioUrl: string; skippedTags?: string[] }
}

export interface UploadSummary {
  added: number
  skippedBlank: number
  rejectedTooLong: number
}

/**
 * Ephemeral batch queue (FR-001/010). Holds the per-row list plus the form-level
 * voice/model/format/speed applied to every row. Lives only in client state and
 * is never sent anywhere except, row by row, to the generate endpoint.
 */
export function useQueue() {
  const items = ref<QueueItem[]>([])
  const voiceId = ref('')
  const model = ref<Model>('gpt-4o-mini-tts')
  const format = ref<Format>('mp3')
  const speed = ref(1)
  // Form-level metadata applied to every newly-added row (US2). Each row gets its
  // own deep copy so later per-row edits (US3) never mutate the shared defaults.
  const metadata = ref<Metadata>({})

  function makeItem(text: string): QueueItem {
    return {
      clientId: globalThis.crypto.randomUUID(),
      text,
      voiceId: voiceId.value,
      model: model.value,
      format: format.value,
      metadata: cloneMetadata(metadata.value),
      status: 'queued',
    }
  }

  /** Append one row from trimmed text; ignores blank input. */
  function addItem(text: string): QueueItem | null {
    const trimmed = text.trim()
    if (trimmed.length === 0) return null
    const item = makeItem(trimmed)
    items.value.push(item)
    return item
  }

  function addItems(texts: string[]): void {
    for (const text of texts) addItem(text)
  }

  /** Parse uploaded `.txt` content into appended rows and report the summary. */
  function addFromUpload(content: string): UploadSummary {
    const parsed = parseUploadText(content)
    addItems(parsed.items.map((i) => i.text))
    return {
      added: parsed.added,
      skippedBlank: parsed.skippedBlank,
      rejectedTooLong: parsed.rejectedTooLong,
    }
  }

  function removeItem(clientId: string): void {
    items.value = items.value.filter((i) => i.clientId !== clientId)
  }

  function clear(): void {
    items.value = []
  }

  /**
   * Apply the current form-level metadata to every not-yet-generated row. Called
   * right before generation so the metadata shown on the form reaches the whole
   * batch — including rows added before it was filled (US2 has a single shared
   * editor). Per-row editing (US3) will let an edited row keep its own set.
   */
  function applyMetadataToPending(): void {
    for (const item of items.value) {
      if (item.status !== 'done') item.metadata = cloneMetadata(metadata.value)
    }
  }

  return {
    items,
    voiceId,
    model,
    format,
    speed,
    metadata,
    addItem,
    addItems,
    addFromUpload,
    removeItem,
    applyMetadataToPending,
    clear,
  }
}

/** Deep copy of a Metadata value (JSON-safe: plain strings/arrays only). */
function cloneMetadata(metadata: Metadata): Metadata {
  return JSON.parse(JSON.stringify(metadata)) as Metadata
}
