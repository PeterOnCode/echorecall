import type { Format, FormatInfo, Model, Voice } from '../shared/types'

/** Read-only catalog of selectable voices (OpenAI TTS voices), widened in 002. */
export const VOICES: readonly Voice[] = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'ash', label: 'Ash' },
  { id: 'ballad', label: 'Ballad' },
  { id: 'coral', label: 'Coral' },
  { id: 'echo', label: 'Echo' },
  { id: 'fable', label: 'Fable' },
  { id: 'onyx', label: 'Onyx' },
  { id: 'nova', label: 'Nova' },
  { id: 'sage', label: 'Sage' },
  { id: 'shimmer', label: 'Shimmer' },
  { id: 'verse', label: 'Verse' },
  { id: 'marin', label: 'Marin' },
  { id: 'cedar', label: 'Cedar' },
] as const

/** Read-only catalog of TTS models. Instructions apply only to `gpt-4o-mini-tts`. */
export const MODELS: readonly Model[] = ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts'] as const

/** Model that honours the `instructions` parameter. */
export const INSTRUCTIONS_MODEL: Model = 'gpt-4o-mini-tts'

/** Read-only catalog of output formats with extension + tagging capability. */
export const FORMATS: readonly FormatInfo[] = [
  { id: 'mp3', ext: 'mp3', taggable: 'id3' },
  { id: 'wav', ext: 'wav', taggable: 'id3' },
  { id: 'flac', ext: 'flac', taggable: 'vorbis' },
  { id: 'opus', ext: 'opus', taggable: 'vorbis' },
  { id: 'aac', ext: 'aac', taggable: 'none' },
  { id: 'pcm', ext: 'pcm', taggable: 'none' },
] as const

/** Shared maximum size for every supported batch-import file. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export function isKnownVoice(voiceId: string): boolean {
  return VOICES.some((v) => v.id === voiceId)
}

export function isKnownModel(model: string): boolean {
  return (MODELS as readonly string[]).includes(model)
}

export function isKnownFormat(format: string): boolean {
  return FORMATS.some((f) => f.id === format)
}

/** Look up a format's catalog entry, or undefined if unknown. */
export function formatInfo(format: string): FormatInfo | undefined {
  return FORMATS.find((f) => f.id === format)
}

/** Port: anything that can turn text into audio bytes for a given format. */
export interface TtsProvider {
  /**
   * Synthesize speech for the given text and voice. Validation (voice/model/
   * format/length, instructions rule) happens upstream in `generateSpeech`, so a
   * provider receives an already-validated, fully-resolved request.
   *
   * @returns audio bytes in the requested format.
   * @throws on provider/network failure (mapped to ProviderUnavailableError upstream).
   */
  synthesize(input: {
    text: string
    voiceId: string
    model: Model
    format: Format
    speed: number
    /** Applied only for `gpt-4o-mini-tts`. */
    instructions?: string
  }): Promise<Buffer>
}
