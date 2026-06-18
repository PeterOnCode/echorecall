import type { Format, ListItem, Metadata, Model } from '#core/client'
import { MAX_INPUT_LENGTH, formatInfo, parseUploadText } from '#core/client'

export type ItemStatus = 'queued' | 'generating' | 'done' | 'failed'

/** A queue row plus its transient per-item generation status (never persisted). */
export interface QueueItem extends ListItem {
  status: ItemStatus
  error?: string
  result?: { id: string; audioUrl: string; skippedTags?: string[] }
  /**
   * Set once the row's metadata is edited individually (US3). Tells
   * {@link useQueue.applyMetadataToPending} to leave this row alone so its per-row
   * metadata survives generation instead of being overwritten by the shared form set.
   */
  metadataEdited?: boolean
}

export interface UploadSummary {
  added: number
  skippedBlank: number
  rejectedTooLong: number
}

/** Fields a single queue row can be edited with (US3); each key is optional. */
export type ItemPatch = Partial<Pick<ListItem, 'text' | 'voiceId' | 'model' | 'format' | 'instructions' | 'metadata'>>

/** Why a text edit was refused (empty after trim, or over the input cap). */
export type TextRejection = 'empty' | 'tooLong'

/** Outcome of {@link useQueue.updateItem}: a refused edit, or the applied row. */
export type UpdateResult =
  | { ok: false; reason: TextRejection | 'notFound' }
  | { ok: true; item: QueueItem; tagsSkipped: boolean }

/**
 * Validate queue-row text the same way uploads and generation do: trimmed,
 * non-blank, within {@link MAX_INPUT_LENGTH}. Returns the trimmed value to store
 * on success, or the rejection reason so the editor can keep the previous value.
 */
export function validateItemText(text: string): { ok: true; text: string } | { ok: false; reason: TextRejection } {
  const trimmed = text.trim()
  if (trimmed.length === 0) return { ok: false, reason: 'empty' }
  if (trimmed.length > MAX_INPUT_LENGTH) return { ok: false, reason: 'tooLong' }
  return { ok: true, text: trimmed }
}

/** True when a format carries no tags (AAC/PCM), so embedded metadata is skipped. */
export function isUntaggableFormat(format: Format): boolean {
  return formatInfo(format)?.taggable === 'none'
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

  /**
   * Apply a per-row edit to a single queue item, affecting only that row (US3).
   * Text is revalidated (empty/over-cap edits are refused and the previous value
   * kept); `instructions` are retained across model changes (the server applies
   * them only for the instructions-capable model); `metadata` is never discarded
   * when switching to an untaggable format — the caller is warned via
   * `tagsSkipped` instead. Mutates the row in place to preserve its identity.
   */
  function updateItem(clientId: string, patch: ItemPatch): UpdateResult {
    const item = items.value.find((i) => i.clientId === clientId)
    if (!item) return { ok: false, reason: 'notFound' }

    if (patch.text !== undefined) {
      const validated = validateItemText(patch.text)
      if (!validated.ok) return { ok: false, reason: validated.reason }
      item.text = validated.text
    }
    if (patch.voiceId !== undefined) item.voiceId = patch.voiceId
    if (patch.model !== undefined) item.model = patch.model
    if (patch.format !== undefined) item.format = patch.format
    if (patch.instructions !== undefined) item.instructions = patch.instructions
    if (patch.metadata !== undefined) {
      item.metadata = cloneMetadata(patch.metadata)
      item.metadataEdited = true
    }

    return { ok: true, item, tagsSkipped: isUntaggableFormat(item.format) }
  }

  function clear(): void {
    items.value = []
  }

  /**
   * Apply the current form-level metadata to every not-yet-generated row that
   * hasn't been edited individually. Called right before generation so the
   * metadata shown on the form reaches the whole batch — including rows added
   * before it was filled (US2 has a single shared editor). A row with its own
   * per-row metadata edit (US3) is left untouched so its values survive generation.
   */
  function applyMetadataToPending(): void {
    for (const item of items.value) {
      if (item.status !== 'done' && !item.metadataEdited) item.metadata = cloneMetadata(metadata.value)
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
    updateItem,
    applyMetadataToPending,
    clear,
  }
}

/** Deep copy of a Metadata value (JSON-safe: plain strings/arrays only). */
function cloneMetadata(metadata: Metadata): Metadata {
  return JSON.parse(JSON.stringify(metadata)) as Metadata
}
