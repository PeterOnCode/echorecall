import type { Format, ListItem, Metadata, Model } from '#core/client'
import { MAX_INPUT_LENGTH, formatInfo, parseUploadText } from '#core/client'

export type ItemStatus = 'queued' | 'generating' | 'done' | 'failed'

/** A queue row plus its transient per-item generation status (never persisted). */
export interface QueueItem extends ListItem {
  status: ItemStatus
  error?: string
  result?: { id: string; audioUrl: string; skippedTags?: string[] }
  /**
   * Where the row came from (005 source column): `'upload'` carries the uploaded
   * filename in {@link QueueItem.sourceName}; `'text'` is an ad-hoc typed entry.
   */
  source: 'upload' | 'text'
  /** The uploaded file's name when `source === 'upload'`; absent for typed rows. */
  sourceName?: string
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
  // Which row is shown in the detail editor (005 redesign); driven by list
  // selection and toolbar prev/next navigation.
  const activeId = ref<string | null>(null)
  // Multi-select set (by clientId) backing the checkbox column — used for bulk
  // delete and as the Generate target (checked-else-all).
  const checkedIds = ref<Set<string>>(new Set())

  function makeItem(text: string, source: QueueItem['source'], sourceName?: string): QueueItem {
    return {
      clientId: globalThis.crypto.randomUUID(),
      text,
      voiceId: voiceId.value,
      model: model.value,
      format: format.value,
      metadata: cloneMetadata(metadata.value),
      status: 'queued',
      source,
      ...(sourceName ? { sourceName } : {}),
    }
  }

  /** Append one row from trimmed text; ignores blank input. */
  function addItem(text: string): QueueItem | null {
    const trimmed = text.trim()
    if (trimmed.length === 0) return null
    const item = makeItem(trimmed, 'text')
    items.value.push(item)
    return item
  }

  function addItems(texts: string[]): void {
    for (const text of texts) addItem(text)
  }

  /**
   * Parse uploaded `.txt` content into appended rows and report the summary. Each
   * row is tagged `source: 'upload'` and carries the originating `filename` (when
   * provided) so the queue's source column can show it (FR-006).
   */
  function addFromUpload(content: string, filename?: string): UploadSummary {
    const parsed = parseUploadText(content)
    for (const parsedItem of parsed.items) {
      items.value.push(makeItem(parsedItem.text, 'upload', filename))
    }
    return {
      added: parsed.added,
      skippedBlank: parsed.skippedBlank,
      rejectedTooLong: parsed.rejectedTooLong,
    }
  }

  function removeItem(clientId: string): void {
    items.value = items.value.filter((i) => i.clientId !== clientId)
    forget([clientId])
  }

  /** Drop client ids from the checked set and clear the active id if it was removed. */
  function forget(clientIds: string[]): void {
    if (checkedIds.value.size > 0) {
      const next = new Set(checkedIds.value)
      for (const id of clientIds) next.delete(id)
      checkedIds.value = next
    }
    if (activeId.value !== null && clientIds.includes(activeId.value)) activeId.value = null
  }

  /** Remove several rows at once (multi-select delete), clearing their state. */
  function removeMany(clientIds: string[]): void {
    const drop = new Set(clientIds)
    items.value = items.value.filter((i) => !drop.has(i.clientId))
    forget(clientIds)
  }

  /** Toggle one row's membership in the checked set (reassigned for reactivity). */
  function toggleChecked(clientId: string): void {
    const next = new Set(checkedIds.value)
    if (next.has(clientId)) next.delete(clientId)
    else next.add(clientId)
    checkedIds.value = next
  }

  /**
   * Header-checkbox behaviour over the given rows: if every one is already
   * checked, clear them; otherwise check them all. Operates on the rows passed in
   * (the currently visible/filtered set), leaving any off-list selection intact.
   */
  function toggleAll(rows: QueueItem[]): void {
    const ids = rows.map((r) => r.clientId)
    const allChecked = ids.length > 0 && ids.every((id) => checkedIds.value.has(id))
    const next = new Set(checkedIds.value)
    if (allChecked) for (const id of ids) next.delete(id)
    else for (const id of ids) next.add(id)
    checkedIds.value = next
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
    checkedIds.value = new Set()
    activeId.value = null
  }

  /**
   * Seed the shared form-level metadata with deployment-provided defaults (US10 /
   * FR-048). Title is never defaulted, so it is stripped even if present. New rows
   * clone this metadata in {@link makeItem}, so the defaults reach both the form and
   * every newly-added row.
   *
   * Defaults arrive from an async fetch on mount, so a fast user may type before they
   * land. They are merged *behind* whatever the user already set — defaults only fill
   * still-empty fields — so an early edit is never clobbered and every default stays
   * overridable/clearable (FR-048).
   */
  function setDefaults(defaults: Metadata): void {
    const seeded = cloneMetadata(defaults)
    delete seeded.title
    const userEntered = Object.fromEntries(
      Object.entries(metadata.value).filter(
        ([, value]) => value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0),
      ),
    )
    metadata.value = { ...seeded, ...userEntered } as Metadata
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
    activeId,
    checkedIds,
    addItem,
    addItems,
    addFromUpload,
    removeItem,
    removeMany,
    toggleChecked,
    toggleAll,
    updateItem,
    applyMetadataToPending,
    setDefaults,
    clear,
  }
}

/** Deep copy of a Metadata value (JSON-safe: plain strings/arrays only). */
function cloneMetadata(metadata: Metadata): Metadata {
  return JSON.parse(JSON.stringify(metadata)) as Metadata
}
