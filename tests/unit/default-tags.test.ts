import { describe, it, expect } from 'vitest'
import {
  getDefaultTags,
  setDefaultTags,
  clearDefaultTags,
  DEFAULT_TAGS_CONFIG_KEY,
  type DefaultTagsInput,
} from '../../src/core/settings/default-tags'
import type { AppConfigRepository } from '../../src/core/settings/app-config-repository'

// Pure unit coverage for the store-backed default tag values (003 / FR-006/009/011/014).
// Non-secret: persisted as plain JSON in app_config, no crypto/app secret. Title is
// never stored; sanitization trims scalars, drops blanks, parses + de-dupes languages,
// and an all-blank save clears the row. Reads are total — a corrupt row yields {}.

/** Minimal in-memory AppConfigRepository for the default-tags tests. */
function fakeConfig(initial: Record<string, string> = {}): AppConfigRepository {
  const store = new Map(Object.entries(initial))
  return {
    get: (key) => store.get(key),
    set: (key, value) => {
      store.set(key, value)
    },
    delete: (key) => store.delete(key),
  }
}

describe('getDefaultTags', () => {
  it('returns {} when no row is stored', () => {
    expect(getDefaultTags({ config: fakeConfig() })).toEqual({})
  })

  it('returns {} (never throws) for a corrupt/invalid JSON row', () => {
    const config = fakeConfig({ [DEFAULT_TAGS_CONFIG_KEY]: 'not-json{' })
    expect(getDefaultTags({ config })).toEqual({})
  })

  it('re-sanitizes a stored row, dropping a smuggled title and unknown fields', () => {
    const config = fakeConfig({
      [DEFAULT_TAGS_CONFIG_KEY]: JSON.stringify({
        artist: 'Jane',
        title: 'nope',
        bogus: 'x',
        languages: ['eng', 'eng', ' '],
      }),
    })
    expect(getDefaultTags({ config })).toEqual({ artist: 'Jane', languages: ['eng'] })
  })
})

describe('setDefaultTags', () => {
  it('trims scalars, drops blanks, and never stores a Title', () => {
    const config = fakeConfig()
    const saved = setDefaultTags({ config }, {
      artist: '  Jane Doe  ',
      album: '',
      genre: '  Podcast ',
      comment: '   ',
      title: 'ignored',
    } as unknown as DefaultTagsInput)
    expect(saved).toEqual({ artist: 'Jane Doe', genre: 'Podcast' })
    expect(getDefaultTags({ config })).toEqual({ artist: 'Jane Doe', genre: 'Podcast' })
  })

  it('parses languages from a CSV string and de-dupes/drops blanks', () => {
    const config = fakeConfig()
    expect(setDefaultTags({ config }, { languages: 'eng, , hun, eng' })).toEqual({
      languages: ['eng', 'hun'],
    })
  })

  it('accepts a languages array as well', () => {
    const config = fakeConfig()
    expect(setDefaultTags({ config }, { languages: ['eng', ' hun ', 'hun'] })).toEqual({
      languages: ['eng', 'hun'],
    })
  })

  it('deletes the row when the sanitized set is empty (save-all-blank ≡ clear)', () => {
    const config = fakeConfig()
    setDefaultTags({ config }, { artist: 'Jane' })
    expect(getDefaultTags({ config })).toEqual({ artist: 'Jane' })
    expect(setDefaultTags({ config }, { artist: '   ', languages: ' , ' })).toEqual({})
    expect(config.get(DEFAULT_TAGS_CONFIG_KEY)).toBeUndefined()
  })

  it('round-trips a full set through get', () => {
    const config = fakeConfig()
    setDefaultTags({ config }, { artist: 'Jane', album: 'Briefing', languages: ['eng'] })
    expect(getDefaultTags({ config })).toEqual({
      artist: 'Jane',
      album: 'Briefing',
      languages: ['eng'],
    })
  })
})

describe('clearDefaultTags', () => {
  it('removes the row and is idempotent', () => {
    const config = fakeConfig()
    setDefaultTags({ config }, { artist: 'Jane' })
    expect(clearDefaultTags({ config })).toEqual({})
    expect(config.get(DEFAULT_TAGS_CONFIG_KEY)).toBeUndefined()
    expect(clearDefaultTags({ config })).toEqual({}) // idempotent
  })
})
