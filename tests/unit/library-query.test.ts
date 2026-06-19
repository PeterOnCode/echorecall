import { describe, it, expect } from 'vitest'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import type { NewGenerationRecord } from '../../src/core/library/repository'
import type { Metadata } from '../../src/core/shared/types'

// Unit coverage for US6 (FR-034–037): the composable server-side query the
// repository builds — free-text LIKE over title/text/tags/filename, voiceId and
// format equality, an inclusive created_at range, an allow-listed ORDER BY in
// either direction, LIMIT/OFFSET pagination with an accurate `total`, and
// bulkDelete returning the removed rows so the service can delete their files.

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

/** Three rows that differ across every queryable dimension. */
function seed(repo: SqliteGenerationRepository) {
  repo.insert(
    rec({
      id: 'a',
      voiceId: 'alloy',
      format: 'mp3',
      createdAt: '2026-06-15T09:00:00.000Z',
      text: 'alpha source',
      metadata: { title: 'Banana Song' },
      path: 'audio/2026/06/15/banana-song.mp3',
    }),
  )
  repo.insert(
    rec({
      id: 'b',
      voiceId: 'echo',
      format: 'wav',
      createdAt: '2026-06-16T09:00:00.000Z',
      text: 'beta source',
      metadata: { title: 'Cherry Tune' },
      path: 'audio/2026/06/16/cherry-tune.wav',
    }),
  )
  repo.insert(
    rec({
      id: 'c',
      voiceId: 'alloy',
      format: 'flac',
      createdAt: '2026-06-17T09:00:00.000Z',
      text: 'gamma source',
      metadata: {
        title: 'Date Melody',
        customText: [{ description: 'note', value: 'special-keyword' }],
      },
      path: 'audio/2026/06/17/date-melody.flac',
    }),
  )
}

describe('SqliteGenerationRepository.list(query)', () => {
  it('returns every row newest-first with an accurate total when the query is empty', () => {
    const repo = makeRepo()
    seed(repo)
    const { rows, total } = repo.list()
    expect(rows.map((r) => r.id)).toEqual(['c', 'b', 'a'])
    expect(total).toBe(3)
  })

  it('matches free text against source text', () => {
    const repo = makeRepo()
    seed(repo)
    const { rows, total } = repo.list({ q: 'beta' })
    expect(rows.map((r) => r.id)).toEqual(['b'])
    expect(total).toBe(1)
  })

  it('matches free text against the title (case-insensitive)', () => {
    const repo = makeRepo()
    seed(repo)
    expect(repo.list({ q: 'banana' }).rows.map((r) => r.id)).toEqual(['a'])
    expect(repo.list({ q: 'BANANA' }).rows.map((r) => r.id)).toEqual(['a'])
  })

  it('matches free text against the filename', () => {
    const repo = makeRepo()
    seed(repo)
    // The hyphenated token only exists in the stored path, not the title.
    expect(repo.list({ q: 'cherry-tune' }).rows.map((r) => r.id)).toEqual(['b'])
  })

  it('matches free text against custom tags (tags_extra)', () => {
    const repo = makeRepo()
    seed(repo)
    expect(repo.list({ q: 'special-keyword' }).rows.map((r) => r.id)).toEqual(['c'])
  })

  it('filters by voiceId, returning matches newest-first', () => {
    const repo = makeRepo()
    seed(repo)
    const { rows, total } = repo.list({ voiceId: 'alloy' })
    expect(rows.map((r) => r.id)).toEqual(['c', 'a'])
    expect(total).toBe(2)
  })

  it('filters by format', () => {
    const repo = makeRepo()
    seed(repo)
    expect(repo.list({ format: 'wav' }).rows.map((r) => r.id)).toEqual(['b'])
  })

  it('filters by an inclusive created_at range', () => {
    const repo = makeRepo()
    seed(repo)
    expect(repo.list({ from: '2026-06-16T00:00:00.000Z' }).rows.map((r) => r.id)).toEqual([
      'c',
      'b',
    ])
    expect(repo.list({ to: '2026-06-16T23:59:59.000Z' }).rows.map((r) => r.id)).toEqual(['b', 'a'])
    expect(
      repo.list({ from: '2026-06-16T00:00:00.000Z', to: '2026-06-16T23:59:59.000Z' }).rows.map(
        (r) => r.id,
      ),
    ).toEqual(['b'])
  })

  it('sorts by title ascending and descending', () => {
    const repo = makeRepo()
    seed(repo)
    expect(repo.list({ sort: 'title', order: 'asc' }).rows.map((r) => r.id)).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(repo.list({ sort: 'title', order: 'desc' }).rows.map((r) => r.id)).toEqual([
      'c',
      'b',
      'a',
    ])
  })

  it('sorts by format', () => {
    const repo = makeRepo()
    seed(repo)
    // flac < mp3 < wav alphabetically.
    expect(repo.list({ sort: 'format', order: 'asc' }).rows.map((r) => r.id)).toEqual([
      'c',
      'a',
      'b',
    ])
  })

  it('paginates with LIMIT/OFFSET while reporting the full total', () => {
    const repo = makeRepo()
    seed(repo)
    const page1 = repo.list({ pageSize: 2, page: 1 })
    expect(page1.rows.map((r) => r.id)).toEqual(['c', 'b'])
    expect(page1.total).toBe(3)
    const page2 = repo.list({ pageSize: 2, page: 2 })
    expect(page2.rows.map((r) => r.id)).toEqual(['a'])
    expect(page2.total).toBe(3)
  })

  it('caps an excessive pageSize so a crafted request cannot pull the whole table', () => {
    const repo = makeRepo()
    for (let i = 0; i < 150; i++) {
      repo.insert(rec({ id: `r${i}`, path: `audio/r${i}.mp3` }))
    }
    const { rows, total } = repo.list({ pageSize: 10_000, page: 1 })
    expect(total).toBe(150)
    expect(rows).toHaveLength(100)
  })

  it('composes search + filter + sort', () => {
    const repo = makeRepo()
    seed(repo)
    const { rows, total } = repo.list({
      q: 'source',
      voiceId: 'alloy',
      sort: 'title',
      order: 'asc',
    })
    expect(rows.map((r) => r.id)).toEqual(['a', 'c'])
    expect(total).toBe(2)
  })

  it('returns an empty result with total 0 when nothing matches', () => {
    const repo = makeRepo()
    seed(repo)
    expect(repo.list({ q: 'zzzz-no-match' })).toEqual({ rows: [], total: 0 })
  })
})

describe('SqliteGenerationRepository.bulkDelete(filter)', () => {
  it('removes matching rows and returns them (so the caller can delete files)', () => {
    const repo = makeRepo()
    seed(repo)
    const removed = repo.bulkDelete({ voiceId: 'alloy' })
    expect(removed.map((r) => r.id).sort()).toEqual(['a', 'c'])
    // Each returned row carries its stored path for file cleanup.
    expect(removed.every((r) => r.path.length > 0)).toBe(true)
    expect(repo.list().rows.map((r) => r.id)).toEqual(['b'])
  })

  it('removes rows within a created_at range', () => {
    const repo = makeRepo()
    seed(repo)
    const removed = repo.bulkDelete({ from: '2026-06-16T00:00:00.000Z' })
    expect(removed.map((r) => r.id).sort()).toEqual(['b', 'c'])
    expect(repo.list().rows.map((r) => r.id)).toEqual(['a'])
  })

  it('returns an empty array when nothing matches the filter', () => {
    const repo = makeRepo()
    seed(repo)
    expect(repo.bulkDelete({ voiceId: 'nope' })).toEqual([])
    expect(repo.list().total).toBe(3)
  })
})
