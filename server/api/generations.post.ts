import { generateSpeech } from '#core'
import { getLibraryService, getTtsProvider } from '../utils/container'
import { respondError } from '../utils/errors'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ text?: string; voiceId?: string }>(event)
    const input = { text: body?.text ?? '', voiceId: body?.voiceId ?? '' }

    const mp3 = await generateSpeech(getTtsProvider(), input)
    const entry = await getLibraryService().save(input, mp3)

    setResponseStatus(event, 201)
    return { ...entry, audioUrl: `/api/generations/${entry.id}/audio` }
  } catch (err) {
    return respondError(event, err)
  }
})
