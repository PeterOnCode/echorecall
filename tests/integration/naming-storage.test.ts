import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LibraryService } from '../../src/core/library/library-service'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import { FileAudioStore } from '../../src/core/library/audio-store'
import { datedDir } from '../../src/core/naming/filename'
import { toGenerationDto } from '../../server/utils/serialize'

// Integration coverage for US4 (FR-025–029): a newly generated file is named from
// its title slug under a UTC `YYYY/MM/DD` folder, unique within that day (numeric
// suffix on collision, never overwriting), with a UUID fallback when the title
// yields no slug. Legacy 001 rows (flat `audio/<id>.mp3`) must stay listable,
// playable, and downloadable by their real filename. Exercised over a real
// file-backed SQLite + the real filesystem audio store; `save()` takes the bytes
// directly so no TTS provider is involved.

let dir: string
let dbPath: string
let repo: SqliteGenerationRepository
let audio: FileAudioStore

// A fixed UTC instant so the dated folder is deterministic.
const FIXED = new Date('2026-06-18T08:00:00.000Z')
const DAY = datedDir(FIXED) // 2026/06/18

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'echorecall-naming-'))
  dbPath = join(dir, 'echorecall.db')
  repo = new SqliteGenerationRepository(dbPath)
  audio = new FileAudioStore(dir)
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function makeService(idFn?: () => string): LibraryService {
  return new LibraryService(repo, audio, () => FIXED, idFn)
}

describe('US4 naming + dated storage', () => {
  it('names two same-title items <slug>.<ext> and <slug>_2.<ext> under today’s UTC folder, neither overwritten', async () => {
    const service = makeService()
    const input = {
      text: 'x',
      voiceId: 'alloy',
      format: 'mp3' as const,
      metadata: { title: 'My Great Clip!' },
    }

    const a = await service.save(input, Buffer.from('aaa'))
    const b = await service.save(input, Buffer.from('bbb'))

    expect(a.path).toBe(`audio/${DAY}/my-great-clip.mp3`)
    expect(b.path).toBe(`audio/${DAY}/my-great-clip_2.mp3`)

    // Neither file was overwritten: each reads back its own bytes.
    expect(Buffer.compare(await service.readAudio(a.id), Buffer.from('aaa'))).toBe(0)
    expect(Buffer.compare(await service.readAudio(b.id), Buffer.from('bbb'))).toBe(0)
  })

  it('transliterates the title to an ASCII slug and appends the format extension', async () => {
    const service = makeService()
    const entry = await service.save(
      { text: 'x', voiceId: 'alloy', format: 'flac' as const, metadata: { title: 'Café del Mar' } },
      Buffer.from('flac-bytes'),
    )
    expect(entry.path).toBe(`audio/${DAY}/cafe-del-mar.flac`)
  })

  it('falls back to a unique id filename when the title yields no slug (empty or emoji-only)', async () => {
    let n = 0
    const ids = ['id-empty', 'id-emoji']
    const service = makeService(() => ids[n++]!)

    const empty = await service.save(
      { text: 'x', voiceId: 'alloy', format: 'mp3' as const, metadata: { title: '   ' } },
      Buffer.from('e'),
    )
    const emoji = await service.save(
      { text: 'x', voiceId: 'alloy', format: 'mp3' as const, metadata: { title: '🎵🎶' } },
      Buffer.from('m'),
    )

    expect(empty.path).toBe(`audio/${DAY}/id-empty.mp3`)
    expect(emoji.path).toBe(`audio/${DAY}/id-emoji.mp3`)
  })

  it('uses the default UUID generator for the fallback name when no title is given', async () => {
    const service = makeService() // default idFn === randomUUID
    const entry = await service.save(
      { text: 'x', voiceId: 'alloy', format: 'mp3' as const },
      Buffer.from('u'),
    )
    // <uuid>.mp3 under today's folder — a valid filename always exists (FR-027).
    expect(entry.path).toMatch(
      new RegExp(`^audio/${DAY}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.mp3$`),
    )
    expect(entry.path.split('/').pop()).toBe(`${entry.id}.mp3`)
  })

  it('keeps a legacy flat-path row listable, playable, and downloadable by its real filename', async () => {
    // Simulate a backfilled 001 row: flat `audio/<id>.mp3` path + the file on disk.
    const id = 'legacy-uuid'
    const legacyPath = `audio/${id}.mp3`
    await audio.saveAt(legacyPath, Buffer.from('legacy-bytes'))
    repo.insert({
      id,
      text: 'old clip',
      voiceId: 'alloy',
      model: null,
      format: 'mp3',
      speed: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      path: legacyPath,
      metadata: {},
    })

    const service = makeService()

    // Lists in place (no migration of the file).
    expect(service.list().rows.map((g) => g.id)).toContain(id)
    // Plays: reads the stored bytes, no provider call.
    expect(Buffer.compare(await service.readAudio(id), Buffer.from('legacy-bytes'))).toBe(0)
    // Downloads by its real filename (basename of the stored path).
    expect(toGenerationDto(service.get(id)).filename).toBe('legacy-uuid.mp3')
  })
})
