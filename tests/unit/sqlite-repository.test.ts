import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'

function makeRepo() {
  // In-memory DB → isolated per test.
  return new SqliteGenerationRepository(':memory:')
}

describe('SqliteGenerationRepository', () => {
  it('inserts and gets a generation by id', () => {
    const repo = makeRepo()
    repo.insert({ id: 'a', text: 'hello', voiceId: 'alloy', createdAt: '2026-06-15T10:00:00.000Z' })
    expect(repo.get('a')).toEqual({
      id: 'a',
      text: 'hello',
      voiceId: 'alloy',
      createdAt: '2026-06-15T10:00:00.000Z',
    })
  })

  it('returns undefined for a missing id', () => {
    expect(makeRepo().get('nope')).toBeUndefined()
  })

  it('lists newest-first by createdAt', () => {
    const repo = makeRepo()
    repo.insert({ id: 'old', text: 't1', voiceId: 'alloy', createdAt: '2026-06-15T09:00:00.000Z' })
    repo.insert({ id: 'new', text: 't2', voiceId: 'nova', createdAt: '2026-06-15T11:00:00.000Z' })
    repo.insert({ id: 'mid', text: 't3', voiceId: 'echo', createdAt: '2026-06-15T10:00:00.000Z' })
    expect(repo.list().map((g) => g.id)).toEqual(['new', 'mid', 'old'])
  })

  it('deletes a row and reports whether it existed', () => {
    const repo = makeRepo()
    repo.insert({ id: 'a', text: 'x', voiceId: 'alloy', createdAt: '2026-06-15T10:00:00.000Z' })
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
      repo.insert({ id: 'a', text: 'x', voiceId: 'alloy', createdAt: '2026-06-15T10:00:00.000Z' })
      expect(existsSync(dbPath)).toBe(true)
      expect(repo.get('a')?.id).toBe('a')
    } finally {
      repo.close()
      await rm(base, { recursive: true, force: true })
    }
  })
})
