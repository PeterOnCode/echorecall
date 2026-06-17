import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FileAudioStore } from '../../src/core/library/audio-store'

let dir: string
let store: FileAudioStore

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'echorecall-audio-'))
  // Rooted at the data dir; callers pass paths relative to it.
  store = new FileAudioStore(dir)
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('FileAudioStore', () => {
  it('saves and reads back the same bytes, creating nested dated dirs', async () => {
    const bytes = Buffer.from([1, 2, 3, 4])
    const rel = 'audio/2026/06/17/clip.mp3'
    await store.saveAt(rel, bytes)
    expect(await store.existsAt(rel)).toBe(true)
    expect(Buffer.compare(await store.readAt(rel), bytes)).toBe(0)
  })

  it('reports missing files as not existing', async () => {
    expect(await store.existsAt('audio/ghost.mp3')).toBe(false)
  })

  it('renames an artifact to a new (deeper) path', async () => {
    await store.saveAt('audio/a.mp3', Buffer.from('x'))
    await store.rename('audio/a.mp3', 'audio/2026/06/17/b.mp3')
    expect(await store.existsAt('audio/a.mp3')).toBe(false)
    expect(Buffer.compare(await store.readAt('audio/2026/06/17/b.mp3'), Buffer.from('x'))).toBe(0)
  })

  it('deletes a file and tolerates deleting a missing one', async () => {
    await store.saveAt('audio/a.mp3', Buffer.from('x'))
    await store.deleteAt('audio/a.mp3')
    expect(await store.existsAt('audio/a.mp3')).toBe(false)
    await expect(store.deleteAt('audio/a.mp3')).resolves.toBeUndefined()
  })
})
