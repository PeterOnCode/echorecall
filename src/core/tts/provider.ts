import type { Voice } from '../shared/types'

/** Read-only catalog of selectable voices (OpenAI TTS voices). */
export const VOICES: readonly Voice[] = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'echo', label: 'Echo' },
  { id: 'fable', label: 'Fable' },
  { id: 'onyx', label: 'Onyx' },
  { id: 'nova', label: 'Nova' },
  { id: 'shimmer', label: 'Shimmer' },
] as const

export function isKnownVoice(voiceId: string): boolean {
  return VOICES.some((v) => v.id === voiceId)
}

/** Port: anything that can turn text into MP3 audio bytes. */
export interface TtsProvider {
  /**
   * Synthesize speech for the given text and voice.
   * @returns MP3 audio bytes.
   * @throws on provider/network failure (mapped to ProviderUnavailableError upstream).
   */
  synthesize(input: { text: string; voiceId: string }): Promise<Buffer>
}
