import type { Voice } from '#core/client'
import type { QueueItem } from './useQueue'

function extractApiError(e: unknown): string {
  const data = (e as { data?: { error?: { message?: string } } })?.data
  return data?.error?.message ?? 'Something went wrong. Please try again.'
}

/**
 * Drives batch generation: one request per queue row with per-item progress and
 * isolated failures (a failing item never aborts the rest, FR-006/007), then a
 * single `.zip` download of the successful items (FR-008).
 */
export function useGeneration() {
  const voices = ref<Voice[]>([])
  const generating = ref(false)

  async function loadVoices() {
    const res = await $fetch<{ voices: Voice[] }>('/api/voices')
    voices.value = res.voices
  }

  async function generateItem(item: QueueItem, speed: number) {
    item.status = 'generating'
    item.error = undefined
    try {
      const entry = await $fetch<{ id: string; audioUrl?: string }>('/api/generations', {
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
      })
      item.status = 'done'
      item.result = {
        id: entry.id,
        audioUrl: entry.audioUrl ?? `/api/generations/${entry.id}/audio`,
      }
    } catch (e) {
      item.status = 'failed'
      item.error = extractApiError(e)
    }
  }

  /** Generate every not-yet-done item in order, isolating per-item failures. */
  async function generateAll(items: QueueItem[], speed: number) {
    generating.value = true
    try {
      for (const item of items) {
        if (item.status !== 'done') await generateItem(item, speed)
      }
    } finally {
      generating.value = false
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

  return { voices, generating, loadVoices, generateItem, generateAll, downloadArchive }
}
