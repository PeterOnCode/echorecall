import { describe, it, expect } from 'vitest'
import {
  getGenerationDefaults,
  setGenerationDefaults,
  clearGenerationDefaults,
  GENERATION_DEFAULTS_CONFIG_KEY,
  type GenerationDefaultsInput,
} from '../../src/core/settings/generation-defaults'
import type { AppConfigRepository } from '../../src/core/settings/app-config-repository'

// Pure unit coverage for the store-backed generation defaults (007 · US3 / G-DEFAULTS,
// FR-011/012/013). Non-secret: persisted as plain JSON in app_config alongside the
// default tags, no crypto/app secret. Sanitization drops unknown voice/model/format
// (validated against the shared catalogs), clamps speed to the provider range, and an
// all-blank/all-invalid save clears the row. Reads are total — a corrupt row yields {}.

/** Minimal in-memory AppConfigRepository for the generation-defaults tests. */
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

describe('getGenerationDefaults', () => {
  it('returns {} when no row is stored', () => {
    expect(getGenerationDefaults({ config: fakeConfig() })).toEqual({})
  })

  it('returns {} (never throws) for a corrupt/invalid JSON row', () => {
    const config = fakeConfig({ [GENERATION_DEFAULTS_CONFIG_KEY]: 'not-json{' })
    expect(getGenerationDefaults({ config })).toEqual({})
  })

  it('re-sanitizes a stored row, dropping unknown voice/model/format and clamping speed', () => {
    const config = fakeConfig({
      [GENERATION_DEFAULTS_CONFIG_KEY]: JSON.stringify({
        voiceId: 'nope',
        model: 'tts-1',
        format: 'zzz',
        speed: 99,
        bogus: 'x',
      }),
    })
    // voiceId 'nope' and format 'zzz' are not in the catalogs → dropped; speed clamps to 4.
    expect(getGenerationDefaults({ config })).toEqual({ model: 'tts-1', speed: 4 })
  })
})

describe('setGenerationDefaults', () => {
  it('keeps known voice/model/format and clamps speed to the provider range', () => {
    const config = fakeConfig()
    const saved = setGenerationDefaults({ config }, {
      voiceId: 'alloy',
      model: 'tts-1-hd',
      format: 'flac',
      speed: 0.1, // below the 0.25 floor
    })
    expect(saved).toEqual({ voiceId: 'alloy', model: 'tts-1-hd', format: 'flac', speed: 0.25 })
    expect(getGenerationDefaults({ config })).toEqual(saved)
  })

  it('drops unknown values (out-of-catalog voice/model/format, non-numeric speed)', () => {
    const config = fakeConfig()
    expect(
      setGenerationDefaults({ config }, {
        voiceId: 'nope',
        model: 'bad',
        format: 'zzz',
        speed: 'fast',
      } as unknown as GenerationDefaultsInput),
    ).toEqual({})
    expect(config.get(GENERATION_DEFAULTS_CONFIG_KEY)).toBeUndefined()
  })

  it('persists a single valid field on its own (speed only)', () => {
    const config = fakeConfig()
    expect(setGenerationDefaults({ config }, { speed: 2 })).toEqual({ speed: 2 })
    expect(getGenerationDefaults({ config })).toEqual({ speed: 2 })
  })

  it('deletes the row when the sanitized set is empty (save-all-blank ≡ clear)', () => {
    const config = fakeConfig()
    setGenerationDefaults({ config }, { voiceId: 'alloy' })
    expect(getGenerationDefaults({ config })).toEqual({ voiceId: 'alloy' })
    expect(setGenerationDefaults({ config }, {})).toEqual({})
    expect(config.get(GENERATION_DEFAULTS_CONFIG_KEY)).toBeUndefined()
  })

  it('round-trips a full set through get', () => {
    const config = fakeConfig()
    setGenerationDefaults({ config }, { voiceId: 'nova', model: 'gpt-4o-mini-tts', format: 'mp3', speed: 1.5 })
    expect(getGenerationDefaults({ config })).toEqual({
      voiceId: 'nova',
      model: 'gpt-4o-mini-tts',
      format: 'mp3',
      speed: 1.5,
    })
  })
})

describe('clearGenerationDefaults', () => {
  it('removes the row and is idempotent', () => {
    const config = fakeConfig()
    setGenerationDefaults({ config }, { voiceId: 'alloy' })
    expect(clearGenerationDefaults({ config })).toEqual({})
    expect(config.get(GENERATION_DEFAULTS_CONFIG_KEY)).toBeUndefined()
    expect(clearGenerationDefaults({ config })).toEqual({}) // idempotent
  })
})
