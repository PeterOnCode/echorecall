import type { Format, ListItem, Metadata, Model } from '#core/client'
import { parseUploadText } from '#core/client'

export type ItemStatus = 'queued' | 'generating' | 'done' | 'failed'

/** A queue row plus its transient per-item generation status (never persisted). */
export interface QueueItem extends ListItem {
  status: ItemStatus
  error?: string
  result?: { id: string; audioUrl: string }
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

  function makeItem(text: string): QueueItem {
    return {
      clientId: globalThis.crypto.randomUUID(),
      text,
      voiceId: voiceId.value,
      model: model.value,
      format: format.value,
      metadata: {} as Metadata,
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

  return { items, voiceId, model, format, speed, addItem, addItems, addFromUpload, removeItem, clear }
}
