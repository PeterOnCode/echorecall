import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import type { NewGenerationRecord } from '../../src/core/library/repository'

function makeRepo() {
  // In-memory DB → isolated per test.
  return new SqliteGenerationRepository(':memory:')
}

/** Build a full record with sensible defaults, overridable per test. */
function rec(over: Partial<NewGenerationRecord> & { id: string }): NewGenerationRecord {
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

describe('SqliteGenerationRepository', () => {
  it('inserts and gets a generation by id', () => {
    const repo = makeRepo()
    repo.insert(rec({ id: 'a' }))
    expect(repo.get('a')).toEqual({
      id: 'a',
      text: 'hello',
      voiceId: 'alloy',
      model: null,
      format: 'mp3',
      speed: null,
      createdAt: '2026-06-15T10:00:00.000Z',
      path: 'audio/a.mp3',
      metadata: {},
    })
  })

  it('returns undefined for a missing id', () => {
    expect(makeRepo().get('nope')).toBeUndefined()
  })

  it('lists newest-first by createdAt', () => {
    const repo = makeRepo()
    repo.insert(rec({ id: 'old', createdAt: '2026-06-15T09:00:00.000Z' }))
    repo.insert(rec({ id: 'new', createdAt: '2026-06-15T11:00:00.000Z' }))
    repo.insert(rec({ id: 'mid', createdAt: '2026-06-15T10:00:00.000Z' }))
    expect(repo.list().rows.map((g) => g.id)).toEqual(['new', 'mid', 'old'])
  })

  it('deletes a row and reports whether it existed', () => {
    const repo = makeRepo()
    repo.insert(rec({ id: 'a' }))
    expect(repo.delete('a')).toBe(true)
    expect(repo.get('a')).toBeUndefined()
    expect(repo.delete('a')).toBe(false)
  })

  it('creates missing parent directories for a file-backed DB', async () => {
    const base = await mkdtemp(join(tmpdir(), 'echorecall-db-'))
    // Nested path whose parent dirs do NOT exist yet — mirrors a fresh checkout
    // where the gitignored data/ directory has not been created.
    const dbPath = join(base, 'nested', 'data', 'echorecall.db')
    const repo = new SqliteGenerationRepository(dbPath)
    try {
      repo.insert(rec({ id: 'a' }))
      expect(existsSync(dbPath)).toBe(true)
      expect(repo.get('a')?.id).toBe('a')
    } finally {
      repo.close()
      await rm(base, { recursive: true, force: true })
    }
  })
})
