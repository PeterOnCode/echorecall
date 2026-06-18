import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LibraryService } from '../../src/core/library/library-service'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import { FileAudioStore } from '../../src/core/library/audio-store'
import { datedDir } from '../../src/core/naming/filename'
import { TaggingFailedError } from '../../src/core/shared/errors'
import type { AudioTagger, TagResult } from '../../src/core/tagging/tagger'
import type { Format, Metadata } from '../../src/core/shared/types'
import { respondError } from '../../server/utils/errors'
import { toGenerationDto } from '../../server/utils/serialize'

// Integration coverage for PATCH /api/generations/:id (US5 / FR-030/031): rename
// and retag a saved item without re-synthesis, over a real file-backed SQLite +
// filesystem with the AudioTagger faked at its port (no WASM). Asserts the
// service pipeline the thin route runs — slug+collision rename moves the file and
// updates `path`, an empty/un-sluggable name is rejected (original kept), editing
// the title never renames, a retag rewrites + persists the tag set (survives a
// fresh repository), and a tagging failure leaves the original file untouched.
// The route's 200 status / envelope are set by the h3 handler and, like the
// content-type in audio-get, are out of scope for this plain-Node suite — error
// codes are asserted via the same `respondError` mapper the route uses.

function mapError(err: unknown): { status: number; code: string } {
  const event = { node: { res: { statusCode: 200 } } }
  const body = respondError(event, err)
  return { status: event.node.res.statusCode, code: body.error.code }
}

// Stamps an 'ID3:' marker so a (re)tag is observable in the stored bytes, and
// records the metadata it was asked to embed.
class FakeTagger implements AudioTagger {
  calls: { format: Format; metadata: Metadata }[] = []
  async tag(format: Format, audio: Buffer, metadata: Metadata): Promise<TagResult> {
    this.calls.push({ format, metadata })
    return { bytes: Buffer.concat([Buffer.from('ID3:'), audio]), skipped: [] }
  }
}

// Fails every embed so the retag path's "original file untouched" guarantee can
// be proven.
class ThrowingTagger implements AudioTagger {
  async tag(): Promise<TagResult> {
    throw new TaggingFailedError()
  }
}

const fullMeta: Metadata = {
  title: 'Hello World',
  artist: 'Artist',
  album: 'Album',
  genre: 'Speech',
  comment: 'A clip',
  recordedAt: '2026',
  track: '1/3',
  languages: ['eng', 'hun'],
  customText: [{ description: 'mood', value: 'calm' }],
  customUrl: [{ description: 'homepage', url: 'https://example.com' }],
}

// A fixed UTC instant so the dated folder is deterministic.
const FIXED = new Date('2026-06-18T08:00:00.000Z')
const DAY = datedDir(FIXED) // 2026/06/18

let dir: string
let dbPath: string
let repo: SqliteGenerationRepository
let audio: FileAudioStore
let tagger: FakeTagger
let service: LibraryService

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'echorecall-patch-'))
  dbPath = join(dir, 'echorecall.db')
  repo = new SqliteGenerationRepository(dbPath)
  audio = new FileAudioStore(dir)
  tagger = new FakeTagger()
  service = new LibraryService(repo, audio, () => FIXED, undefined, tagger)
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function save(metadata: Metadata, bytes: string, format: Format = 'mp3') {
  return service.save({ text: 'x', voiceId: 'alloy', format, metadata }, Buffer.from(bytes))
}

describe('PATCH /api/generations/:id — rename (FR-031)', () => {
  it('re-slugs the new name, moves the file, and reports the final filename', async () => {
    const entry = await save({ title: 'Hello' }, 'aaa')
    expect(entry.path).toBe(`audio/${DAY}/hello.mp3`)

    const renamed = await service.rename(entry.id, 'A Brand New Name!')

    expect(renamed.path).toBe(`audio/${DAY}/a-brand-new-name.mp3`)
    expect(toGenerationDto(renamed).filename).toBe('a-brand-new-name.mp3')
    // The old file is gone and the new one carries the same (tagged) bytes.
    expect(await audio.existsAt(`audio/${DAY}/hello.mp3`)).toBe(false)
    expect(await audio.existsAt(`audio/${DAY}/a-brand-new-name.mp3`)).toBe(true)
    expect((await service.readAudio(entry.id)).toString()).toBe('ID3:aaa')
  })

  it('rejects an empty / un-sluggable name with 400 INVALID_FILENAME and keeps the original', async () => {
    const entry = await save({ title: 'Keep Me' }, 'kkk')

    for (const bad of ['   ', '🎵🎶']) {
      const err = await service.rename(entry.id, bad).catch((e) => e)
      expect(mapError(err)).toEqual({ status: 400, code: 'INVALID_FILENAME' })
    }
    // Original name + file untouched.
    expect(service.get(entry.id).path).toBe(`audio/${DAY}/keep-me.mp3`)
    expect(await audio.existsAt(`audio/${DAY}/keep-me.mp3`)).toBe(true)
  })

  it('appends a numeric suffix when the renamed-to slug collides in the same dated folder', async () => {
    const a = await save({ title: 'Same' }, 'aaa') // same.mp3
    const b = await save({ title: 'Other' }, 'bbb') // other.mp3

    const renamed = await service.rename(b.id, 'Same')

    expect(renamed.path).toBe(`audio/${DAY}/same_2.mp3`)
    // Neither file was overwritten.
    expect((await service.readAudio(a.id)).toString()).toBe('ID3:aaa')
    expect((await service.readAudio(b.id)).toString()).toBe('ID3:bbb')
  })

  it('renaming an unknown id -> 404 NOT_FOUND', async () => {
    const err = await service.rename('nope', 'whatever').catch((e) => e)
    expect(mapError(err)).toEqual({ status: 404, code: 'NOT_FOUND' })
  })
})

describe('PATCH /api/generations/:id — retag (FR-030)', () => {
  it('editing metadata.title does NOT rename the file', async () => {
    const entry = await save({ title: 'Hello' }, 'hhh')
    expect(entry.path).toBe(`audio/${DAY}/hello.mp3`)

    const updated = await service.updateMetadata(entry.id, { title: 'Completely Different' })

    expect(updated.path).toBe(`audio/${DAY}/hello.mp3`)
    expect(toGenerationDto(updated).filename).toBe('hello.mp3')
    expect(updated.metadata.title).toBe('Completely Different')
  })

  it('rewrites + persists the tag set, surviving a fresh repository (restart)', async () => {
    const entry = await save({ title: 'X' }, 'xxx')

    await service.updateMetadata(entry.id, fullMeta)

    const reopened = new SqliteGenerationRepository(dbPath)
    expect(reopened.get(entry.id)?.metadata).toEqual(fullMeta)
    // The stored bytes were re-tagged in place (marker re-applied over the file).
    expect((await service.readAudio(entry.id)).toString()).toBe('ID3:ID3:xxx')
  })

  it('a tagging failure -> 502 TAGGING_FAILED with the original file + metadata untouched', async () => {
    const failing = new LibraryService(repo, audio, () => FIXED, undefined, new ThrowingTagger())
    // Save with no metadata so the tagger is never opened at save time (empty set).
    const entry = await failing.save(
      { text: 'x', voiceId: 'alloy', format: 'mp3', metadata: {} },
      Buffer.from('original'),
    )
    expect((await failing.readAudio(entry.id)).toString()).toBe('original')

    const err = await failing.updateMetadata(entry.id, { title: 'Boom' }).catch((e) => e)
    expect(mapError(err)).toEqual({ status: 502, code: 'TAGGING_FAILED' })

    // The stored audio and the persisted metadata are both unchanged.
    expect((await failing.readAudio(entry.id)).toString()).toBe('original')
    expect(failing.get(entry.id).metadata).toEqual({})
  })

  it('AAC keeps the filename editable and skips tagging (untaggable container)', async () => {
    const entry = await save({ title: 'Clip' }, 'aac-bytes', 'aac')
    tagger.calls = []

    // Retag is a no-op on the bytes (the tagger is never opened) but still persists.
    const updated = await service.updateMetadata(entry.id, { title: 'Clip', artist: 'A' })
    expect(tagger.calls).toHaveLength(0)
    expect(updated.metadata.artist).toBe('A')
    expect((await service.readAudio(entry.id)).toString()).toBe('aac-bytes')

    // ...and the filename can still be changed.
    const renamed = await service.rename(entry.id, 'Renamed Clip')
    expect(renamed.path).toBe(`audio/${DAY}/renamed-clip.aac`)

    const err = await service.updateMetadata('nope', {}).catch((e) => e)
    expect(mapError(err)).toEqual({ status: 404, code: 'NOT_FOUND' })
  })
})
