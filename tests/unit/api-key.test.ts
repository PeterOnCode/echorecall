import { describe, it, expect } from 'vitest'
import { resolveApiKey, maskKey, OPENAI_KEY_CONFIG_KEY } from '../../src/core/settings/api-key'
import { encryptSecret } from '../../src/core/settings/crypto'
import type { AppConfigRepository } from '../../src/core/settings/app-config-repository'

// Pure unit coverage for the per-request key precedence (US8 / FR-042): a stored
// in-app key (decrypted with NUXT_APP_SECRET) wins over the environment key;
// with none stored, resolution falls back to env, then to undefined. When no app
// secret is configured, in-app storage is disabled, so any stored UI value is
// ignored and resolution uses the env key only (env-only deployments keep working).

const SECRET = 'unit-app-secret'

/** Minimal in-memory AppConfigRepository for the precedence tests. */
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

/** A config holding a UI key encrypted under `secret` (defaults to the real one). */
function withUiKey(plain: string, secret = SECRET): AppConfigRepository {
  return fakeConfig({ [OPENAI_KEY_CONFIG_KEY]: encryptSecret(plain, secret) })
}

describe('resolveApiKey precedence', () => {
  it('prefers the decrypted UI key over the env key', () => {
    expect(resolveApiKey({ config: withUiKey('sk-ui'), appSecret: SECRET, envKey: 'sk-env' })).toBe(
      'sk-ui',
    )
  })

  it('falls back to the env key when no UI key is stored', () => {
    expect(resolveApiKey({ config: fakeConfig(), appSecret: SECRET, envKey: 'sk-env' })).toBe(
      'sk-env',
    )
  })

  it('returns undefined when neither a UI nor an env key is available', () => {
    expect(resolveApiKey({ config: fakeConfig(), appSecret: SECRET })).toBeUndefined()
  })

  it('ignores a stored UI key and uses env when no app secret is configured', () => {
    const config = withUiKey('sk-ui')
    expect(resolveApiKey({ config, appSecret: undefined, envKey: 'sk-env' })).toBe('sk-env')
    expect(resolveApiKey({ config, appSecret: '', envKey: 'sk-env' })).toBe('sk-env')
  })

  it('treats an empty env string as no key', () => {
    expect(resolveApiKey({ config: fakeConfig(), appSecret: SECRET, envKey: '' })).toBeUndefined()
  })

  it('falls back to env when the stored blob cannot be decrypted (rotated secret)', () => {
    const config = withUiKey('sk-ui', 'an-old-secret')
    expect(resolveApiKey({ config, appSecret: SECRET, envKey: 'sk-env' })).toBe('sk-env')
  })
})

describe('maskKey', () => {
  it('masks all but the last four characters and never reveals the key', () => {
    const masked = maskKey('sk-proj-1234567890ABCD')
    expect(masked).not.toContain('sk-proj-1234567890')
    expect(masked.endsWith('ABCD')).toBe(true)
  })

  it('completely masks short keys so they can never leak', () => {
    expect(maskKey('123')).toBe('●●●●')
    expect(maskKey('1234567')).toBe('●●●●')
  })
})
