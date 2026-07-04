import type { AudioProperties, BulkCleanFilter, Generation, LibraryQuery, Metadata } from '#core/client'

/**
 * A library entry as served by the REST API: the authoritative `path` stays
 * server-side and is surfaced as `filename` (basename) plus a replay/download
 * `audioUrl`. `skippedTags` is present after a retag when the format dropped
 * fields (FR-021). `audioProperties` (006 · R-AUDIOPROPS) is read-only, computed
 * server-side on read for the status bar + Duration/Bitrate columns.
 */
export interface LibraryItem extends Omit<Generation, 'path'> {
  filename: string
  audioUrl: string
  skippedTags?: string[]
  audioProperties?: AudioProperties
}

/** Pull the stable domain error code out of an `$fetch` failure, if any. */
function errorCode(err: unknown): string | undefined {
  const data = (err as { data?: { error?: { code?: string } } })?.data
  return data?.error?.code
}

/** Drop empty/undefined keys so the request URL only carries active filters. */
function toParams(query: LibraryQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {}
  if (query.q) params.q = query.q
  if (query.voiceId) params.voiceId = query.voiceId
  if (query.format) params.format = query.format
  if (query.from) params.from = query.from
  if (query.to) params.to = query.to
  if (query.sort) params.sort = query.sort
  if (query.order) params.order = query.order
  if (query.page) params.page = query.page
  if (query.pageSize) params.pageSize = query.pageSize
  // 006 · R-FILTER — additive, read-only filters.
  if (query.genre) params.genre = query.genre
  if (query.language) params.language = query.language
  if (query.recordedFrom) params.recordedFrom = query.recordedFrom
  if (query.recordedTo) params.recordedTo = query.recordedTo
  return params
}

/**
 * Loads and manages the persisted library with a composable server-side query
 * (US6 / FR-034–037): search / filter / sort / pagination drive `load`, which
 * keeps `items`, `total`, and the effective `page`/`pageSize` in sync. Also:
 * rename a stored file, replace an item's metadata (retag), permanently delete
 * an entry, and bulk-clean by date/voice. Rename/retag patch the local list in
 * place; delete and bulk-clean reload so `total` and pagination stay correct.
 * Replay is pure playback via each item's `audioUrl` (no provider call).
 */
export function useLibrary() {
  const { t } = useI18n()
  const items = ref<LibraryItem[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // The single source of truth for search/filter/sort/page; the page binds it to
  // LibraryFileTable (v-model:query) and reloads whenever it changes. The default
  // pageSize matches the server's so the first load needs no write-back.
  const query = ref<LibraryQuery>({ sort: 'createdAt', order: 'desc', page: 1, pageSize: 20 })

  async function load() {
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<{
        generations: LibraryItem[]
        total: number
        page: number
        pageSize: number
      }>('/api/generations', { query: toParams(query.value) })
      items.value = res.generations
      total.value = res.total
      // If we asked for a page past the end (e.g. after deleting the last item
      // on the last page, where the server echoes the now-out-of-range page and
      // returns no rows), clamp to the last valid page. Reassigning `query`
      // triggers the page's watcher → one reload at the corrected page, so the
      // user is never stranded on an empty page with the pager hidden.
      const lastPage = Math.max(1, Math.ceil(res.total / res.pageSize))
      if (res.page > lastPage) {
        query.value = { ...query.value, page: lastPage }
      }
    } catch {
      error.value = t('library.loadError')
    } finally {
      loading.value = false
    }
  }

  /** Replace one item in the local list by id (no-op if it is no longer present). */
  function patchLocal(updated: LibraryItem) {
    items.value = items.value.map((item) => (item.id === updated.id ? updated : item))
  }

  /**
   * Rename a stored file and/or replace its embedded metadata in a single PATCH
   * (FR-030/031). Sending both in one request keeps the edit atomic — the editor
   * never lands in a partial-success state where one half saved and the other
   * failed. The server re-slugs the name (keeping the extension), retags the
   * stored file, and reports the final filename; the local list is patched on
   * success. An empty/un-sluggable name or a tagging failure yields a specific
   * message and leaves the item unchanged. Clears any prior error up front so a
   * corrected retry can succeed.
   */
  async function update(
    id: string,
    patch: { filename?: string; metadata?: Metadata },
  ): Promise<LibraryItem | undefined> {
    error.value = null
    try {
      const updated = await $fetch<LibraryItem>(`/api/generations/${id}`, {
        method: 'PATCH',
        body: patch,
      })
      patchLocal(updated)
      return updated
    } catch (err) {
      const code = errorCode(err)
      if (code === 'INVALID_FILENAME') error.value = t('library.errors.invalidFilename')
      else if (code === 'TAGGING_FAILED') error.value = t('library.errors.retag')
      // A generic failure is reported against whichever change was attempted.
      else error.value = patch.filename !== undefined ? t('library.errors.rename') : t('library.errors.retag')
    }
  }

  /**
   * Permanently delete an entry (FR-032) and reload so `total` and pagination
   * stay correct. The caller is responsible for confirming the action first.
   */
  async function remove(id: string) {
    error.value = null
    try {
      await $fetch(`/api/generations/${id}`, { method: 'DELETE' })
      await load()
    } catch {
      error.value = t('library.errors.delete')
    }
  }

  /**
   * Bulk-clean the library by date and/or voice (FR-037): remove every matching
   * item and its audio, then reload. Returns how many were removed (undefined on
   * failure). The caller confirms first. An empty filter is rejected server-side.
   */
  async function bulkClean(filter: BulkCleanFilter): Promise<number | undefined> {
    error.value = null
    try {
      const res = await $fetch<{ deleted: number }>('/api/library/bulk-clean', {
        method: 'POST',
        body: filter,
      })
      await load()
      return res.deleted
    } catch {
      error.value = t('library.errors.bulkClean')
    }
  }

  /**
   * 006 · R-BULK — delete the ids one by one, isolating per-id failures (one bad
   * delete must not abandon the rest), then reload ONCE (not per item) so `total`
   * and pagination stay correct. Returns the per-id outcome so the caller can keep
   * failed ids selected for retry; any failure also surfaces the delete error.
   * The caller confirms first; the items watcher clears a dropped active selection.
   */
  async function removeMany(ids: string[]): Promise<{ succeeded: string[]; failed: string[] }> {
    error.value = null
    const succeeded: string[] = []
    const failed: string[] = []
    for (const id of ids) {
      try {
        await $fetch(`/api/generations/${id}`, { method: 'DELETE' })
        succeeded.push(id)
      } catch {
        failed.push(id)
      }
    }
    // After the reload (load() clears `error` as it starts), surface any failure.
    await load()
    if (failed.length > 0) error.value = t('library.errors.delete')
    return { succeeded, failed }
  }

  /**
   * 006 · R-BULK — overwrite one editable tag field across the selection, reusing the
   * existing per-item retag (`update`). Runs SEQUENTIALLY (keeps the single-writer
   * behaviour + deterministic reporting), merging the field over each row's current
   * metadata so other tags are preserved. Returns succeeded count + the ids that
   * failed (surface them, leave the rest applied).
   *
   * The retag is a WHOLESALE metadata replace, so it must carry the row's CURRENT
   * tags. `selectedIds` persists across pages, so a selected row may not be on the
   * loaded page — its current tags are then fetched by id. If they can't be read, the
   * row is reported failed and skipped rather than overwritten with a partial set
   * (which would silently wipe its other tags — a real data-loss bug).
   */
  async function bulkRetag(
    ids: string[],
    field: keyof Metadata,
    value: unknown,
  ): Promise<{ succeeded: number; failed: string[] }> {
    let succeeded = 0
    const failed: string[] = []
    const clearing = value === '' || value === null || value === undefined
    for (const id of ids) {
      const loaded = items.value.find((i) => i.id === id)
      let current: Metadata
      if (loaded) {
        current = loaded.metadata ?? {}
      } else {
        try {
          current = (await $fetch<LibraryItem>(`/api/generations/${id}`)).metadata ?? {}
        } catch {
          failed.push(id)
          continue
        }
      }
      // Clearing omits the key; otherwise overwrite it (other tags preserved).
      const metadata: Metadata = clearing
        ? (Object.fromEntries(Object.entries(current).filter(([k]) => k !== field)) as Metadata)
        : { ...current, [field]: value }
      const result = await update(id, { metadata })
      if (result) succeeded++
      else failed.push(id)
    }
    return { succeeded, failed }
  }

  // --- 006 · R-NAV — cross-page Previous/Next over the filtered result set. Within
  // the loaded page they move by index; at a page boundary they load the adjacent
  // page and select its first (Next) / last (Prev) row. Disabled only at the GLOBAL
  // first/last, derived from total + page + pageSize. ---
  function effectivePage(): number {
    return query.value.page && query.value.page > 0 ? query.value.page : 1
  }
  function effectivePageSize(): number {
    return query.value.pageSize && query.value.pageSize > 0 ? query.value.pageSize : 20
  }
  function globalIndex(id: string | null): number {
    if (!id) return -1
    const within = items.value.findIndex((i) => i.id === id)
    return within < 0 ? -1 : (effectivePage() - 1) * effectivePageSize() + within
  }

  /** Whether a globally-previous recording exists (false at the very first row). */
  function hasPrev(id: string | null): boolean {
    return globalIndex(id) > 0
  }
  /** Whether a globally-next recording exists (false at the very last row). */
  function hasNext(id: string | null): boolean {
    const g = globalIndex(id)
    return g >= 0 && g < total.value - 1
  }

  /** Resolve the next active id, loading the next page at a boundary. */
  async function gotoNext(id: string | null): Promise<string | null> {
    const within = items.value.findIndex((i) => i.id === id)
    if (within < 0) return id
    if (within < items.value.length - 1) return items.value[within + 1]!.id
    if (!hasNext(id)) return id
    query.value = { ...query.value, page: effectivePage() + 1 }
    await load()
    return items.value[0]?.id ?? id
  }

  /** Resolve the previous active id, loading the previous page at a boundary. */
  async function gotoPrev(id: string | null): Promise<string | null> {
    const within = items.value.findIndex((i) => i.id === id)
    if (within < 0) return id
    if (within > 0) return items.value[within - 1]!.id
    if (!hasPrev(id)) return id
    query.value = { ...query.value, page: effectivePage() - 1 }
    await load()
    return items.value[items.value.length - 1]?.id ?? id
  }

  return {
    items,
    total,
    loading,
    error,
    query,
    load,
    update,
    remove,
    bulkClean,
    removeMany,
    bulkRetag,
    hasPrev,
    hasNext,
    gotoNext,
    gotoPrev,
  }
}
