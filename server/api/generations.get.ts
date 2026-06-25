import { DEFAULT_PAGE_SIZE, type Format, type LibraryQuery } from '#core'
import { getLibraryService } from '../utils/container'
import { respondError } from '../utils/errors'
import { toGenerationDto } from '../utils/serialize'

// List saved generations with a composable server-side query (FR-034–036):
// free-text search, voice/format filter, an inclusive created_at range, an
// allow-listed sort in either direction, and pagination. Each row is serialized
// to the REST shape (the authoritative `path` stays server-side, surfaced as
// `filename` + `audioUrl`); the response carries the unpaginated `total` plus the
// effective `page`/`pageSize` so the client can render pagination. The stored
// file is served by GET /api/generations/[id]/audio with no provider call.

const SORTS = [
  'createdAt',
  'title',
  'voice',
  'format',
  // 006 · R-FILTER — additive sort keys over already-existing columns.
  'filename',
  'artist',
  'album',
  'recordedAt',
  'track',
  'genre',
  'comment',
] as const
const ORDERS = ['asc', 'desc'] as const

/** First non-empty string value of a query param, else undefined. */
function str(value: unknown): string | undefined {
  const v = Array.isArray(value) ? value[0] : value
  if (typeof v !== 'string') return undefined
  const trimmed = v.trim()
  return trimmed === '' ? undefined : trimmed
}

/** Positive integer value of a query param, else undefined. */
function posInt(value: unknown): number | undefined {
  const s = str(value)
  if (s === undefined) return undefined
  const n = Number.parseInt(s, 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export default defineEventHandler(async (event) => {
  try {
    const raw = getQuery(event)
    const sort = str(raw.sort)
    const order = str(raw.order)

    const query: LibraryQuery = {
      q: str(raw.q),
      voiceId: str(raw.voiceId),
      // Equality filter; an unknown format simply matches nothing.
      format: str(raw.format) as Format | undefined,
      from: str(raw.from),
      to: str(raw.to),
      // Ignore anything outside the allow-list so the repo falls back to its
      // defaults (createdAt / desc) rather than trusting client input.
      sort: sort && (SORTS as readonly string[]).includes(sort) ? (sort as LibraryQuery['sort']) : undefined,
      order: order && (ORDERS as readonly string[]).includes(order) ? (order as LibraryQuery['order']) : undefined,
      page: posInt(raw.page),
      pageSize: posInt(raw.pageSize),
      // 006 · R-FILTER — additive, read-only filters over already-existing columns.
      genre: str(raw.genre),
      language: str(raw.language),
      recordedFrom: str(raw.recordedFrom),
      recordedTo: str(raw.recordedTo),
    }

    // Echo the effective paging back so the client doesn't re-derive the defaults.
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE

    const service = await getLibraryService()
    const { rows, total } = service.list({ ...query, page, pageSize })
    // 006 · R-AUDIOPROPS — attach read-only audio properties per row (decoded on
    // read; failures yield empty props and never break listing).
    const generations = await Promise.all(
      rows.map(async (entry) => toGenerationDto(entry, undefined, await service.audioPropertiesFor(entry))),
    )
    return { generations, total, page, pageSize }
  } catch (err) {
    return respondError(event, err)
  }
})
