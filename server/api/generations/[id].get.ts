import { getLibraryService } from '../../utils/container'
import { respondError } from '../../utils/errors'
import { toGenerationDto } from '../../utils/serialize'

// 006 · bulk-edit data-loss guard — return a single recording's REST shape (incl. its
// full embedded metadata) so a cross-page bulk tag edit can read, and preserve, the
// OTHER tags of rows that aren't on the loaded page. Without this a wholesale retag
// carrying only the edited field would wipe those rows' remaining tags. Read-only; the
// authoritative `path` stays server-side (surfaced as `filename` + `audioUrl`), and the
// audio bytes are still served by GET /api/generations/[id]/audio.
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id') ?? ''
    const service = await getLibraryService()
    const generation = service.get(id) // throws NotFoundError → 404 via respondError
    return toGenerationDto(generation, undefined, await service.audioPropertiesFor(generation))
  } catch (err) {
    return respondError(event, err)
  }
})
