import { describe, it, expect } from 'vitest'
import { slugify } from '../../src/core/naming/slug'
import { datedDir, allocateFilename } from '../../src/core/naming/filename'

describe('slugify', () => {
  it('transliterates to ASCII, lowercases, and normalizes separators', () => {
    expect(slugify('My Great Clip!')).toBe('my-great-clip')
    expect(slugify('Café del Mar')).toBe('cafe-del-mar')
    expect(slugify('Árvíztűrő tükörfúrógép')).toMatch(/^[a-z0-9-]+$/)
  })

  it('caps at 64 characters without a trailing separator', () => {
    const s = slugify('word '.repeat(40)) // far longer than 64 once slugged
    expect(s.length).toBeLessThanOrEqual(64)
    expect(s.startsWith('-')).toBe(false)
    expect(s.endsWith('-')).toBe(false)
  })

  it('returns an empty string for an un-sluggable title', () => {
    expect(slugify('')).toBe('')
    expect(slugify('   ')).toBe('')
    expect(slugify('🎵🎶')).toBe('')
  })
})

describe('datedDir', () => {
  it('formats a zero-padded UTC YYYY/MM/DD path', () => {
    expect(datedDir(new Date('2026-06-17T23:30:00.000Z'))).toBe('2026/06/17')
    expect(datedDir(new Date('2026-01-05T00:00:00.000Z'))).toBe('2026/01/05')
  })

  it('uses the UTC day, not local time', () => {
    expect(datedDir(new Date('2026-12-31T23:59:59.000Z'))).toBe('2026/12/31')
  })
})

describe('allocateFilename', () => {
  it('returns the bare slug.ext when there is no collision', () => {
    expect(allocateFilename('clip', 'mp3', () => false)).toBe('clip.mp3')
  })

  it('appends a numeric suffix on collision and never returns an existing name', () => {
    const taken = new Set(['clip.mp3', 'clip_2.mp3'])
    const result = allocateFilename('clip', 'mp3', (name) => taken.has(name))
    expect(result).toBe('clip_3.mp3')
    expect(taken.has(result)).toBe(false)
  })
})
