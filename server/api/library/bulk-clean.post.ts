import type { BulkCleanFilter } from '#core'
import { getLibraryService } from '../../utils/container'
import { respondError } from '../../utils/errors'

// POST /api/library/bulk-clean — remove a batch of saved items by date and/or
// voice (FR-037). At least one filter is required; the service rejects an empty
// filter with a 400 so this can never wipe the whole library. Returns the number
// of rows + audio files removed. The UI confirms before calling.
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<BulkCleanFilter>(event)
    const filter: BulkCleanFilter = {
      from: typeof body?.from === 'string' && body.from.trim() ? body.from : undefined,
      to: typeof body?.to === 'string' && body.to.trim() ? body.to : undefined,
      voiceId: typeof body?.voiceId === 'string' && body.voiceId.trim() ? body.voiceId : undefined,
    }
    const service = await getLibraryService()
    return await service.bulkClean(filter)
  } catch (err) {
    return respondError(event, err)
  }
})
