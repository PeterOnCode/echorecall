import { describe, it, expect } from 'vitest'
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
})
