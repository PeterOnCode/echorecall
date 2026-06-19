import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LibraryService } from '../../src/core/library/library-service'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import { FileAudioStore } from '../../src/core/library/audio-store'
import { toGenerationDto } from '../../server/utils/serialize'

// Integration coverage for GET /api/generations: the pipeline the route runs
// (libraryService.list()) over a real file-backed SQLite + the real filesystem
// audio store. Asserts the newest-first contract (FR-012) and that the library
// survives a fresh repository over the same DB file — the "survives restart"
// guarantee (FR-011, SC-002). The route's thin `{ generations }` envelope and
// per-entry `audioUrl` mapping are set by the h3 handler and, like the
// content-type in audio-get, are out of scope for this plain-Node suite.

let dir: string
let dbPath: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'echorecall-get-'))
  dbPath = join(dir, 'echorecall.db')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

// A clock that hands out strictly-increasing timestamps so newest-first
// ordering is deterministic regardless of wall-clock resolution.
function steppingClock(startMs = Date.parse('2026-06-15T10:00:00.000Z')) {
  let t = startMs - 1000
  return () => new Date((t += 1000))
}

function makeService(clock = steppingClock()): LibraryService {
  const repo = new SqliteGenerationRepository(dbPath)
  const audio = new FileAudioStore(dir)
  return new LibraryService(repo, audio, clock)
}

describe('GET /api/generations', () => {
  it('returns an empty result (no rows, total 0) when nothing has been generated', () => {
    expect(makeService().list()).toEqual({ rows: [], total: 0 })
  })

  it('lists saved generations newest-first', async () => {
    const service = makeService()
    const first = await service.save({ text: 'one', voiceId: 'alloy' }, Buffer.from('a'))
    const second = await service.save({ text: 'two', voiceId: 'echo' }, Buffer.from('b'))
    const third = await service.save({ text: 'three', voiceId: 'nova' }, Buffer.from('c'))

    const { rows, total } = service.list()
    expect(rows.map((g) => g.id)).toEqual([third.id, second.id, first.id])
    expect(total).toBe(3)
  })

  it('serializes each entry to the REST shape: filename (basename) + audioUrl, never the raw path', async () => {
    // The route maps service.list().rows through toGenerationDto; the client
    // (library editor, US5) reads `filename`, so the response must carry it and
    // keep the authoritative `path` server-side.
    const service = makeService()
    const entry = await service.save(
      { text: 'hi', voiceId: 'alloy', format: 'mp3', metadata: { title: 'My Clip' } },
      Buffer.from('a'),
    )

    const dto = service.list().rows.map((g) => toGenerationDto(g))[0]!

    expect(dto.filename).toBe('my-clip.mp3')
    expect(dto.audioUrl).toBe(`/api/generations/${entry.id}/audio`)
    expect((dto as Record<string, unknown>).path).toBeUndefined()
  })

  it('persists the list across a fresh repository over the same DB (survives restart)', async () => {
    const writer = makeService()
    const a = await writer.save({ text: 'one', voiceId: 'alloy' }, Buffer.from('a'))
    const b = await writer.save({ text: 'two', voiceId: 'echo' }, Buffer.from('b'))

    // A brand-new service/repository over the same files — simulates a restart.
    const reopened = makeService()
    const { rows } = reopened.list()

    expect(rows.map((g) => g.id)).toEqual([b.id, a.id])
    expect(rows[0]).toMatchObject({ text: 'two', voiceId: 'echo' })
  })
})

describe('GET /api/generations — composable query (US6)', () => {
  // Build three rows distinct across every queryable dimension. The stepping
  // clock keeps insertion order deterministic (first → oldest, third → newest).
  async function seed() {
    const service = makeService()
    const first = await service.save(
      { text: 'apple pie', voiceId: 'alloy', format: 'mp3', metadata: { title: 'Apple' } },
      Buffer.from('a'),
    )
    const second = await service.save(
      { text: 'banana bread', voiceId: 'echo', format: 'wav', metadata: { title: 'Banana' } },
      Buffer.from('b'),
    )
    const third = await service.save(
      { text: 'cherry cake', voiceId: 'alloy', format: 'flac', metadata: { title: 'Cherry' } },
      Buffer.from('c'),
    )
    return { service, first, second, third }
  }

  it('matches free text over the whole stack', async () => {
    const { service, second } = await seed()
    const { rows, total } = service.list({ q: 'banana' })
    expect(rows.map((g) => g.id)).toEqual([second.id])
    expect(total).toBe(1)
  })

  it('filters by voiceId, newest-first', async () => {
    const { service, first, third } = await seed()
    expect(service.list({ voiceId: 'alloy' }).rows.map((g) => g.id)).toEqual([third.id, first.id])
  })

  it('sorts by title ascending', async () => {
    const { service } = await seed()
    expect(service.list({ sort: 'title', order: 'asc' }).rows.map((g) => g.metadata.title)).toEqual(
      ['Apple', 'Banana', 'Cherry'],
    )
  })

  it('paginates while reporting the full total', async () => {
    const { service } = await seed()
    const page1 = service.list({ pageSize: 2, page: 1 })
    expect(page1.rows).toHaveLength(2)
    expect(page1.total).toBe(3)
    const page2 = service.list({ pageSize: 2, page: 2 })
    expect(page2.rows).toHaveLength(1)
    expect(page2.total).toBe(3)
  })

  it('returns an empty array and total 0 when the query matches nothing', async () => {
    const { service } = await seed()
    expect(service.list({ q: 'zzz-no-match' })).toEqual({ rows: [], total: 0 })
  })
})
