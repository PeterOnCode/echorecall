import { generateSpeech } from '#core'
import type { Format, Metadata, Model } from '#core'
import { getLibraryService, getTtsProvider } from '../utils/container'
import { respondError } from '../utils/errors'
import { toGenerationDto } from '../utils/serialize'

interface GenerationBody {
  text?: string
  voiceId?: string
  model?: string
  format?: string
  speed?: number
  instructions?: string
  metadata?: Metadata
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<GenerationBody>(event)
    const input = {
      text: body?.text ?? '',
      voiceId: body?.voiceId ?? '',
      model: body?.model,
      format: body?.format,
      speed: body?.speed,
      instructions: body?.instructions,
    }

    // Validation (voice/model/format/length + instructions rule) runs inside
    // generateSpeech before any provider call; the provider is resolved per
    // request (env key today; UI→env precedence lands in US8).
    const bytes = await generateSpeech(getTtsProvider(), input)

    // After validation the model/format are known-good; persist alongside the
    // (untagged in US1) metadata under a dated, slug-named path.
    const entry = await getLibraryService().save(
      {
        text: input.text,
        voiceId: input.voiceId,
        model: (input.model as Model | undefined) ?? null,
        format: input.format as Format | undefined,
        speed: input.speed ?? null,
        metadata: body?.metadata ?? {},
      },
      bytes,
    )

    setResponseStatus(event, 201)
    return toGenerationDto(entry)
  } catch (err) {
    return respondError(event, err)
  }
})
