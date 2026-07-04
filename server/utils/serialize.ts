import type { AudioProperties, Generation } from '#core'

/**
 * REST shape of a generation: the stored `path` is replaced by the derived
 * `filename` (basename) and `audioUrl` the client uses for replay/download. The
 * authoritative `path` stays server-side (data-model.md). `audioProperties`
 * (006 · R-AUDIOPROPS) is read-only and present only when readable.
 */
export interface GenerationDto extends Omit<Generation, 'path'> {
  filename: string
  audioUrl: string
  skippedTags?: string[]
  audioProperties?: AudioProperties
}

export function toGenerationDto(
  generation: Generation,
  skippedTags?: string[],
  audioProperties?: AudioProperties,
): GenerationDto {
  const { path, ...rest } = generation
  return {
    ...rest,
    filename: path.split('/').pop() ?? path,
    audioUrl: `/api/generations/${generation.id}/audio`,
    ...(skippedTags && skippedTags.length > 0 ? { skippedTags } : {}),
    ...(audioProperties && Object.keys(audioProperties).length > 0 ? { audioProperties } : {}),
  }
}
