import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FileAudioStore } from '../../src/core/library/audio-store'

let dir: string
let store: FileAudioStore

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'echorecall-audio-'))
  store = new FileAudioStore(join(dir, 'audio'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('FileAudioStore', () => {
  it('saves and reads back the same bytes (creating the dir)', async () => {
    const bytes = Buffer.from([1, 2, 3, 4])
    await store.save('abc', bytes)
    expect(await store.exists('abc')).toBe(true)
    expect(Buffer.compare(await store.read('abc'), bytes)).toBe(0)
  })

  it('reports missing files as not existing', async () => {
    expect(await store.exists('ghost')).toBe(false)
  })

  it('deletes a file and tolerates deleting a missing one', async () => {
    await store.save('abc', Buffer.from('x'))
    await store.delete('abc')
    expect(await store.exists('abc')).toBe(false)
    await expect(store.delete('abc')).resolves.toBeUndefined()
  })
})
