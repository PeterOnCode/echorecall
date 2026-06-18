import { describe, it, expect } from 'vitest'
import type { AudioTagger, TagResult } from '../../src/core/tagging/tagger'
import { skippedFields } from '../../src/core/tagging/tagger'
import { tagAudio } from '../../src/core/tagging/tag-audio'
import type { Format, Metadata } from '../../src/core/shared/types'

// Unit coverage for the `tagAudio` use-case with a FAKE AudioTagger injected at
// the port (no taglib-wasm). The fake deliberately does NOT compute `skipped` —
// the use-case owns the per-format applicability — so these assertions prove the
// format logic independently of any concrete backend (research §1; FR-018..021).

class FakeTagger implements AudioTagger {
  calls: { format: Format; metadata: Metadata }[] = []
  async tag(format: Format, audio: Buffer, metadata: Metadata): Promise<TagResult> {
    this.calls.push({ format, metadata })
    // Stamp the bytes so callers can prove the tagger's output is what gets used.
    return { bytes: Buffer.concat([Buffer.from('TAGGED:'), audio]), skipped: [] }
  }
}

const full: Metadata = {
  title: 'Title',
  artist: 'Artist',
  album: 'Album',
  genre: 'Speech',
  comment: 'Hello',
  recordedAt: '2026',
  track: '1/3',
  languages: ['eng', 'hun'],
  customText: [{ description: 'mood', value: 'calm' }],
  customUrl: [{ description: 'source', url: 'https://example.com' }],
}

describe('tagAudio', () => {
  it('mp3/wav (ID3): invokes the tagger with the full set and skips nothing', async () => {
    for (const format of ['mp3', 'wav'] as Format[]) {
      const tagger = new FakeTagger()
      const res = await tagAudio(tagger, format, Buffer.from('audio'), full)

      expect(tagger.calls).toHaveLength(1)
      expect(tagger.calls[0]!.format).toBe(format)
      expect(tagger.calls[0]!.metadata).toEqual(full)
      // The tagger's output bytes are returned (tagging actually applied).
      expect(res.bytes.toString()).toBe('TAGGED:audio')
      expect(res.skipped).toEqual([])
    }
  })

  it('flac/opus (Vorbis): tags the mappable fields but skips customUrl (ID3-only)', async () => {
    for (const format of ['flac', 'opus'] as Format[]) {
      const tagger = new FakeTagger()
      const res = await tagAudio(tagger, format, Buffer.from('audio'), full)

      expect(tagger.calls).toHaveLength(1) // tagging still runs for Vorbis formats
      expect(res.bytes.toString()).toBe('TAGGED:audio')
      expect(res.skipped).toEqual(['customUrl'])
    }
  })

  it('flac/opus with no customUrl skips nothing', async () => {
    const tagger = new FakeTagger()
    const { customUrl: _omit, ...noUrl } = full
    const res = await tagAudio(tagger, 'flac', Buffer.from('audio'), noUrl)
    expect(res.skipped).toEqual([])
  })

  it('aac/pcm (untaggable): returns input bytes unchanged, never opens the tagger, skipped=[*]', async () => {
    for (const format of ['aac', 'pcm'] as Format[]) {
      const tagger = new FakeTagger()
      const res = await tagAudio(tagger, format, Buffer.from('audio'), full)

      expect(tagger.calls).toHaveLength(0) // never attempts to tag
      expect(res.bytes.toString()).toBe('audio') // bytes pass through untouched
      expect(res.skipped).toEqual(['*'])
    }
  })

  it('empty metadata on a taggable format still runs and skips nothing', async () => {
    const tagger = new FakeTagger()
    const res = await tagAudio(tagger, 'mp3', Buffer.from('audio'), {})
    expect(tagger.calls).toHaveLength(1)
    expect(res.skipped).toEqual([])
  })
})

describe('skippedFields', () => {
  it('reports the unsupported fields per tagging path given the present metadata', () => {
    expect(skippedFields('mp3', full)).toEqual([])
    expect(skippedFields('wav', full)).toEqual([])
    expect(skippedFields('flac', full)).toEqual(['customUrl'])
    expect(skippedFields('opus', full)).toEqual(['customUrl'])
    expect(skippedFields('flac', { title: 'x' })).toEqual([])
    expect(skippedFields('aac', full)).toEqual(['*'])
    expect(skippedFields('pcm', {})).toEqual(['*'])
  })
})
