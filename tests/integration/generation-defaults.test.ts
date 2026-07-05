import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteAppConfigRepository } from '../../src/core/settings/app-config-repository'
import {
  getGenerationDefaults,
  setGenerationDefaults,
  clearGenerationDefaults,
  GENERATION_DEFAULTS_CONFIG_KEY,
} from '../../src/core/settings/generation-defaults'

// Integration coverage for store-backed generation defaults (007 · US3): the real
// pipeline the /api/settings/generation-defaults routes run — a file-backed SQLite
// app_config store with Voice/Model/Format/Speed persisted as plain (non-secret) JSON
// alongside the default tags. The thin h3 route envelopes are out of scope here (matching
// the sibling settings-defaults suite); this drives the real core functions the routes
// delegate to.

let dir: string
let config: SqliteAppConfigRepository

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'echorecall-gendefaults-'))
  config = new SqliteAppConfigRepository(join(dir, 'echorecall.db'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('generation defaults — store-backed (007)', () => {
  it('GET returns {} before anything is saved', () => {
    expect(getGenerationDefaults({ config })).toEqual({})
  })

  it('PUT saves the sanitized set, stored as plain JSON, readable from a fresh connection', () => {
    const saved = setGenerationDefaults(
      { config },
      { voiceId: 'alloy', model: 'tts-1', format: 'flac', speed: 1.25 },
    )
    expect(saved).toEqual({ voiceId: 'alloy', model: 'tts-1', format: 'flac', speed: 1.25 })

    // Persisted as plain JSON (non-secret), not encrypted.
    const raw = config.get(GENERATION_DEFAULTS_CONFIG_KEY)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!)).toEqual(saved)

    // A fresh connection to the same DB file reads the same values back (persistence).
    const reopened = new SqliteAppConfigRepository(join(dir, 'echorecall.db'))
    expect(getGenerationDefaults({ config: reopened })).toEqual(saved)
  })

  it('drops out-of-catalog values on PUT', () => {
    const saved = setGenerationDefaults({ config }, { voiceId: 'nope', model: 'tts-1', format: 'zzz' })
    expect(saved).toEqual({ model: 'tts-1' })
    expect(getGenerationDefaults({ config })).toEqual({ model: 'tts-1' })
  })

  it('re-saving with changed values replaces the stored set', () => {
    setGenerationDefaults({ config }, { voiceId: 'alloy', speed: 1 })
    setGenerationDefaults({ config }, { voiceId: 'nova', speed: 2 })
    expect(getGenerationDefaults({ config })).toEqual({ voiceId: 'nova', speed: 2 })
  })

  it('DELETE (and an empty PUT) clears the saved defaults', () => {
    setGenerationDefaults({ config }, { voiceId: 'alloy' })
    expect(clearGenerationDefaults({ config })).toEqual({})
    expect(config.get(GENERATION_DEFAULTS_CONFIG_KEY)).toBeUndefined()
    expect(getGenerationDefaults({ config })).toEqual({})
  })
})
