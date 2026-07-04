import { describe, it, expect } from 'vitest'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import type { NewGenerationRecord } from '../../src/core/library/repository'
import type { Metadata } from '../../src/core/shared/types'

// 006 · SC-003 — over a library of ≥200 recordings, search and every filter must narrow
// the WHOLE library in <5s. The redesign's filter bar is server-driven: the work is the
// SqliteGenerationRepository's WHERE/ORDER BY over the existing columns (R-FILTER), so
// this guard seeds 250 rows and asserts each representative query both NARROWS correctly
// and returns well inside the SC-003 budget — a permanent regression guard for the
// whole-library filter path (UI render over a single page is negligible beside this).

const GENRES = ['Speech', 'Podcast', 'Music', 'Audiobook', 'News']
const LANGS: string[][] = [['eng'], ['hun'], ['fra'], ['eng', 'hun']]
const SEED_COUNT = 250

function rec(id: number): NewGenerationRecord {
  const yr = 2020 + (id % 6) // 2020–2025
  const mo = String((id % 12) + 1).padStart(2, '0')
  const metadata: Metadata = {
    title: `Recording ${id}`,
    artist: `Artist ${id % 17}`,
    album: `Album ${id % 9}`,
    genre: GENRES[id % GENRES.length],
    comment: id % 3 === 0 ? 'flagged' : '',
    track: String((id % 12) + 1),
    recordedAt: `${yr}-${mo}-15`,
    languages: LANGS[id % LANGS.length],
  }
  return {
    text: `sample text ${id}`,
    voiceId: 'alloy',
    model: null,
    format: id % 2 === 0 ? 'mp3' : 'wav',
    speed: null,
    createdAt: `2026-06-${String((id % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
    id: `gen-${id}`,
    path: `audio/2026/06/${String((id % 28) + 1).padStart(2, '0')}/file-${id}.mp3`,
    metadata,
  } as NewGenerationRecord
}

function seededRepo(): SqliteGenerationRepository {
  const repo = new SqliteGenerationRepository(':memory:')
  for (let i = 0; i < SEED_COUNT; i++) repo.insert(rec(i))
  return repo
}

describe('Library whole-library filter performance (SC-003)', () => {
  it('seeds ≥200 recordings and every filter narrows the whole library in <5s', () => {
    const repo = seededRepo()
    expect(repo.list({}).total).toBe(SEED_COUNT)

    const start = performance.now()

    // Search-all over the title (and the other SEARCH_COLUMNS): a substring narrows.
    const search = repo.list({ q: 'Recording 1' })
    // Format filter.
    const byFormat = repo.list({ format: 'wav' })
    // Genre filter (over tag_genre).
    const byGenre = repo.list({ genre: 'Speech' })
    // Language filter (matched inside tags_extra.languages).
    const byLang = repo.list({ language: 'fra' })
    // Recording-date range (over tag_recorded_at) — the filter bar's single-day bounds.
    const byDate = repo.list({ recordedFrom: '2023-01-01', recordedTo: '2023-12-31' })
    // A new R-FILTER sort key over the whole set.
    const sorted = repo.list({ sort: 'recordedAt', order: 'asc' })

    const elapsedMs = performance.now() - start

    // Each query NARROWS (a strict, non-empty subset of the full 250).
    for (const [name, result] of [
      ['search', search],
      ['format', byFormat],
      ['genre', byGenre],
      ['language', byLang],
      ['recordedAt-range', byDate],
    ] as const) {
      expect(result.total, `${name} should match at least one row`).toBeGreaterThan(0)
      expect(result.total, `${name} should narrow below the full library`).toBeLessThan(SEED_COUNT)
    }

    // The new sort key returns the whole set, ordered.
    expect(sorted.total).toBe(SEED_COUNT)

    // SC-003 budget: the whole-library server-side filter path stays well under 5s.
    expect(elapsedMs).toBeLessThan(5000)
  })
})
