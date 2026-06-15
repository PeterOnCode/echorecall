import { describe, it, expect } from 'vitest'
import { generateSpeech, MAX_INPUT_LENGTH } from '../../src/core/tts/generate'
import {
  EmptyInputError,
  InputTooLongError,
  InvalidVoiceError,
  ProviderUnavailableError,
} from '../../src/core/shared/errors'
import type { TtsProvider } from '../../src/core/tts/provider'

const okProvider: TtsProvider = { synthesize: async () => Buffer.from('mp3-bytes') }

describe('generateSpeech', () => {
  it('returns MP3 bytes for valid input', async () => {
    const bytes = await generateSpeech(okProvider, { text: 'hello', voiceId: 'alloy' })
    expect(Buffer.isBuffer(bytes)).toBe(true)
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('rejects empty / whitespace input WITHOUT calling the provider', async () => {
    let called = false
    const spy: TtsProvider = {
      synthesize: async () => {
        called = true
        return Buffer.from('x')
      },
    }
    await expect(generateSpeech(spy, { text: '   ', voiceId: 'alloy' })).rejects.toBeInstanceOf(
      EmptyInputError,
    )
    expect(called).toBe(false)
  })

  it('rejects input over the max length', async () => {
    const long = 'a'.repeat(MAX_INPUT_LENGTH + 1)
    await expect(generateSpeech(okProvider, { text: long, voiceId: 'alloy' })).rejects.toBeInstanceOf(
      InputTooLongError,
    )
  })

  it('accepts input exactly at the max length', async () => {
    const exact = 'a'.repeat(MAX_INPUT_LENGTH)
    await expect(generateSpeech(okProvider, { text: exact, voiceId: 'alloy' })).resolves.toBeTruthy()
  })

  it('rejects an unknown voice', async () => {
    await expect(generateSpeech(okProvider, { text: 'hi', voiceId: 'bogus' })).rejects.toBeInstanceOf(
      InvalidVoiceError,
    )
  })

  it('maps provider failures to ProviderUnavailableError', async () => {
    const failProvider: TtsProvider = {
      synthesize: async () => {
        throw new Error('network down')
      },
    }
    await expect(
      generateSpeech(failProvider, { text: 'hi', voiceId: 'alloy' }),
    ).rejects.toBeInstanceOf(ProviderUnavailableError)
  })
})
