import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteAppConfigRepository } from '../../src/core/settings/app-config-repository'
import {
  getDefaultTags,
  setDefaultTags,
  clearDefaultTags,
  DEFAULT_TAGS_CONFIG_KEY,
  type DefaultTagsInput,
} from '../../src/core/settings/default-tags'

// Integration coverage for store-backed default tag values (003): the real pipeline the
// /api/settings/defaults routes run — a file-backed SQLite app_config store with the
// values persisted as plain (non-secret) JSON. The NUXT_DEFAULT_TAG_* env vars are no
// longer a source. The thin h3 route envelopes are out of scope here (matching the other
// integration suites); this drives the real core functions the routes delegate to.

let dir: string
let config: SqliteAppConfigRepository

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'echorecall-defaults-'))
  config = new SqliteAppConfigRepository(join(dir, 'echorecall.db'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('default tag values — store-backed (003)', () => {
  it('GET returns {} before anything is saved', () => {
    expect(getDefaultTags({ config })).toEqual({})
  })

  it('PUT saves the sanitized set, stored as plain JSON, readable from a fresh connection', () => {
    const saved = setDefaultTags(
      { config },
      { artist: '  Jane Doe  ', genre: 'Podcast', languages: 'eng, hun, eng' },
    )
    expect(saved).toEqual({ artist: 'Jane Doe', genre: 'Podcast', languages: ['eng', 'hun'] })

    // Persisted as plain JSON (non-secret), not encrypted.
    const raw = config.get(DEFAULT_TAGS_CONFIG_KEY)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!)).toEqual(saved)

    // A fresh connection to the same DB file reads the same values back (persistence).
    const reopened = new SqliteAppConfigRepository(join(dir, 'echorecall.db'))
    expect(getDefaultTags({ config: reopened })).toEqual(saved)
  })

  it('never stores a Title, even when one is supplied', () => {
    setDefaultTags({ config }, { artist: 'Jane', title: 'nope' } as unknown as DefaultTagsInput)
    expect(getDefaultTags({ config }).title).toBeUndefined()
    expect(getDefaultTags({ config })).toEqual({ artist: 'Jane' })
  })

  it('re-saving with changed values replaces the stored set', () => {
    setDefaultTags({ config }, { artist: 'Jane', genre: 'Podcast' })
    setDefaultTags({ config }, { artist: 'Jane', genre: 'Audiobook' })
    expect(getDefaultTags({ config })).toEqual({ artist: 'Jane', genre: 'Audiobook' })
  })

  it('DELETE clears the saved defaults and GET is empty again', () => {
    setDefaultTags({ config }, { artist: 'Jane' })
    expect(clearDefaultTags({ config })).toEqual({})
    expect(config.get(DEFAULT_TAGS_CONFIG_KEY)).toBeUndefined()
    expect(getDefaultTags({ config })).toEqual({})
  })
})
