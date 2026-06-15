import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateSpeech, MAX_INPUT_LENGTH } from '../../src/core/tts/generate'
import { LibraryService } from '../../src/core/library/library-service'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import { FileAudioStore } from '../../src/core/library/audio-store'
import type { TtsProvider } from '../../src/core/tts/provider'
import { respondError } from '../../server/utils/errors'

// Integration coverage for POST /api/generations: the pipeline the route runs
// (generateSpeech -> libraryService.save) over a real file-backed SQLite + the
// real filesystem audio store, with the TTS provider faked at the port boundary
// (research §3 — no network). Domain-error -> HTTP status/envelope is asserted
// through the real `respondError` mapper.

// Port-boundary fake. `calls` lets us prove validation short-circuits before any
// synthesis, and that a failure leaves nothing behind.
class FakeProvider implements TtsProvider {
  calls = 0
  constructor(
    private readonly behavior: 'ok' | 'fail' = 'ok',
    private readonly bytes: Buffer = Buffer.from('fake-mp3'),
  ) {}
  async synthesize(): Promise<Buffer> {
    this.calls++
    if (this.behavior === 'fail') throw new Error('network down')
    return this.bytes
  }
}

// Run the real error mapper exactly as the route does: it reads/writes
// `node.res.statusCode` on the event. This yields the documented HTTP contract
// (400 / 502) from the real domain error — no re-implementation of the mapping.
function mapError(err: unknown): { status: number; code: string } {
  const event = { node: { res: { statusCode: 200 } } }
  const body = respondError(event, err)
  return { status: event.node.res.statusCode, code: body.error.code }
}

let dir: string
let dbPath: string
let audioDir: string
let repo: SqliteGenerationRepository
let service: LibraryService

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'echorecall-post-'))
  dbPath = join(dir, 'echorecall.db')
  audioDir = join(dir, 'audio')
  repo = new SqliteGenerationRepository(dbPath)
  service = new LibraryService(repo, new FileAudioStore(audioDir))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function audioFileCount(): Promise<number> {
  try {
    return (await readdir(audioDir)).length
  } catch {
    return 0 // directory never created — nothing was written
  }
}

describe('POST /api/generations', () => {
  it('synthesizes, saves the entry, and persists it across a fresh repository', async () => {
    const provider = new FakeProvider('ok', Buffer.from('the-mp3'))
    const input = { text: 'Hello world', voiceId: 'alloy' }

    const mp3 = await generateSpeech(provider, input)
    const entry = await service.save(input, mp3)

    expect(provider.calls).toBe(1)
    expect(entry).toMatchObject({ text: 'Hello world', voiceId: 'alloy' })
    expect(entry.id).toBeTruthy()
    expect(entry.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    // Atomic save: a saved entry always has readable audio.
    expect(Buffer.compare(await service.readAudio(entry.id), Buffer.from('the-mp3'))).toBe(0)

    // Persistence: a brand-new repository over the same DB file still sees it
    // (the "survives restart" contract).
    const reopened = new SqliteGenerationRepository(dbPath)
    expect(reopened.get(entry.id)).toMatchObject({ id: entry.id, text: 'Hello world' })
  })

  it('empty text -> 400 EMPTY_INPUT, provider untouched, nothing persisted', async () => {
    const provider = new FakeProvider('ok')
    const err = await generateSpeech(provider, { text: '   ', voiceId: 'alloy' }).catch((e) => e)

    expect(provider.calls).toBe(0)
    expect(service.list()).toHaveLength(0)
    expect(await audioFileCount()).toBe(0)
    expect(mapError(err)).toEqual({ status: 400, code: 'EMPTY_INPUT' })
  })

  it('over-length text -> 400 INPUT_TOO_LONG, provider untouched, nothing persisted', async () => {
    const provider = new FakeProvider('ok')
    const text = 'a'.repeat(MAX_INPUT_LENGTH + 1)
    const err = await generateSpeech(provider, { text, voiceId: 'alloy' }).catch((e) => e)

    expect(provider.calls).toBe(0)
    expect(service.list()).toHaveLength(0)
    expect(await audioFileCount()).toBe(0)
    expect(mapError(err)).toEqual({ status: 400, code: 'INPUT_TOO_LONG' })
  })

  it('unknown voice -> 400 INVALID_VOICE, provider untouched, nothing persisted', async () => {
    const provider = new FakeProvider('ok')
    const err = await generateSpeech(provider, { text: 'hi', voiceId: 'nope' }).catch((e) => e)

    expect(provider.calls).toBe(0)
    expect(service.list()).toHaveLength(0)
    expect(await audioFileCount()).toBe(0)
    expect(mapError(err)).toEqual({ status: 400, code: 'INVALID_VOICE' })
  })

  it('provider failure -> 502 PROVIDER_UNAVAILABLE, nothing persisted, no orphan audio', async () => {
    const provider = new FakeProvider('fail')
    const err = await generateSpeech(provider, { text: 'hi', voiceId: 'alloy' }).catch((e) => e)

    expect(provider.calls).toBe(1) // synthesis attempted...
    expect(service.list()).toHaveLength(0) // ...but nothing was saved
    expect(await audioFileCount()).toBe(0) // and no orphan file was left behind
    expect(mapError(err)).toEqual({ status: 502, code: 'PROVIDER_UNAVAILABLE' })
  })
})
