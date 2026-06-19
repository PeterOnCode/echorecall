import { describe, it, expect } from 'vitest'
import { encryptSecret, decryptSecret } from '../../src/core/settings/crypto'

// AES-256-GCM secret encryption (US8 / FR-043): the in-app OpenAI key is stored
// encrypted at rest under a 32-byte key derived from NUXT_APP_SECRET. These pure
// unit tests pin the round-trip, the authenticated-encryption tamper check, and
// the wrong-secret failure — no DB, no network.

const SECRET = 'a-test-app-secret-value'

describe('encryptSecret / decryptSecret (AES-256-GCM)', () => {
  it('round-trips a plaintext secret', () => {
    const plain = 'sk-proj-abcdef0123456789'
    expect(decryptSecret(encryptSecret(plain, SECRET), SECRET)).toBe(plain)
  })

  it('emits an iv:authTag:ciphertext payload that never contains the plaintext', () => {
    const plain = 'sk-proj-super-secret-key'
    const payload = encryptSecret(plain, SECRET)
    expect(payload).not.toContain(plain)
    expect(payload.split(':')).toHaveLength(3)
  })

  it('uses a random IV so the same plaintext encrypts differently each time', () => {
    const plain = 'sk-same-input'
    expect(encryptSecret(plain, SECRET)).not.toBe(encryptSecret(plain, SECRET))
  })

  it('fails to decrypt a payload tampered after encryption (GCM auth tag)', () => {
    const [iv, tag, ct] = encryptSecret('sk-tamper-me', SECRET).split(':')
    // Flip the first ciphertext char to a different base64 char so the decoded
    // bytes change and the GCM authentication fails closed.
    const flipped = (ct![0] === 'A' ? 'B' : 'A') + ct!.slice(1)
    expect(() => decryptSecret(`${iv}:${tag}:${flipped}`, SECRET)).toThrow()
  })

  it('fails to decrypt with the wrong app secret', () => {
    const payload = encryptSecret('sk-wrong-secret', SECRET)
    expect(() => decryptSecret(payload, 'a-different-secret')).toThrow()
  })

  it('rejects a structurally malformed payload', () => {
    expect(() => decryptSecret('not-a-valid-payload', SECRET)).toThrow()
  })
})
