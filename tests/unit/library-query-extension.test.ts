import { describe, it, expect } from 'vitest'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import type { NewGenerationRecord } from '../../src/core/library/repository'
import type { Metadata } from '../../src/core/shared/types'

// 006 · R-FILTER (additive, read-only, migration-free LibraryQuery extension).
// New filters (genre / language / recordedAt-range) and sort keys
// (filename|artist|album|recordedAt|track|genre|comment) over columns that ALREADY
// exist (tag_genre, tag_recorded_at, tag_track, tag_album, tag_artist, tags_extra,
// path). Every new param is optional → existing callers are unaffected (back-compat
// is asserted by the unchanged tests/unit/library-query.test.ts).

function makeRepo() {
  return new SqliteGenerationRepository(':memory:')
}

function rec(
  over: Partial<NewGenerationRecord> & { id: string; path: string; metadata?: Metadata },
): NewGenerationRecord {
  return {
    text: 'hello',
    voiceId: 'alloy',
    model: null,
    format: 'mp3',
    speed: null,
    createdAt: '2026-06-15T10:00:00.000Z',
    metadata: {},
    ...over,
  }
}

/** Rows differing across every new queryable dimension (genre/language/recordedAt/sort). */
function seed(repo: SqliteGenerationRepository) {
  repo.insert(
    rec({
      id: 'a',
      createdAt: '2026-06-15T09:00:00.000Z',
      path: 'audio/2026/06/15/aaa.mp3',
      metadata: {
        title: 'Alpha',
        artist: 'Zoe',
        album: 'Omega',
        genre: 'Speech',
        comment: 'first',
        track: '3',
        recordedAt: '2024-01-10',
        languages: ['eng'],
      },
    }),
  )
  repo.insert(
    rec({
      id: 'b',
      createdAt: '2026-06-16T09:00:00.000Z',
      path: 'audio/2026/06/16/bbb.mp3',
      metadata: {
        title: 'Bravo',
        artist: 'Yann',
        album: 'November',
        genre: 'Podcast',
        comment: 'second',
        track: '1',
        recordedAt: '2025-06-20',
        languages: ['hun', 'eng'],
      },
    }),
  )
  repo.insert(
    rec({
      id: 'c',
      createdAt: '2026-06-17T09:00:00.000Z',
      path: 'audio/2026/06/17/ccc.mp3',
      metadata: {
        title: 'Charlie',
        artist: 'Xavier',
        album: 'Mike',
        genre: 'Speech',
        comment: 'third',
        track: '2',
        recordedAt: '2025-12-31',
        languages: ['fra'],
      },
    }),
  )
}

describe('R-FILTER — genre / language / recordedAt filters', () => {
  it('filters by exact genre', () => {
    const repo = makeRepo()
    seed(repo)
    expect(repo.list({ genre: 'Speech' }).rows.map((r) => r.id).sort()).toEqual(['a', 'c'])
    expect(repo.list({ genre: 'Podcast' }).rows.map((r) => r.id)).toEqual(['b'])
  })

  it('filters by a single language code matched within the multi-value tags_extra.languages', () => {
    const repo = makeRepo()
    seed(repo)
    // 'eng' is present on a (only) and b (multi-value) → both match.
    expect(repo.list({ language: 'eng' }).rows.map((r) => r.id).sort()).toEqual(['a', 'b'])
    expect(repo.list({ language: 'fra' }).rows.map((r) => r.id)).toEqual(['c'])
    expect(repo.list({ language: 'hun' }).rows.map((r) => r.id)).toEqual(['b'])
  })

  it('filters by an inclusive recordedAt range (distinct from createdAt)', () => {
    const repo = makeRepo()
    seed(repo)
    // recordedAt: a=2024-01-10, b=2025-06-20, c=2025-12-31.
    expect(repo.list({ recordedFrom: '2025-01-01' }).rows.map((r) => r.id).sort()).toEqual([
      'b',
      'c',
    ])
    expect(repo.list({ recordedTo: '2025-01-01' }).rows.map((r) => r.id)).toEqual(['a'])
    expect(
      repo.list({ recordedFrom: '2025-01-01', recordedTo: '2025-07-01' }).rows.map((r) => r.id),
    ).toEqual(['b'])
  })

  it('excludes rows with a null recordedAt when a recordedAt bound is set', () => {
    const repo = makeRepo()
    seed(repo)
    repo.insert(rec({ id: 'd', path: 'audio/d.mp3', metadata: { title: 'NoDate' } }))
    expect(repo.list({ recordedFrom: '2000-01-01' }).rows.map((r) => r.id).sort()).toEqual([
      'a',
      'b',
      'c',
    ])
    // With no recordedAt bound, the null-date row still lists.
    expect(repo.list().rows.map((r) => r.id)).toContain('d')
  })

  it('composes the new filters with the existing ones', () => {
    const repo = makeRepo()
    seed(repo)
    expect(
      repo.list({ genre: 'Speech', language: 'eng' }).rows.map((r) => r.id),
    ).toEqual(['a'])
  })
})

describe('R-FILTER — new sort keys (over existing columns)', () => {
  it('sorts by artist asc/desc', () => {
    const repo = makeRepo()
    seed(repo)
    // artists: a=Zoe, b=Yann, c=Xavier.
    expect(repo.list({ sort: 'artist', order: 'asc' }).rows.map((r) => r.id)).toEqual([
      'c',
      'b',
      'a',
    ])
    expect(repo.list({ sort: 'artist', order: 'desc' }).rows.map((r) => r.id)).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('sorts by album', () => {
    const repo = makeRepo()
    seed(repo)
    // albums: a=Omega, b=November, c=Mike → asc: Mike, November, Omega.
    expect(repo.list({ sort: 'album', order: 'asc' }).rows.map((r) => r.id)).toEqual([
      'c',
      'b',
      'a',
    ])
  })

  it('sorts by track', () => {
    const repo = makeRepo()
    seed(repo)
    // tracks: a=3, b=1, c=2.
    expect(repo.list({ sort: 'track', order: 'asc' }).rows.map((r) => r.id)).toEqual([
      'b',
      'c',
      'a',
    ])
  })

  it('sorts by genre', () => {
    const repo = makeRepo()
    seed(repo)
    // genres: a=Speech, b=Podcast, c=Speech → asc starts with Podcast (b).
    expect(repo.list({ sort: 'genre', order: 'asc' }).rows[0]!.id).toBe('b')
  })

  it('sorts by comment', () => {
    const repo = makeRepo()
    seed(repo)
    // comments: a=first, b=second, c=third.
    expect(repo.list({ sort: 'comment', order: 'asc' }).rows.map((r) => r.id)).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('sorts by recordedAt (Year and Date both map here)', () => {
    const repo = makeRepo()
    seed(repo)
    // recordedAt: a=2024-01-10, b=2025-06-20, c=2025-12-31.
    expect(repo.list({ sort: 'recordedAt', order: 'asc' }).rows.map((r) => r.id)).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('sorts by filename (the stored name/path)', () => {
    const repo = makeRepo()
    seed(repo)
    // paths end aaa/bbb/ccc.
    expect(repo.list({ sort: 'filename', order: 'asc' }).rows.map((r) => r.id)).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(repo.list({ sort: 'filename', order: 'desc' }).rows.map((r) => r.id)).toEqual([
      'c',
      'b',
      'a',
    ])
  })
})

describe('R-FILTER — back-compat', () => {
  it('an empty query still lists everything newest-first (unchanged)', () => {
    const repo = makeRepo()
    seed(repo)
    expect(repo.list().rows.map((r) => r.id)).toEqual(['c', 'b', 'a'])
    expect(repo.list().total).toBe(3)
  })
})
