import { getLibraryService } from '../../utils/container'
import { respondError } from '../../utils/errors'

// POST /api/generations/archive — bundle a batch of saved items into one `.zip`
// (FR-008). Entries are named by each item's filename, duplicates disambiguated;
// unknown ids are skipped (404 only if none resolve). The zip is streamed.
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ ids?: string[] }>(event)
    const ids = Array.isArray(body?.ids) ? body.ids : []
    const service = await getLibraryService()
    const stream = await service.archive(ids)
    setHeader(event, 'Content-Type', 'application/zip')
    setHeader(event, 'Content-Disposition', 'attachment; filename="echorecall-batch.zip"')
    return sendStream(event, stream)
  } catch (err) {
    return respondError(event, err)
  }
})
