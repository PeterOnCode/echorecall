import { describe, it, expect, vi } from 'vitest'
import { readAudioProperties } from '../../src/core/library/audio-properties'
import type { AudioFileLike, TagLibLike } from '../../src/core/library/audio-properties'

// 006 · R-AUDIOPROPS — read-only codec/bitrate/sampleRate/duration, computed on
// read via taglib's `audioProperties()`; nothing is persisted (no migration). The
// reader takes the taglib opener as an injected port so its mapping + error
// handling are unit-testable WASM-free (the real taglib round-trip is exercised by
// the gated adapter suite). An unreadable/missing file must yield an empty object,
// never throw — so a single broken file can't break listing.

function fakeTagLib(props: ReturnType<AudioFileLike['audioProperties']>, opts?: { throwOnOpen?: boolean }): TagLibLike {
  const dispose = vi.fn()
  return {
    open: vi.fn(async () => {
      if (opts?.throwOnOpen) throw new Error('unreadable')
      const file: AudioFileLike = { audioProperties: () => props, dispose }
      return file
    }),
  }
}

describe('readAudioProperties', () => {
  it('maps taglib audio properties to the read-only AudioProperties shape', async () => {
    const taglib = fakeTagLib({
      duration: 12.5,
      bitrate: 320,
      sampleRate: 44100,
      channels: 2,
      codec: 'MP3',
      containerFormat: 'MP3',
    })
    const props = await readAudioProperties(taglib, Buffer.from('audio'))
    expect(props).toEqual({ codec: 'MP3', bitrate: 320, sampleRate: 44100, duration: 12.5 })
  })

  it('disposes the opened file after reading', async () => {
    const dispose = vi.fn()
    const taglib: TagLibLike = {
      open: async () => ({
        audioProperties: () => ({ duration: 1, bitrate: 128, sampleRate: 48000, codec: 'FLAC' }),
        dispose,
      }),
    }
    await readAudioProperties(taglib, Buffer.from('x'))
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('returns an empty object (no throw) when the file cannot be opened', async () => {
    const taglib = fakeTagLib(undefined, { throwOnOpen: true })
    await expect(readAudioProperties(taglib, Buffer.from('garbage'))).resolves.toEqual({})
  })

  it('returns an empty object when taglib yields no audio properties', async () => {
    const taglib = fakeTagLib(undefined)
    expect(await readAudioProperties(taglib, Buffer.from('x'))).toEqual({})
  })

  it('omits zero/absent numeric values rather than reporting them', async () => {
    const taglib = fakeTagLib({
      duration: 0,
      bitrate: 0,
      sampleRate: 0,
      channels: 0,
      codec: 'unknown',
      containerFormat: 'unknown',
    })
    // Zeros (taglib's "unknown") are dropped; an unknown codec is not surfaced.
    expect(await readAudioProperties(taglib, Buffer.from('x'))).toEqual({})
  })
})
