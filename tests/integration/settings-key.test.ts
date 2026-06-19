import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteAppConfigRepository } from '../../src/core/settings/app-config-repository'
import {
  resolveApiKey,
  getKeyStatus,
  setUiKey,
  clearUiKey,
  testApiKey,
  OPENAI_KEY_CONFIG_KEY,
} from '../../src/core/settings/api-key'
import { DomainError, NoApiKeyError } from '../../src/core/shared/errors'
import { respondError } from '../../server/utils/errors'

// Integration coverage for the in-app OpenAI key (US8 / FR-041–045), exercising
// the real pipeline the Settings routes run: a file-backed SQLite app_config
// store + AES-256-GCM crypto + per-request resolution + the shared error mapper.
// The thin h3 route envelopes are out of scope for this plain-Node suite (matching
// the other integration tests); rejections are mapped through the real respondError
// to confirm the HTTP status the client would observe.

const APP_SECRET = 'integration-app-secret'
const PLAINTEXT = 'sk-proj-integration-secret-key-1234'

function mapError(err: unknown): { status: number; code: string } {
  const event = { node: { res: { statusCode: 200 } } }
  const body = respondError(event, err)
  return { status: event.node.res.statusCode, code: body.error.code }
}

let dir: string
let config: SqliteAppConfigRepository

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'echorecall-key-'))
  config = new SqliteAppConfigRepository(join(dir, 'echorecall.db'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('in-app OpenAI key — with NUXT_APP_SECRET configured', () => {
  it('PUT then GET shows a masked UI status and stores the key encrypted at rest', () => {
    const put = setUiKey({ config, appSecret: APP_SECRET }, PLAINTEXT)
    expect(put).toMatchObject({ configured: true, source: 'ui', secretConfigured: true })
    expect(put.masked).toBeTruthy()
    expect(put.masked).not.toContain(PLAINTEXT)

    const get = getKeyStatus({ config, appSecret: APP_SECRET })
    expect(get).toMatchObject({ configured: true, source: 'ui', secretConfigured: true })

    // Encrypted at rest: the raw stored value is ciphertext, never the plaintext.
    const stored = config.get(OPENAI_KEY_CONFIG_KEY)
    expect(stored).toBeTruthy()
    expect(stored).not.toContain(PLAINTEXT)
    expect(stored).toContain(':')

    // The plaintext key never appears in any serialized status (FR-041/043).
    expect(JSON.stringify(get)).not.toContain(PLAINTEXT)
  })

  it('uses the UI key for resolution, taking precedence over the env key', () => {
    setUiKey({ config, appSecret: APP_SECRET }, PLAINTEXT)
    expect(resolveApiKey({ config, appSecret: APP_SECRET, envKey: 'sk-env' })).toBe(PLAINTEXT)
  })

  it('DELETE clears the UI key and reverts resolution + status to the env key', () => {
    setUiKey({ config, appSecret: APP_SECRET }, PLAINTEXT)
    const cleared = clearUiKey({ config, appSecret: APP_SECRET, envKey: 'sk-env' })
    expect(cleared).toMatchObject({ configured: true, source: 'env' })
    expect(config.get(OPENAI_KEY_CONFIG_KEY)).toBeUndefined()
    expect(resolveApiKey({ config, appSecret: APP_SECRET, envKey: 'sk-env' })).toBe('sk-env')
  })

  it('GET reports source "none" when neither a UI nor an env key exists', () => {
    expect(getKeyStatus({ config, appSecret: APP_SECRET })).toMatchObject({
      configured: false,
      source: 'none',
      secretConfigured: true,
    })
  })

  it('tests the active resolved key and reports ok without leaking the key', async () => {
    setUiKey({ config, appSecret: APP_SECRET }, PLAINTEXT)
    let seen: string | undefined
    const ok = await testApiKey({ config, appSecret: APP_SECRET }, async (key) => {
      seen = key
      return true
    })
    expect(ok).toEqual({ ok: true })
    expect(seen).toBe(PLAINTEXT) // the *active* key is the one verified

    // A failing verification reports ok:false and carries no key details.
    const bad = await testApiKey({ config, appSecret: APP_SECRET }, async () => {
      throw new Error('401 Unauthorized')
    })
    expect(bad).toEqual({ ok: false })
  })

  it('reports ok:false for a test when no key is configured (verifier never called)', async () => {
    let called = false
    const res = await testApiKey({ config, appSecret: APP_SECRET }, async () => {
      called = true
      return true
    })
    expect(res).toEqual({ ok: false })
    expect(called).toBe(false)
  })
})

describe('in-app OpenAI key — without NUXT_APP_SECRET (storage disabled)', () => {
  it('GET reports secretConfigured:false and still surfaces the env key', () => {
    expect(getKeyStatus({ config, appSecret: undefined, envKey: 'sk-env' })).toMatchObject({
      configured: true,
      source: 'env',
      secretConfigured: false,
    })
  })

  it('PUT is rejected with 409 KEY_STORAGE_DISABLED and stores nothing', () => {
    let err: unknown
    try {
      setUiKey({ config, appSecret: undefined }, PLAINTEXT)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(DomainError)
    expect(mapError(err)).toEqual({ status: 409, code: 'KEY_STORAGE_DISABLED' })
    expect(config.get(OPENAI_KEY_CONFIG_KEY)).toBeUndefined()
  })

  it('ignores any previously-stored UI value and resolves the env key', () => {
    // Simulate a key stored while a secret existed, then the secret removed.
    config.set(OPENAI_KEY_CONFIG_KEY, 'whatever-was-here')
    expect(resolveApiKey({ config, appSecret: undefined, envKey: 'sk-env' })).toBe('sk-env')
  })
})

describe('generation with no key anywhere (FR-045)', () => {
  it('resolves to undefined and maps to a 400 NO_API_KEY (nothing generated/saved)', () => {
    expect(resolveApiKey({ config, appSecret: APP_SECRET })).toBeUndefined()
    // The generate path turns an unresolved key into NoApiKeyError before any
    // provider call or save, so nothing is ever persisted.
    expect(mapError(new NoApiKeyError())).toEqual({ status: 400, code: 'NO_API_KEY' })
  })
})
