import { describe, it, expect, beforeAll } from 'vitest'
import { TagLib } from 'taglib-wasm'
import { TagLibAudioTagger } from '../../src/core/tagging/taglib-tagger'
import type { Format, Metadata } from '../../src/core/shared/types'

// GATED adapter test for the real taglib-wasm backend (research §1 spike). It is
// excluded from the default suite (vitest.config.ts only globs unit/integration)
// and runs via `pnpm test:adapters`. The WASM module runs in-process, so there is
// no system binary and no network — it is deterministic in CI.
//
// taglib-wasm cannot synthesise FLAC/Opus/MP3 containers from nothing, so we build
// a minimal valid WAV in-code. WAV shares TagLib's ID3v2 writer with MP3, so this
// confirms the ID3v2.4.0 path (the riskiest spike item, FR-019): multi-value TLAN,
// custom TXXX, and the custom-URL round-trip/fallback. The Vorbis skip-set is
// covered by the format-agnostic use-case test (tests/unit/tag-audio.test.ts).

/** Minimal valid 16-bit PCM mono WAV (a few silent samples). */
function minimalWav(): Buffer {
  const sampleRate = 8000
  const channels = 1
  const bits = 16
  const nSamples = 32
  const dataSize = nSamples * channels * (bits / 8)
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(channels, 22)
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * channels * (bits / 8), 28)
  buf.writeUInt16LE(channels * (bits / 8), 32)
  buf.writeUInt16LE(bits, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  return buf
}

const full: Metadata = {
  title: 'My Title',
  artist: 'My Artist',
  album: 'My Album',
  genre: 'Speech',
  comment: 'A spoken clip',
  recordedAt: '2026',
  track: '1/3',
  languages: ['eng', 'hun'],
  customText: [{ description: 'mood', value: 'calm' }],
  // 'homepage' is a non-reserved description: TagLib round-trips it. Descriptions
  // colliding with TagLib's reserved property keys (e.g. 'source') may be dropped
  // at the file-tag level — the library row keeps the value regardless (FR-030).
  customUrl: [{ description: 'homepage', url: 'https://example.com/clip' }],
}

let tagger: TagLibAudioTagger
let taglib: TagLib

beforeAll(async () => {
  tagger = await TagLibAudioTagger.create()
  taglib = await TagLib.initialize()
})

/** Read every property value back out of tagged bytes (case-insensitive search helper). */
async function readback(bytes: Buffer): Promise<Record<string, string[]>> {
  const file = await taglib.open(new Uint8Array(bytes))
  try {
    return file.properties() as Record<string, string[]>
  } finally {
    file.dispose()
  }
}

function findValue(props: Record<string, string[]>, value: string): boolean {
  return Object.values(props).some((arr) => arr?.includes(value))
}

describe('TagLibAudioTagger (real taglib-wasm)', () => {
  it('writes an ID3v2.4.0 tag into WAV with the full metadata set', async () => {
    const { bytes, skipped } = await tagger.tag('wav', minimalWav(), full)
    expect(skipped).toEqual([]) // WAV/ID3 carries everything

    // WAV stores the ID3v2 tag in a RIFF "ID3 " chunk; the inner header must be 2.4.0.
    const idx = bytes.indexOf(Buffer.from('ID3'))
    expect(idx).toBeGreaterThanOrEqual(0)
    // Scan for the real ID3v2 header (version byte 4 = 2.4) — the first "ID3"
    // match may be the RIFF chunk id, so find the one followed by a 2.x version.
    let major = -1
    for (let i = 0; i < bytes.length - 4; i++) {
      if (bytes.toString('latin1', i, i + 3) === 'ID3' && (bytes[i + 3] === 3 || bytes[i + 3] === 4)) {
        major = bytes[i + 3]!
        break
      }
    }
    expect(major).toBe(4) // ID3v2.4.0

    const props = await readback(bytes)
    expect(props.title).toEqual(['My Title'])
    expect(props.artist).toEqual(['My Artist'])
    expect(props.album).toEqual(['My Album'])
    expect(props.genre).toEqual(['Speech'])
    expect(props.comment).toEqual(['A spoken clip'])
    expect(props.date).toEqual(['2026'])
    expect(props.trackNumber?.[0]).toMatch(/^1/) // "1" or "1/3" depending on normalisation
    expect(props.language).toEqual(['eng', 'hun']) // multi-value TLAN
    expect(findValue(props, 'calm')).toBe(true) // custom TXXX
    expect(findValue(props, 'https://example.com/clip')).toBe(true) // custom URL (WXXX or TXXX fallback)
  })

  it('round-trips the 006 · R-TAGS extra editable fields into ID3 frames', async () => {
    // encodedBy→TENC, albumArtist→TPE2, composer→TCOM, bpm→TBPM, notes→TXXX.
    // (rating/POPM is intentionally tags_extra-only; see taglib-tagger.ts.)
    const { bytes } = await tagger.tag('wav', minimalWav(), {
      encodedBy: 'kid3',
      albumArtist: 'The Album Artist',
      composer: 'A Composer',
      bpm: 128,
      notes: 'a free-form note',
    })
    const props = await readback(bytes)
    expect(findValue(props, 'kid3')).toBe(true)
    expect(findValue(props, 'The Album Artist')).toBe(true)
    expect(findValue(props, 'A Composer')).toBe(true)
    expect(findValue(props, '128')).toBe(true)
    expect(findValue(props, 'a free-form note')).toBe(true)
  })

  it('reads real audio properties (codec/sampleRate/bitrate) from a WAV', async () => {
    const props = await tagger.readAudioProperties(minimalWav())
    // The minimal WAV is 8 kHz PCM — codec + sample rate are always present.
    expect(props.sampleRate).toBe(8000)
    expect(typeof props.codec).toBe('string')
    expect(props.codec!.length).toBeGreaterThan(0)
  })

  it('accepts a full timestamp for recordedAt', async () => {
    const { bytes } = await tagger.tag('wav', minimalWav(), {
      recordedAt: '2026-06-17T10:00:00Z',
    })
    const props = await readback(bytes)
    expect(props.date?.[0]).toContain('2026')
  })

  it('leaves AAC/PCM bytes untouched and skips the whole set', async () => {
    for (const format of ['aac', 'pcm'] as Format[]) {
      const input = Buffer.from('not-real-audio-but-untouched')
      const { bytes, skipped } = await tagger.tag(format, input, full)
      expect(skipped).toEqual(['*'])
      expect(Buffer.compare(bytes, input)).toBe(0) // pass-through, never opened
    }
  })
})
