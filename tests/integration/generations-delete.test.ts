import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LibraryService } from '../../src/core/library/library-service'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import { FileAudioStore } from '../../src/core/library/audio-store'
import { datedDir } from '../../src/core/naming/filename'
import { respondError } from '../../server/utils/errors'

// Integration coverage for DELETE /api/generations/:id (FR-015): the pipeline the
// route runs (libraryService.delete()) over a real file-backed SQLite + the real
// filesystem audio store. Asserts the permanent-delete contract — row AND file
// removed, the deletion survives a fresh repository (restart), a subsequent audio
// read 404s, and an unknown id 404s without disturbing existing entries. The
// route's 204 status and thin envelope are set by the h3 handler and, like the
// content-type in audio-get, are out of scope for this plain-Node suite.

// Maps a thrown domain error the way the route would, exposing the HTTP status +
// error code the client would observe.
function mapError(err: unknown): { status: number; code: string } {
  const event = { node: { res: { statusCode: 200 } } }
  const body = respondError(event, err)
  return { status: event.node.res.statusCode, code: body.error.code }
}

let dir: string
let dbPath: string
let audioStore: FileAudioStore
let service: LibraryService

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'echorecall-delete-'))
  dbPath = join(dir, 'echorecall.db')
  const repo = new SqliteGenerationRepository(dbPath)
  audioStore = new FileAudioStore(dir)
  service = new LibraryService(repo, audioStore)
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function createOne(text = 'hi', voiceId = 'alloy') {
  return service.save({ text, voiceId }, Buffer.from('audio-bytes'))
}

describe('DELETE /api/generations/:id', () => {
  it('removes both the metadata row and the audio file', async () => {
    const entry = await createOne()
    expect(await audioStore.existsAt(entry.path)).toBe(true)

    await service.delete(entry.id)

    expect(service.list()).toEqual({ rows: [], total: 0 })
    expect(await audioStore.existsAt(entry.path)).toBe(false)
  })

  it('removes the stored file from its dated YYYY/MM/DD folder', async () => {
    // A US4-named item lives under audio/<YYYY/MM/DD>/<slug>.<ext>; deletion must
    // remove that nested file, not just the row.
    const entry = await service.save(
      { text: 'hi', voiceId: 'alloy', format: 'mp3', metadata: { title: 'Dated Clip' } },
      Buffer.from('audio-bytes'),
    )
    const today = datedDir(new Date(entry.createdAt))
    expect(entry.path).toBe(`audio/${today}/dated-clip.mp3`)
    expect(await audioStore.existsAt(entry.path)).toBe(true)

    await service.delete(entry.id)

    expect(await audioStore.existsAt(entry.path)).toBe(false)
    expect(service.list().rows.map((g) => g.id)).not.toContain(entry.id)
  })

  it('after delete, reading the audio -> 404 NOT_FOUND', async () => {
    const entry = await createOne()
    await service.delete(entry.id)

    const err = await service.readAudio(entry.id).catch((e) => e)
    expect(mapError(err)).toEqual({ status: 404, code: 'NOT_FOUND' })
  })

  it('deleting an unknown id -> 404 NOT_FOUND and leaves other entries untouched', async () => {
    const entry = await createOne()

    const err = await service.delete('does-not-exist').catch((e) => e)
    expect(mapError(err)).toEqual({ status: 404, code: 'NOT_FOUND' })
    expect(service.list().rows.map((g) => g.id)).toEqual([entry.id])
  })

  it('delete is permanent across a fresh repository (survives restart)', async () => {
    const entry = await createOne()
    await service.delete(entry.id)

    // A brand-new service/repository over the same files — simulates a restart.
    const reopened = new LibraryService(
      new SqliteGenerationRepository(dbPath),
      new FileAudioStore(dir),
    )
    expect(reopened.list()).toEqual({ rows: [], total: 0 })
    const err = await reopened.readAudio(entry.id).catch((e) => e)
    expect(mapError(err)).toEqual({ status: 404, code: 'NOT_FOUND' })
  })
})
