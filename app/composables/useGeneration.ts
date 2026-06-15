import type { Generation, Voice } from '#core/client'

export interface GenerationResult extends Generation {
  audioUrl: string
}

type Status = 'idle' | 'submitting' | 'success' | 'error'

function extractApiError(e: unknown): string {
  const data = (e as { data?: { error?: { message?: string } } })?.data
  return data?.error?.message ?? 'Something went wrong. Please try again.'
}

export function useGeneration() {
  const voices = ref<Voice[]>([])
  const status = ref<Status>('idle')
  const error = ref<string | null>(null)
  const result = ref<GenerationResult | null>(null)

  async function loadVoices() {
    const res = await $fetch<{ voices: Voice[] }>('/api/voices')
    voices.value = res.voices
  }

  async function generate(text: string, voiceId: string) {
    status.value = 'submitting'
    error.value = null
    try {
      const entry = await $fetch<GenerationResult>('/api/generations', {
        method: 'POST',
        body: { text, voiceId },
      })
      result.value = entry
      status.value = 'success'
      return entry
    } catch (e) {
      status.value = 'error'
      error.value = extractApiError(e)
      throw e
    }
  }

  return { voices, status, error, result, loadVoices, generate }
}
