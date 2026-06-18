import type { Format, Generation, Metadata, Model } from '../shared/types'

export interface NewGenerationRecord {
  id: string
  text: string
  voiceId: string
  model: Model | null
  format: Format
  speed: number | null
  createdAt: string
  /** Stored audio path relative to the data dir. */
  path: string
  metadata: Metadata
}

/** Port: persistence for generation metadata. */
export interface GenerationRepository {
  insert(record: NewGenerationRecord): void
  /** All generations, newest-first. */
  list(): Generation[]
  get(id: string): Generation | undefined
  /**
   * Update the mutable parts of a row in place (FR-030/031): the stored `path`
   * (after a rename) and/or the embedded {@link Metadata} set (replaced whole, so
   * cleared fields are removed). Other fields are immutable. Only the keys present
   * on `patch` are written.
   * @returns true if the row exists (and was updated).
   */
  update(id: string, patch: { path?: string; metadata?: Metadata }): boolean
  /** @returns true if a row was removed. */
  delete(id: string): boolean
}
