import type { CostEstimate, Format, ListItem, Metadata, Model } from '#core/client'
import { MAX_INPUT_LENGTH, estimateItemCost, formatInfo, parseUploadText } from '#core/client'
// Types only (imported by relative path per the repo typecheck gotcha): the saved-
// queue document `serialize`/`loadDocument` round-trip through (005 · US2 / FR-013).
import type { QueueFileDocument, QueueFileItem } from './useQueueFile'

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

/**
 * Client-derived cost aggregate for the queue (007 · US5 / G-PRICING, FR-018/FR-019).
 * `perItem` maps each row's clientId to its estimate (from `item.text.length` +
 * `item.model`); `totalUsd` sums ONLY estimable amounts (an unavailable item is never
 * counted as $0); `unavailableCount` drives the "+ N unavailable" note. Display-only —
 * derived, never persisted, and never gates Generate.
 */
export interface QueueCost {
  perItem: Map<string, CostEstimate>
  totalUsd: number
  unavailableCount: number
}

/** Fields a single queue row can be edited with (US3); each key is optional. */
export type ItemPatch = Partial<Pick<ListItem, 'text' | 'voiceId' | 'model' | 'format' | 'instructions' | 'metadata'>>

/**
 * Client-side queue filters (005 · US3 / FR-010, data-model §2). Each set field
 * narrows the visible rows; an unset field imposes no constraint. Applied in-memory
 * over the queue alongside the free-text search.
 */
export interface QueueFilters {
  voiceId?: string
  format?: Format
  album?: string
  recordedAt?: string
  language?: string
}

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
  // Free-text search (over item text + uploaded filename) and per-field filters that
  // narrow the visible rows client-side (US3 / FR-009/010).
  const searchTerm = ref('')
  const filters = ref<QueueFilters>({})

  function makeItem(text: string, source: QueueItem['source'], sourceName?: string): QueueItem {
    // A new row inherits only whatever the shared form metadata carries; the recording
    // date is NOT pre-stamped here (007 · US6 / FR-020). It is filled with today's date
    // at generation time via {@link stampRecordingDates}, only when still empty — which
    // resolves the 005 clobber where applyMetadataToPending overwrote an add-time default.
    const itemMetadata = cloneMetadata(metadata.value)
    return {
      clientId: newClientId(),
      text,
      voiceId: voiceId.value,
      model: model.value,
      format: format.value,
      metadata: itemMetadata,
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
   * Apply the current form-level metadata to every not-yet-generated row in the
   * batch that hasn't been edited individually. Called right before generation so
   * the metadata shown on the form reaches the batch — including rows added before
   * it was filled (single shared editor). A row with its own per-row metadata edit
   * is left untouched so its values survive generation. The batch defaults to the
   * whole queue, but the caller passes the actual generate target (checked-else-all)
   * so rows that are NOT being generated are never silently overwritten (FR-005a).
   */
  function applyMetadataToPending(target: QueueItem[] = items.value): void {
    for (const item of target) {
      if (item.status !== 'done' && !item.metadataEdited) item.metadata = cloneMetadata(metadata.value)
    }
  }

  /**
   * Stamp today's date (local-day `YYYY-MM-DD`) as the recording date on every target
   * row that still has none, right before generation (007 · US6 / FR-020). A user-set
   * `recordedAt` (any non-empty value) is never overwritten. Runs AFTER
   * {@link applyMetadataToPending} so it also covers rows that just took the shared
   * form's (date-less) metadata. Resolves the 005 clobber: makeItem no longer pre-stamps
   * a date, so the value the user sees on saved recordings is the day they generated.
   */
  function stampRecordingDates(target: QueueItem[] = items.value): void {
    const today = todayIso()
    for (const item of target) {
      const current = item.metadata?.recordedAt
      if (current === undefined || current === '') {
        const next = cloneMetadata(item.metadata)
        next.recordedAt = today
        item.metadata = next
      }
    }
  }

  // The rows currently shown by the list pane: the queue narrowed by the free-text
  // search and the per-field filters (US3 / FR-009/010), order preserved. A simple
  // O(n) scan per change — adequate well past the ≥200-row target (SC-003) without
  // virtualization. `generateTarget` and the prev/next navigation derive from it so
  // they always track what the user can see.
  const visibleItems = computed(() => {
    const term = searchTerm.value.trim().toLowerCase()
    const f = filters.value
    return items.value.filter((item) => {
      if (term && !`${item.text} ${item.sourceName ?? ''}`.toLowerCase().includes(term)) return false
      if (f.voiceId && item.voiceId !== f.voiceId) return false
      if (f.format && item.format !== f.format) return false
      if (f.album && (item.metadata?.album ?? '') !== f.album) return false
      if (f.recordedAt && (item.metadata?.recordedAt ?? '') !== f.recordedAt) return false
      if (f.language && !(item.metadata?.languages ?? []).includes(f.language)) return false
      return true
    })
  })

  /**
   * What a Generate run processes (FR-005a): the checked rows if any are checked,
   * otherwise the ENTIRE queue. Derived from `items`, not `visibleItems`: search and
   * filters are a view-only concern (US3) and must never change what gets generated —
   * a checked row hidden by a filter is still processed, and with nothing checked the
   * whole queue runs regardless of any active filter. (Only metadata stamping and the
   * prev/next navigation track the visible set.) A fresh array so removing rows on
   * success (US2) can't disturb the in-flight iteration.
   */
  const generateTarget = computed(() =>
    checkedIds.value.size > 0
      ? items.value.filter((i) => checkedIds.value.has(i.clientId))
      : [...items.value],
  )

  // Per-item + total cost estimate over the whole queue (US5 / FR-018/FR-019). Each row
  // is priced by its own model against its character count; unavailable (token-priced)
  // rows are counted separately and excluded from the total, never treated as $0.
  const queueCost = computed<QueueCost>(() => {
    const perItem = new Map<string, CostEstimate>()
    let totalUsd = 0
    let unavailableCount = 0
    for (const item of items.value) {
      const estimate = estimateItemCost(item.model, item.text.length)
      perItem.set(item.clientId, estimate)
      if (estimate === 'unavailable') unavailableCount++
      else totalUsd += estimate.amountUsd
    }
    return { perItem, totalUsd, unavailableCount }
  })

  // Active-selection navigation for the toolbar prev/next (FR-005), over the
  // visible rows; disabled at the boundaries.
  const activeIndex = computed(() => visibleItems.value.findIndex((i) => i.clientId === activeId.value))
  const hasPrev = computed(() => activeIndex.value > 0)
  const hasNext = computed(
    () => activeIndex.value >= 0 && activeIndex.value < visibleItems.value.length - 1,
  )
  function selectPrev(): void {
    if (hasPrev.value) activeId.value = visibleItems.value[activeIndex.value - 1]!.clientId
  }
  function selectNext(): void {
    if (hasNext.value) activeId.value = visibleItems.value[activeIndex.value + 1]!.clientId
  }

  /** Snapshot the queue as a versioned saved-queue document (regeneratable inputs only). */
  function serialize(): QueueFileDocument {
    return {
      schema: 'echorecall.queue',
      version: 1,
      items: items.value.map((item) => {
        const fileItem: QueueFileItem = {
          text: item.text,
          voiceId: item.voiceId,
          model: item.model,
          format: item.format,
          metadata: cloneMetadata(item.metadata),
          source: item.source,
        }
        if (item.instructions !== undefined) fileItem.instructions = item.instructions
        if (item.source === 'upload' && item.sourceName !== undefined) {
          fileItem.sourceName = item.sourceName
        }
        return fileItem
      }),
    }
  }

  /** Replace the queue with the rows from an imported document (fresh ids/state). */
  function loadDocument(doc: QueueFileDocument): void {
    items.value = doc.items.map((fileItem) => ({
      clientId: newClientId(),
      text: fileItem.text,
      voiceId: fileItem.voiceId,
      model: fileItem.model,
      format: fileItem.format,
      metadata: cloneMetadata(fileItem.metadata),
      status: 'queued',
      source: fileItem.source,
      ...(fileItem.instructions !== undefined ? { instructions: fileItem.instructions } : {}),
      ...(fileItem.sourceName !== undefined ? { sourceName: fileItem.sourceName } : {}),
    }))
    checkedIds.value = new Set()
    activeId.value = null
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
    searchTerm,
    filters,
    visibleItems,
    generateTarget,
    queueCost,
    activeIndex,
    hasPrev,
    hasNext,
    selectPrev,
    selectNext,
    serialize,
    loadDocument,
    addItem,
    addItems,
    addFromUpload,
    removeItem,
    removeMany,
    toggleChecked,
    toggleAll,
    updateItem,
    applyMetadataToPending,
    stampRecordingDates,
    setDefaults,
    clear,
  }
}

/** Deep copy of a Metadata value (JSON-safe: plain strings/arrays only). */
function cloneMetadata(metadata: Metadata): Metadata {
  return JSON.parse(JSON.stringify(metadata)) as Metadata
}

/**
 * A unique client id for a queue row. Prefers `crypto.randomUUID`, but falls back
 * to a v4-shaped id when it is unavailable — `crypto.randomUUID` requires a secure
 * context, so a self-hosted deployment reached over plain HTTP on a LAN address
 * (not `localhost`) would otherwise crash on add/import. These ids are ephemeral,
 * client-only keys, so the non-cryptographic fallback is acceptable.
 */
function newClientId(): string {
  const cryptoObj = globalThis.crypto
  if (typeof cryptoObj?.randomUUID === 'function') return cryptoObj.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16)
    const value = char === 'x' ? rand : (rand % 4) + 8
    return value.toString(16)
  })
}

/** Today as a local-day `YYYY-MM-DD` string (the generation-time recording date, FR-020). */
function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
