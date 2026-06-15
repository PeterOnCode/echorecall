import OpenAI from 'openai'
import type { SpeechCreateParams } from 'openai/resources/audio/speech'
import type { TtsProvider } from './provider'

export interface OpenAiTtsConfig {
  apiKey: string
  /** Defaults to `gpt-4o-mini-tts`. */
  model?: string
}

/** OpenAI TTS adapter. The only place the OpenAI network call lives. */
export class OpenAiTtsProvider implements TtsProvider {
  private readonly client: OpenAI
  private readonly model: string

  constructor(config: OpenAiTtsConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey })
    this.model = config.model ?? 'gpt-4o-mini-tts'
  }

  async synthesize(input: { text: string; voiceId: string }): Promise<Buffer> {
    // voiceId is validated against our catalog (which mirrors OpenAI's voices)
    // before this adapter is reached; cast to the SDK's narrower union.
    const response = await this.client.audio.speech.create({
      model: this.model,
      voice: input.voiceId as SpeechCreateParams['voice'],
      input: input.text,
      response_format: 'mp3',
    })
    return Buffer.from(await response.arrayBuffer())
  }
}
