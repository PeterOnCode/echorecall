import type {
  BulkCleanFilter,
  Format,
  Generation,
  LibraryQuery,
  Metadata,
  Model,
} from '../shared/types'

// Client-safe type lives in shared/types so the UI can use it too; re-exported
// here for server consumers that import everything library-related from one place.
export type { BulkCleanFilter } from '../shared/types'

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

/** A page of library rows plus the unpaginated match count (FR-036). */
export interface LibraryListResult {
  rows: Generation[]
  /** Total rows matching the query, ignoring pagination. */
  total: number
}

/** Default page size when a query omits `pageSize` (FR-036). */
export const DEFAULT_PAGE_SIZE = 20

/** Port: persistence for generation metadata. */
export interface GenerationRepository {
  insert(record: NewGenerationRecord): void
  /**
   * Composable server-side query (FR-034–036): free-text search, voice/format
   * filter, an inclusive `createdAt` range, an allow-listed sort in either
   * direction, and LIMIT/OFFSET pagination. Returns the requested page plus the
   * full (unpaginated) `total`. An empty query lists everything newest-first.
   */
  list(query?: LibraryQuery): LibraryListResult
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
  /**
   * Delete every row matching the filter and return the removed rows so the
   * caller can delete their stored audio files (FR-037). Returns `[]` when
   * nothing matches.
   */
  bulkDelete(filter: BulkCleanFilter): Generation[]
}
