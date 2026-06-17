import type { Generation } from '#core'

/**
 * REST shape of a generation: the stored `path` is replaced by the derived
 * `filename` (basename) and `audioUrl` the client uses for replay/download. The
 * authoritative `path` stays server-side (data-model.md).
 */
export interface GenerationDto extends Omit<Generation, 'path'> {
  filename: string
  audioUrl: string
  skippedTags?: string[]
}

export function toGenerationDto(generation: Generation, skippedTags?: string[]): GenerationDto {
  const { path, ...rest } = generation
  return {
    ...rest,
    filename: path.split('/').pop() ?? path,
    audioUrl: `/api/generations/${generation.id}/audio`,
    ...(skippedTags && skippedTags.length > 0 ? { skippedTags } : {}),
  }
}
