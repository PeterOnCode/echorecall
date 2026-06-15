import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LibraryService } from '../../src/core/library/library-service'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import { FileAudioStore } from '../../src/core/library/audio-store'
import { NotFoundError } from '../../src/core/shared/errors'
import type { GenerationRepository } from '../../src/core/library/repository'

let dir: string
let service: LibraryService
let repo: SqliteGenerationRepository
let audio: FileAudioStore

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'echorecall-lib-'))
  repo = new SqliteGenerationRepository(':memory:')
  audio = new FileAudioStore(join(dir, 'audio'))
  service = new LibraryService(repo, audio)
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('LibraryService', () => {
  it('saves a generation: persists metadata + audio and returns the entry', async () => {
    const mp3 = Buffer.from('fake-mp3')
    const entry = await service.save({ text: 'hi', voiceId: 'alloy' }, mp3)

    expect(entry.id).toBeTruthy()
    expect(entry.text).toBe('hi')
    expect(entry.voiceId).toBe('alloy')
    expect(entry.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    expect(repo.get(entry.id)).toBeTruthy()
    expect(Buffer.compare(await service.readAudio(entry.id), mp3)).toBe(0)
  })

  it('lists saved generations newest-first', async () => {
    await service.save({ text: 'one', voiceId: 'alloy' }, Buffer.from('a'))
    await new Promise((r) => setTimeout(r, 5))
    await service.save({ text: 'two', voiceId: 'nova' }, Buffer.from('b'))
    const texts = service.list().map((g) => g.text)
    expect(texts[0]).toBe('two')
    expect(texts).toContain('one')
  })

  it('readAudio throws NotFound for unknown id', async () => {
    await expect(service.readAudio('missing')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('delete removes row + audio; deleting unknown id throws NotFound', async () => {
    const entry = await service.save({ text: 'bye', voiceId: 'echo' }, Buffer.from('x'))
    await service.delete(entry.id)
    expect(repo.get(entry.id)).toBeUndefined()
    expect(await audio.exists(entry.id)).toBe(false)
    await expect(service.delete(entry.id)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('cleans up the orphan audio file if the metadata insert fails (atomic save)', async () => {
    const failingRepo: GenerationRepository = {
      insert() {
        throw new Error('db down')
      },
      list: () => [],
      get: () => undefined,
      delete: () => false,
    }
    const svc = new LibraryService(failingRepo, audio, () => new Date(), () => 'fixed-id')
    await expect(svc.save({ text: 'x', voiceId: 'alloy' }, Buffer.from('y'))).rejects.toThrow('db down')
    // The audio written before the failed insert must be cleaned up (no orphan).
    expect(await audio.exists('fixed-id')).toBe(false)
  })
})
