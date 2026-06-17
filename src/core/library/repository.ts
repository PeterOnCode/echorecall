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
  /** @returns true if a row was removed. */
  delete(id: string): boolean
}
