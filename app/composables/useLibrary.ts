import type { Generation, Metadata } from '#core/client'

/**
 * A library entry as served by the REST API: the authoritative `path` stays
 * server-side and is surfaced as `filename` (basename) plus a replay/download
 * `audioUrl`. `skippedTags` is present after a retag when the format dropped
 * fields (FR-021).
 */
export interface LibraryItem extends Omit<Generation, 'path'> {
  filename: string
  audioUrl: string
  skippedTags?: string[]
}

/** Pull the stable domain error code out of an `$fetch` failure, if any. */
function errorCode(err: unknown): string | undefined {
  const data = (err as { data?: { error?: { code?: string } } })?.data
  return data?.error?.code
}

/**
 * Loads and manages the persisted library: list (newest-first, server-ordered),
 * rename a stored file, replace an item's metadata (retag), and permanently
 * delete an entry. Mutations patch the local list in place so the view updates
 * without a full reload; the caller confirms a delete first. Replay is pure
 * playback via each item's `audioUrl` (no provider call).
 */
export function useLibrary() {
  const { t } = useI18n()
  const items = ref<LibraryItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<{ generations: LibraryItem[] }>('/api/generations')
      items.value = res.generations
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
   * Rename a stored file (FR-031). The server re-slugs the name, keeps the
   * extension, and reports the final filename; an empty/un-sluggable name yields
   * a specific message and leaves the item unchanged.
   */
  async function rename(id: string, filename: string): Promise<LibraryItem | undefined> {
    error.value = null
    try {
      const updated = await $fetch<LibraryItem>(`/api/generations/${id}`, {
        method: 'PATCH',
        body: { filename },
      })
      patchLocal(updated)
      return updated
    } catch (err) {
      error.value =
        errorCode(err) === 'INVALID_FILENAME'
          ? t('library.errors.invalidFilename')
          : t('library.errors.rename')
    }
  }

  /** Replace an item's embedded metadata (FR-030): retags the stored file + persists. */
  async function updateMetadata(id: string, metadata: Metadata): Promise<LibraryItem | undefined> {
    error.value = null
    try {
      const updated = await $fetch<LibraryItem>(`/api/generations/${id}`, {
        method: 'PATCH',
        body: { metadata },
      })
      patchLocal(updated)
      return updated
    } catch {
      error.value = t('library.errors.retag')
    }
  }

  /**
   * Permanently delete an entry (FR-032) and drop it from the local list on
   * success. The caller is responsible for confirming the action first.
   */
  async function remove(id: string) {
    error.value = null
    try {
      await $fetch(`/api/generations/${id}`, { method: 'DELETE' })
      items.value = items.value.filter((item) => item.id !== id)
    } catch {
      error.value = t('library.errors.delete')
    }
  }

  return { items, loading, error, load, rename, updateMetadata, remove }
}
