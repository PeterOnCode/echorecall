import { getLibraryService } from '../utils/container'
import { respondError } from '../utils/errors'

// List saved generations newest-first (FR-012). Each entry is augmented with the
// `audioUrl` the client uses for replay/download; the stored MP3 is served by
// GET /api/generations/[id]/audio with no provider call (SC-003).
export default defineEventHandler(async (event) => {
  try {
    const service = await getLibraryService()
    const generations = service
      .list()
      .map((entry) => ({ ...entry, audioUrl: `/api/generations/${entry.id}/audio` }))
    return { generations }
  } catch (err) {
    return respondError(event, err)
  }
})
