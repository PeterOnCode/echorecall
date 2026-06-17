import { getLibraryService } from '../../../utils/container'
import { respondError } from '../../../utils/errors'
import {
  attachmentDisposition,
  contentTypeFor,
  isDownloadRequested,
} from '../../../utils/audio-response'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  try {
    const service = getLibraryService()
    // Resolve the row first (404 if unknown) so we can set the right media type
    // for the stored format (FR-019/SC); then stream the bytes by stored path.
    const generation = service.get(id)
    const bytes = await service.readAudio(id)
    setHeader(event, 'Content-Type', contentTypeFor(generation.format))
    // `?download=1` → tell the browser to save the file instead of playing it
    // inline (FR-014). Replay/download both serve the stored file with no
    // provider call (SC-003). The real-filename download lands in US4.
    if (isDownloadRequested(getQuery(event).download)) {
      setHeader(event, 'Content-Disposition', attachmentDisposition(id))
    }
    return bytes
  } catch (err) {
    return respondError(event, err)
  }
})
