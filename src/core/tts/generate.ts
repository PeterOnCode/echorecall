import {
  DomainError,
  EmptyInputError,
  InputTooLongError,
  InvalidVoiceError,
  ProviderUnavailableError,
} from '../shared/errors'
import { isKnownVoice, type TtsProvider } from './provider'

export const MAX_INPUT_LENGTH = 4096

/**
 * Validate input and synthesize speech. Validation runs before the provider is
 * contacted, so invalid requests never hit the network.
 *
 * @returns MP3 audio bytes.
 */
export async function generateSpeech(
  provider: TtsProvider,
  input: { text: string; voiceId: string },
): Promise<Buffer> {
  const text = (input.text ?? '').trim()
  if (text.length === 0) throw new EmptyInputError()
  if (input.text.length > MAX_INPUT_LENGTH) throw new InputTooLongError(MAX_INPUT_LENGTH)
  if (!isKnownVoice(input.voiceId)) throw new InvalidVoiceError(input.voiceId)

  try {
    return await provider.synthesize({ text, voiceId: input.voiceId })
  } catch (err) {
    if (err instanceof DomainError) throw err
    throw new ProviderUnavailableError(err instanceof Error ? err.message : undefined)
  }
}
