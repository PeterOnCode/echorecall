import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

// AES-256-GCM authenticated encryption for the in-app OpenAI key (US8 / FR-043).
// The 32-byte key is derived from NUXT_APP_SECRET with scrypt and a fixed,
// non-secret salt, so the same secret always derives the same key (required to
// decrypt without storing the salt). The payload is `iv:authTag:ciphertext`, each
// part base64. GCM's auth tag makes tampering or a wrong secret fail closed.

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12
// Fixed application salt: not a secret (the secret is NUXT_APP_SECRET); it only
// scopes the derived key to this application/version.
const KEY_SALT = 'echorecall:openai-key:v1'

function deriveKey(appSecret: string): Buffer {
  if (!appSecret) {
    // Encryption must never run without a secret; callers gate on this, but fail
    // loudly if one slips through rather than encrypting under an empty key.
    throw new Error('Cannot derive an encryption key without an app secret.')
  }
  return scryptSync(appSecret, KEY_SALT, KEY_BYTES)
}

/** Encrypt `plaintext` to an `iv:authTag:ciphertext` (base64) payload. */
export function encryptSecret(plaintext: string, appSecret: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, deriveKey(appSecret), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(
    ':',
  )
}

/** Decrypt a payload from {@link encryptSecret}; throws on tamper/wrong secret. */
export function decryptSecret(payload: string, appSecret: string): string {
  const parts = payload.split(':')
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted payload.')
  }
  const [ivB64, tagB64, ctB64] = parts
  const decipher = createDecipheriv(ALGORITHM, deriveKey(appSecret), Buffer.from(ivB64!, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64!, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64!, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}
