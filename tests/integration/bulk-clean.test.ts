import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LibraryService } from '../../src/core/library/library-service'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import { FileAudioStore } from '../../src/core/library/audio-store'
import { DomainError } from '../../src/core/shared/errors'
import { respondError } from '../../server/utils/errors'

// Integration coverage for POST /api/library/bulk-clean (FR-037): the pipeline
// the route runs (libraryService.bulkClean(filter)) over a real file-backed
// SQLite + the real filesystem store. Asserts that matching rows AND their stored
// audio are removed, the count is reported, a non-matching filter removes nothing,
// and an empty filter is rejected (never "delete everything"). The route's thin
// JSON envelope is set by the h3 handler and out of scope for this plain-Node
// suite, but the rejection is mapped through the real respondError to confirm the
// 400 the client would observe.

function mapError(err: unknown): { status: number; code: string } {
  const event = { node: { res: { statusCode: 200 } } }
  const body = respondError(event, err)
  return { status: event.node.res.statusCode, code: body.error.code }
}

let dir: string
let dbPath: string
let audio: FileAudioStore
let service: LibraryService

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'echorecall-clean-'))
  dbPath = join(dir, 'echorecall.db')
  audio = new FileAudioStore(dir)
  service = new LibraryService(new SqliteGenerationRepository(dbPath), audio)
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

// `save` derives the dated folder from its clock, so build a per-date service
// that shares the same DB + store to land each row on its own day.
function serviceAt(when: string) {
  return new LibraryService(new SqliteGenerationRepository(dbPath), audio, () => new Date(when))
}

describe('LibraryService.bulkClean', () => {
  it('removes matching rows and their audio files, returning the deleted count', async () => {
    const a = await serviceAt('2026-06-15T09:00:00.000Z').save(
      { text: 'a', voiceId: 'alloy' },
      Buffer.from('A'),
    )
    const b = await serviceAt('2026-06-16T09:00:00.000Z').save(
      { text: 'b', voiceId: 'echo' },
      Buffer.from('B'),
    )
    const c = await serviceAt('2026-06-17T09:00:00.000Z').save(
      { text: 'c', voiceId: 'alloy' },
      Buffer.from('C'),
    )

    const result = await service.bulkClean({ voiceId: 'alloy' })

    expect(result).toEqual({ deleted: 2 })
    expect(await audio.existsAt(a.path)).toBe(false)
    expect(await audio.existsAt(c.path)).toBe(false)
    // The non-matching row and its file survive.
    expect(await audio.existsAt(b.path)).toBe(true)
    expect(service.list().rows.map((g) => g.id)).toEqual([b.id])
  })

  it('cleans an inclusive created_at range', async () => {
    const a = await serviceAt('2026-06-15T09:00:00.000Z').save(
      { text: 'a', voiceId: 'alloy' },
      Buffer.from('A'),
    )
    const b = await serviceAt('2026-06-16T09:00:00.000Z').save(
      { text: 'b', voiceId: 'echo' },
      Buffer.from('B'),
    )

    const result = await service.bulkClean({ from: '2026-06-16T00:00:00.000Z' })

    expect(result).toEqual({ deleted: 1 })
    expect(await audio.existsAt(b.path)).toBe(false)
    expect(await audio.existsAt(a.path)).toBe(true)
  })

  it('removes nothing (deleted: 0) when no row matches the filter', async () => {
    await serviceAt('2026-06-15T09:00:00.000Z').save(
      { text: 'a', voiceId: 'alloy' },
      Buffer.from('A'),
    )
    expect(await service.bulkClean({ voiceId: 'nobody' })).toEqual({ deleted: 0 })
    expect(service.list().total).toBe(1)
  })

  it('rejects an empty filter with a 400 instead of deleting everything', async () => {
    await serviceAt('2026-06-15T09:00:00.000Z').save(
      { text: 'a', voiceId: 'alloy' },
      Buffer.from('A'),
    )

    const err = await service.bulkClean({}).catch((e) => e)
    expect(err).toBeInstanceOf(DomainError)
    expect(mapError(err).status).toBe(400)
    // Nothing was deleted.
    expect(service.list().total).toBe(1)
  })
})
