import { getLibraryService } from '../utils/container'
import { respondError } from '../utils/errors'
import { toGenerationDto } from '../utils/serialize'

// List saved generations newest-first (FR-012). Each entry is serialized to the
// REST shape: the authoritative `path` stays server-side and is surfaced as
// `filename` (basename) plus the `audioUrl` the client uses for replay/download
// and the library editor (US5). The stored file is served by
// GET /api/generations/[id]/audio with no provider call (SC-003).
export default defineEventHandler(async (event) => {
  try {
    const service = await getLibraryService()
    const generations = service.list().map((entry) => toGenerationDto(entry))
    return { generations }
  } catch (err) {
    return respondError(event, err)
  }
})
