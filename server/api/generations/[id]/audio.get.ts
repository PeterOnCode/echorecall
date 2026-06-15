import { getLibraryService } from '../../../utils/container'
import { respondError } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  try {
    const mp3 = await getLibraryService().readAudio(id)
    setHeader(event, 'Content-Type', 'audio/mpeg')
    return mp3
  } catch (err) {
    return respondError(event, err)
  }
})
