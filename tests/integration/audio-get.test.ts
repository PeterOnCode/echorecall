import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateSpeech } from '../../src/core/tts/generate'
import { LibraryService } from '../../src/core/library/library-service'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import { FileAudioStore } from '../../src/core/library/audio-store'
import type { TtsProvider } from '../../src/core/tts/provider'
import { respondError } from '../../server/utils/errors'

// Integration coverage for GET /api/generations/:id/audio: serving stored audio
// for replay/download. The key contract (SC-003) is that replay reads the stored
// file and makes NO provider request. The `audio/mpeg` content-type itself is set
// by the thin h3 handler and is out of scope for this plain-Node suite.

// Counting fake: a non-zero `calls` after a read would mean the replay path
// wrongly re-synthesized.
class FakeProvider implements TtsProvider {
  calls = 0
  constructor(private readonly bytes: Buffer = Buffer.from('audio-bytes')) {}
  async synthesize(): Promise<Buffer> {
    this.calls++
    return this.bytes
  }
}

function mapError(err: unknown): { status: number; code: string } {
  const event = { node: { res: { statusCode: 200 } } }
  const body = respondError(event, err)
  return { status: event.node.res.statusCode, code: body.error.code }
}

let dir: string
let audioStore: FileAudioStore
let service: LibraryService
let provider: FakeProvider

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'echorecall-audio-'))
  const repo = new SqliteGenerationRepository(join(dir, 'echorecall.db'))
  audioStore = new FileAudioStore(dir)
  service = new LibraryService(repo, audioStore)
  provider = new FakeProvider(Buffer.from('audio-bytes'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function createOne(voiceId = 'alloy') {
  const input = { text: 'hi', voiceId }
  return service.save(input, await generateSpeech(provider, input))
}

describe('GET /api/generations/:id/audio', () => {
  it('serves stored audio for replay without any provider call (SC-003)', async () => {
    const entry = await createOne()
    expect(provider.calls).toBe(1) // one synthesis, at creation time

    const first = await service.readAudio(entry.id)
    const second = await service.readAudio(entry.id)

    expect(Buffer.compare(first, Buffer.from('audio-bytes'))).toBe(0)
    expect(Buffer.compare(second, Buffer.from('audio-bytes'))).toBe(0)
    expect(provider.calls).toBe(1) // replays added zero provider calls
  })

  it('unknown id -> 404 NOT_FOUND', async () => {
    const err = await service.readAudio('does-not-exist').catch((e) => e)
    expect(mapError(err)).toEqual({ status: 404, code: 'NOT_FOUND' })
  })

  it('row exists but audio file is missing -> 404 NOT_FOUND', async () => {
    const entry = await createOne('echo')
    await audioStore.deleteAt(entry.path) // file gone, metadata row remains

    const err = await service.readAudio(entry.id).catch((e) => e)
    expect(mapError(err)).toEqual({ status: 404, code: 'NOT_FOUND' })
  })
})
