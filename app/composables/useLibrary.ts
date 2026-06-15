import type { Generation } from '#core/client'

/** A library entry as served by GET /api/generations — metadata + a replay URL. */
export interface LibraryItem extends Generation {
  audioUrl: string
}

/**
 * Fetches the persisted library (newest-first, server-ordered) so it can be
 * browsed and replayed. Replaying an item is pure playback of its stored audio
 * (handled in the list UI via `audioUrl`), so this composable only needs to
 * load the list and expose its loading/error state.
 */
export function useLibrary() {
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
      error.value = 'Could not load your library. Please try again.'
    } finally {
      loading.value = false
    }
  }

  return { items, loading, error, load }
}
