import { describe, it, expect } from 'vitest'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import type { NewGenerationRecord } from '../../src/core/library/repository'
import type { Metadata } from '../../src/core/shared/types'
import { ratingToPopm, popmToRating } from '../../src/core/tagging/rating'

// 006 · R-TAGS — six extra editable tag fields (notes, encodedBy, albumArtist,
// composer, bpm, rating) persisted in the EXISTING `tags_extra` JSON column (no SQL
// column, no migration). This unit suite covers the SQLite serialize/hydrate
// round-trip and the Rating 0–5 ↔ POPM 0–255 mapping. The native ID3-frame
// write/read (TENC/TPE2/TCOM/TBPM/POPM via taglib-wasm) is covered by the gated
// adapter suite (tests/adapters/taglib-tagger.test.ts) so `npm test` stays
// WASM-free.

function makeRepo() {
  return new SqliteGenerationRepository(':memory:')
}

function rec(over: Partial<NewGenerationRecord> & { id: string; metadata?: Metadata }): NewGenerationRecord {
  return {
    text: 'hello',
    voiceId: 'alloy',
    model: null,
    format: 'mp3',
    speed: null,
    createdAt: '2026-06-15T10:00:00.000Z',
    path: `audio/${over.id}.mp3`,
    metadata: {},
    ...over,
  }
}

const extras: Metadata = {
  title: 'T',
  notes: 'a free-form note',
  encodedBy: 'kid3',
  albumArtist: 'The Album Artist',
  composer: 'A Composer',
  bpm: 120,
  rating: 4,
}

describe('R-TAGS — tags_extra round-trip of the six extra fields', () => {
  it('persists every extra field through insert and reads it back', () => {
    const repo = makeRepo()
    repo.insert(rec({ id: 'a', metadata: extras }))
    const m = repo.get('a')!.metadata
    expect(m.notes).toBe('a free-form note')
    expect(m.encodedBy).toBe('kid3')
    expect(m.albumArtist).toBe('The Album Artist')
    expect(m.composer).toBe('A Composer')
    expect(m.bpm).toBe(120)
    expect(m.rating).toBe(4)
  })

  it('persists the extra fields through a metadata update (retag)', () => {
    const repo = makeRepo()
    repo.insert(rec({ id: 'a', metadata: { title: 'T' } }))
    repo.update('a', { metadata: extras })
    const m = repo.get('a')!.metadata
    expect(m.encodedBy).toBe('kid3')
    expect(m.bpm).toBe(120)
    expect(m.rating).toBe(4)
  })

  it('clears an extra field when the retag omits it (whole-set replace)', () => {
    const repo = makeRepo()
    repo.insert(rec({ id: 'a', metadata: extras }))
    repo.update('a', { metadata: { title: 'T' } })
    const m = repo.get('a')!.metadata
    expect(m.encodedBy).toBeUndefined()
    expect(m.bpm).toBeUndefined()
    expect(m.rating).toBeUndefined()
    expect(m.notes).toBeUndefined()
  })

  it('reads back empty for existing rows that never had the keys (back-compat)', () => {
    const repo = makeRepo()
    repo.insert(rec({ id: 'a', metadata: { title: 'T', languages: ['eng'] } }))
    const m = repo.get('a')!.metadata
    expect(m.notes).toBeUndefined()
    expect(m.encodedBy).toBeUndefined()
    expect(m.albumArtist).toBeUndefined()
    expect(m.composer).toBeUndefined()
    expect(m.bpm).toBeUndefined()
    expect(m.rating).toBeUndefined()
    // The pre-existing tags_extra payload (languages) is untouched.
    expect(m.languages).toEqual(['eng'])
  })

  it('coexists with the existing tags_extra contents (languages/customText)', () => {
    const repo = makeRepo()
    repo.insert(
      rec({
        id: 'a',
        metadata: {
          ...extras,
          languages: ['eng', 'hun'],
          customText: [{ description: 'mood', value: 'calm' }],
        },
      }),
    )
    const m = repo.get('a')!.metadata
    expect(m.languages).toEqual(['eng', 'hun'])
    expect(m.customText).toEqual([{ description: 'mood', value: 'calm' }])
    expect(m.encodedBy).toBe('kid3')
  })
})

describe('R-TAGS — Rating 0–5 ↔ POPM 0–255', () => {
  it('maps each star rating to the conventional POPM byte', () => {
    expect(ratingToPopm(0)).toBe(0)
    expect(ratingToPopm(1)).toBe(1)
    expect(ratingToPopm(2)).toBe(64)
    expect(ratingToPopm(3)).toBe(128)
    expect(ratingToPopm(4)).toBe(196)
    expect(ratingToPopm(5)).toBe(255)
  })

  it('maps a POPM byte back to the nearest star rating (round-trip stable)', () => {
    for (const stars of [0, 1, 2, 3, 4, 5]) {
      expect(popmToRating(ratingToPopm(stars))).toBe(stars)
    }
    // Representative raw POPM bytes fall into the right bucket.
    expect(popmToRating(0)).toBe(0)
    expect(popmToRating(1)).toBe(1)
    expect(popmToRating(118)).toBe(3)
    expect(popmToRating(255)).toBe(5)
  })

  it('clamps out-of-range input', () => {
    expect(ratingToPopm(9)).toBe(255)
    expect(ratingToPopm(-1)).toBe(0)
    expect(popmToRating(300)).toBe(5)
    expect(popmToRating(-5)).toBe(0)
  })
})
