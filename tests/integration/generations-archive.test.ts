import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LibraryService } from '../../src/core/library/library-service'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import { FileAudioStore } from '../../src/core/library/audio-store'
import { NotFoundError } from '../../src/core/shared/errors'

// Integration coverage for the batch archive (FR-008): LibraryService.archive(ids)
// streams a .zip whose entries are named by each item's stored filename, with
// duplicate basenames (same title on different days) disambiguated. Verified
// against a real file-backed SQLite + filesystem store; the zip is parsed back
// from its local file headers so we never depend on an unzip library.

let dir: string
let repo: SqliteGenerationRepository
let audio: FileAudioStore
let now: Date
let service: LibraryService

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'echorecall-zip-'))
  repo = new SqliteGenerationRepository(join(dir, 'echorecall.db'))
  audio = new FileAudioStore(dir)
  now = new Date('2026-06-17T10:00:00.000Z')
  service = new LibraryService(repo, audio, () => now)
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (c: Buffer) => chunks.push(Buffer.from(c)))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

/** Read entry names from a zip's local file headers (signature PK\x03\x04). */
function zipEntryNames(buf: Buffer): string[] {
  const names: string[] = []
  let i = 0
  for (;;) {
    i = buf.indexOf('PK\x03\x04', i, 'latin1')
    if (i === -1) break
    const nameLen = buf.readUInt16LE(i + 26)
    const extraLen = buf.readUInt16LE(i + 28)
    names.push(buf.toString('utf8', i + 30, i + 30 + nameLen))
    i += 30 + nameLen + extraLen
  }
  return names
}

describe('LibraryService.archive', () => {
  it('streams a zip naming entries by filename, disambiguating duplicate basenames', async () => {
    const a = await service.save(
      { text: 'a', voiceId: 'alloy', format: 'mp3', metadata: { title: 'Song' } },
      Buffer.from('AAA'),
    )
    now = new Date('2026-06-18T10:00:00.000Z') // next day -> same basename, different path
    const b = await service.save(
      { text: 'b', voiceId: 'alloy', format: 'mp3', metadata: { title: 'Song' } },
      Buffer.from('BBB'),
    )
    expect(a.path).toMatch(/2026\/06\/17\/song\.mp3$/)
    expect(b.path).toMatch(/2026\/06\/18\/song\.mp3$/)

    const buf = await streamToBuffer(await service.archive([a.id, b.id]))

    expect(buf.subarray(0, 2).toString('latin1')).toBe('PK') // a real zip
    expect(zipEntryNames(buf).sort()).toEqual(['song.mp3', 'song_2.mp3'])
  })

  it('skips unknown ids', async () => {
    const a = await service.save(
      { text: 'a', voiceId: 'alloy', format: 'mp3', metadata: { title: 'Only' } },
      Buffer.from('AAA'),
    )
    const buf = await streamToBuffer(await service.archive([a.id, 'does-not-exist']))
    expect(zipEntryNames(buf)).toEqual(['only.mp3'])
  })

  it('throws NotFound when no id resolves', async () => {
    await expect(service.archive([])).rejects.toBeInstanceOf(NotFoundError)
    await expect(service.archive(['nope'])).rejects.toBeInstanceOf(NotFoundError)
  })
})
