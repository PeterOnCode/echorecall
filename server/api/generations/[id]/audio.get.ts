import { getLibraryService } from '../../../utils/container'
import { respondError } from '../../../utils/errors'
import {
  AUDIO_CONTENT_TYPE,
  attachmentDisposition,
  isDownloadRequested,
} from '../../../utils/audio-response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  try {
    const mp3 = await getLibraryService().readAudio(id)
    setHeader(event, 'Content-Type', AUDIO_CONTENT_TYPE)
    // `?download=1` → tell the browser to save the file instead of playing it
    // inline (FR-014). Replay/download both serve the stored file with no
    // provider call (SC-003).
    if (isDownloadRequested(getQuery(event).download)) {
      setHeader(event, 'Content-Disposition', attachmentDisposition(id))
    }
    return mp3
  } catch (err) {
    return respondError(event, err)
  }
})
