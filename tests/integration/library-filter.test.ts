import { describe, it, expect, beforeEach } from 'vitest'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import { LibraryService } from '../../src/core/library/library-service'
import { FileAudioStore } from '../../src/core/library/audio-store'
import type { NewGenerationRecord } from '../../src/core/library/repository'
import type { Metadata } from '../../src/core/shared/types'

// 006 · US3 / R-FILTER (FR-011/FR-012, SC-003) — the filter bar narrows the WHOLE
// library through LibraryService.list (the same pipeline the GET route runs), not
// just the loaded page. Integration over a real SQLite repo: each filter (format /
// genre / language / recording-date / search) narrows, and a no-match query yields
// an empty result the UI renders as its empty state.

let service: LibraryService

function rec(id: string, metadata: Metadata, over: Partial<NewGenerationRecord> = {}): NewGenerationRecord {
  return {
    id,
    text: `${id} source`,
    voiceId: 'alloy',
    model: null,
    format: 'mp3',
    speed: null,
    createdAt: '2026-06-15T10:00:00.000Z',
    path: `audio/${id}.mp3`,
    metadata,
    ...over,
  }
}

beforeEach(() => {
  const repo = new SqliteGenerationRepository(':memory:')
  repo.insert(rec('a', { genre: 'Speech', languages: ['eng'], recordedAt: '2024-01-10' }, { format: 'mp3' }))
  repo.insert(rec('b', { genre: 'Podcast', languages: ['hun', 'eng'], recordedAt: '2025-06-20' }, { format: 'wav' }))
  repo.insert(rec('c', { genre: 'Speech', languages: ['fra'], recordedAt: '2025-12-31' }, { format: 'flac' }))
  service = new LibraryService(repo, new FileAudioStore('/tmp'))
})

describe('library filter pipeline (US3)', () => {
  it('narrows by audio format', () => {
    expect(service.list({ format: 'wav' }).rows.map((r) => r.id)).toEqual(['b'])
  })

  it('narrows by genre', () => {
    expect(service.list({ genre: 'Speech' }).rows.map((r) => r.id).sort()).toEqual(['a', 'c'])
  })

  it('narrows by language (multi-value membership)', () => {
    expect(service.list({ language: 'eng' }).rows.map((r) => r.id).sort()).toEqual(['a', 'b'])
  })

  it('narrows by a single recording-date day (the date-only bounds the filter bar emits)', () => {
    // Row 'b' is tagged exactly '2025-06-20'. The filter bar emits timezone-naive
    // date-only bounds, so selecting that day matches the day's own rows regardless of
    // the runner's timezone — a UTC `…T00:00:00.000Z` lower bound would sort after the
    // plain '2025-06-20' string and drop it.
    const r = service.list({ recordedFrom: '2025-06-20', recordedTo: '2025-06-20' })
    expect(r.rows.map((x) => x.id)).toEqual(['b'])
  })

  it('narrows by free-text search', () => {
    expect(service.list({ q: 'c source' }).rows.map((r) => r.id)).toEqual(['c'])
  })

  it('composes filters', () => {
    expect(service.list({ genre: 'Speech', language: 'eng' }).rows.map((r) => r.id)).toEqual(['a'])
  })

  it('yields an empty result for a no-match combination (empty-state)', () => {
    expect(service.list({ genre: 'Speech', language: 'hun' })).toEqual({ rows: [], total: 0 })
  })
})
