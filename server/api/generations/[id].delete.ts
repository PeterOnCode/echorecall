import { getLibraryService } from '../../utils/container'
import { respondError } from '../../utils/errors'

// Permanently delete a generation and its audio (FR-015). Confirmation is handled
// in the UI before this call. Returns 204 with no body; an unknown id maps to 404.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  try {
    await getLibraryService().delete(id)
    setResponseStatus(event, 204)
    return null
  } catch (err) {
    return respondError(event, err)
  }
})
