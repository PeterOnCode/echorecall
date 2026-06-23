import type { Voice } from '#core/client'
import type { QueueItem } from './useQueue'

function extractApiError(e: unknown): string {
  const data = (e as { data?: { error?: { message?: string } } })?.data
  return data?.error?.message ?? 'Something went wrong. Please try again.'
}

/**
 * Drives batch generation: one request per queue row with per-item progress and
 * isolated failures (a failing item never aborts the rest, FR-006/007). On the
 * 005 redesign each successfully generated row is removed from the queue while
 * failures remain for retry (FR-005b); the run's successful generation ids are
 * kept in {@link useGeneration.lastBatchIds} so the page can still offer a single
 * `.zip` download of that batch after the rows have left the queue (FR-022).
 */
export function useGeneration() {
  const voices = ref<Voice[]>([])
  const generating = ref(false)
  // Saved generation ids of the most recent run's successes — drives the post-run
  // "download this batch" affordance. Reset at the start of every run, so a run
  // with zero successes offers no download (FR-022).
  const lastBatchIds = ref<string[]>([])

  async function loadVoices() {
    const res = await $fetch<{ voices: Voice[] }>('/api/voices')
    voices.value = res.voices
  }

  async function generateItem(item: QueueItem, speed: number) {
    item.status = 'generating'
    item.error = undefined
    item.result = undefined // clear any stale result so it signals only this run's success
    try {
      const entry = await $fetch<{ id: string; audioUrl?: string; skippedTags?: string[] }>(
        '/api/generations',
        {
          method: 'POST',
          body: {
            text: item.text,
            voiceId: item.voiceId,
            model: item.model,
            format: item.format,
            speed,
            instructions: item.instructions,
            metadata: item.metadata,
          },
        },
      )
      item.status = 'done'
      item.result = {
        id: entry.id,
        audioUrl: entry.audioUrl ?? `/api/generations/${entry.id}/audio`,
        skippedTags: entry.skippedTags,
      }
    } catch (e) {
      item.status = 'failed'
      item.error = extractApiError(e)
    }
  }

  /**
   * Generate every not-yet-done item in the target list in order, isolating
   * per-item failures. The target is chosen by the caller (checked-else-all,
   * FR-005a). Each success is recorded in {@link lastBatchIds} and, when a
   * `remove` callback is given, dropped from the queue (FR-005b); failures stay.
   */
  async function generateAll(
    items: QueueItem[],
    speed: number,
    remove?: (clientId: string) => void,
  ) {
    generating.value = true
    const succeeded: string[] = []
    try {
      for (const item of items) {
        if (item.status === 'done') continue
        await generateItem(item, speed)
        // `result` is set only on success (and cleared at the start of each attempt),
        // so it is the reliable per-run success signal — failures leave it undefined.
        if (item.result) {
          succeeded.push(item.result.id)
          remove?.(item.clientId)
        }
      }
    } finally {
      generating.value = false
      lastBatchIds.value = succeeded
    }
  }

  /** Download the given saved items as one `.zip` via the archive endpoint. */
  async function downloadArchive(ids: string[]) {
    if (ids.length === 0) return
    const blob = await $fetch<Blob>('/api/generations/archive', {
      method: 'POST',
      body: { ids },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'echorecall-batch.zip'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return { voices, generating, lastBatchIds, loadVoices, generateItem, generateAll, downloadArchive }
}
