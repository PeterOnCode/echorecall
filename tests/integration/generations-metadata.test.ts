import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateSpeech } from '../../src/core/tts/generate'
import { LibraryService } from '../../src/core/library/library-service'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import { FileAudioStore } from '../../src/core/library/audio-store'
import type { TtsProvider } from '../../src/core/tts/provider'
import type { AudioTagger, TagResult } from '../../src/core/tagging/tagger'
import type { Format, Metadata } from '../../src/core/shared/types'
import { toGenerationDto } from '../../server/utils/serialize'

// Integration coverage for US2 (FR-018..023): the POST pipeline
// (generateSpeech -> tagAudio inside LibraryService.save -> serialize) over a real
// file-backed SQLite + filesystem, with the TTS provider AND the AudioTagger faked
// at their ports (no network, no WASM). The real taglib-wasm backend is covered by
// the gated tests/adapters/taglib-tagger.test.ts; here we assert the tagging step
// is invoked correctly, skippedTags surfaces per format, and metadata persists.

class FakeProvider implements TtsProvider {
  async synthesize(): Promise<Buffer> {
    return Buffer.from('audio-bytes')
  }
}

// Stamps the bytes with a marker so we can prove tagging ran BEFORE the file was
// written, and records the metadata it was asked to embed.
class FakeTagger implements AudioTagger {
  calls: { format: Format; metadata: Metadata }[] = []
  async tag(format: Format, audio: Buffer, metadata: Metadata): Promise<TagResult> {
    this.calls.push({ format, metadata })
    return { bytes: Buffer.concat([Buffer.from('ID3:'), audio]), skipped: [] }
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

let dir: string
let dbPath: string
let repo: SqliteGenerationRepository
let tagger: FakeTagger
let service: LibraryService

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'echorecall-meta-'))
  dbPath = join(dir, 'echorecall.db')
  repo = new SqliteGenerationRepository(dbPath)
  tagger = new FakeTagger()
  service = new LibraryService(repo, new FileAudioStore(dir), undefined, undefined, tagger)
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

// Mirror the route: validate+synthesize, save (tags inside), then serialize.
async function save(input: { format?: Format }, metadata: Metadata) {
  const base = { text: 'Hello world', voiceId: 'alloy', ...input }
  const bytes = await generateSpeech(new FakeProvider(), base)
  const { skippedTags, ...generation } = await service.save({ ...base, metadata }, bytes)
  return { generation, skippedTags, dto: toGenerationDto(generation, skippedTags) }
}

describe('POST /api/generations metadata (US2 tagging)', () => {
  it('MP3: tags with the full set before writing, skips nothing, persists across a fresh repo', async () => {
    const { generation, dto } = await save({ format: 'mp3' }, fullMeta)

    // Tagging was invoked once for mp3 with the exact metadata set.
    expect(tagger.calls).toHaveLength(1)
    expect(tagger.calls[0]).toMatchObject({ format: 'mp3', metadata: fullMeta })

    // The written file is the TAGGED output (tagging happened before the write).
    const stored = await service.readAudio(generation.id)
    expect(stored.toString()).toBe('ID3:audio-bytes')

    // Nothing skipped for a fully-taggable format.
    expect(dto.skippedTags).toBeUndefined()

    // Metadata persists verbatim across a brand-new repository over the same DB.
    const reopened = new SqliteGenerationRepository(dbPath)
    expect(reopened.get(generation.id)?.metadata).toEqual(fullMeta)
  })

  it('accepts recordedAt as year-only and as a full timestamp, both persisted', async () => {
    const yearOnly = await save({ format: 'mp3' }, { title: 'Y', recordedAt: '2026' })
    const fullTs = await save(
      { format: 'mp3' },
      { title: 'F', recordedAt: '2026-06-17T10:00:00.000Z' },
    )

    const reopened = new SqliteGenerationRepository(dbPath)
    expect(reopened.get(yearOnly.generation.id)?.metadata.recordedAt).toBe('2026')
    expect(reopened.get(fullTs.generation.id)?.metadata.recordedAt).toBe('2026-06-17T10:00:00.000Z')
  })

  it('FLAC/Opus: writes mappable fields but reports customUrl in skippedTags', async () => {
    for (const format of ['flac', 'opus'] as Format[]) {
      tagger.calls = []
      const { dto } = await save({ format }, fullMeta)
      expect(tagger.calls).toHaveLength(1) // Vorbis tagging still runs
      expect(dto.skippedTags).toContain('customUrl')
    }
  })

  it('AAC/PCM: still saves (untagged) with skippedTags=[*] and the bytes untouched', async () => {
    for (const format of ['aac', 'pcm'] as Format[]) {
      tagger.calls = []
      const { generation, dto } = await save({ format }, fullMeta)

      expect(tagger.calls).toHaveLength(0) // untaggable container is never opened
      expect(dto.skippedTags).toEqual(['*'])

      // The generation still completed: row + readable (untagged) audio exist.
      expect(repo.get(generation.id)).toBeTruthy()
      expect((await service.readAudio(generation.id)).toString()).toBe('audio-bytes')
    }
  })
})
