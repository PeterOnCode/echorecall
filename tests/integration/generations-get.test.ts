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
  it('returns an empty list when nothing has been generated', () => {
    expect(makeService().list()).toEqual([])
  })

  it('lists saved generations newest-first', async () => {
    const service = makeService()
    const first = await service.save({ text: 'one', voiceId: 'alloy' }, Buffer.from('a'))
    const second = await service.save({ text: 'two', voiceId: 'echo' }, Buffer.from('b'))
    const third = await service.save({ text: 'three', voiceId: 'nova' }, Buffer.from('c'))

    expect(service.list().map((g) => g.id)).toEqual([third.id, second.id, first.id])
  })

  it('serializes each entry to the REST shape: filename (basename) + audioUrl, never the raw path', async () => {
    // The route maps service.list() through toGenerationDto; the client (library
    // editor, US5) reads `filename`, so the response must carry it and keep the
    // authoritative `path` server-side.
    const service = makeService()
    const entry = await service.save(
      { text: 'hi', voiceId: 'alloy', format: 'mp3', metadata: { title: 'My Clip' } },
      Buffer.from('a'),
    )

    const dto = service.list().map((g) => toGenerationDto(g))[0]!

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
    const list = reopened.list()

    expect(list.map((g) => g.id)).toEqual([b.id, a.id])
    expect(list[0]).toMatchObject({ text: 'two', voiceId: 'echo' })
  })
})
