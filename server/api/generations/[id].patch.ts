import { skippedFields } from '#core'
import type { Generation, Metadata } from '#core'
import { getLibraryService } from '../../utils/container'
import { respondError } from '../../utils/errors'
import { toGenerationDto } from '../../utils/serialize'

interface PatchBody {
  filename?: string
  metadata?: Metadata
}

// Rename and/or retag a saved item without re-synthesis (FR-030/031). Both parts
// are optional and composable: a metadata edit re-tags the stored file and
// persists the new set; a filename edit re-slugs + moves the file (the title is
// never used to rename). Returns the updated entry with the FINAL filename and,
// when metadata changed, the per-format `skippedTags` notice (FR-021). Domain
// errors map to their codes (INVALID_FILENAME 400 / NOT_FOUND 404 /
// TAGGING_FAILED 502) via respondError; on those the stored file is left intact.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  try {
    const body = (await readBody<PatchBody>(event)) ?? {}
    const service = await getLibraryService()

    // Retag before rename so a title change in the metadata can't be mistaken for
    // a rename; `updateMetadata`/`rename` each 404 on an unknown id.
    let updated: Generation =
      body.metadata !== undefined
        ? await service.updateMetadata(id, body.metadata)
        : service.get(id)
    if (body.filename !== undefined) {
      updated = await service.rename(id, body.filename)
    }

    // The skipped-tags notice is a pure function of the final format + tag set, so
    // it is reported only when metadata was edited in this request.
    const skippedTags =
      body.metadata !== undefined ? skippedFields(updated.format, body.metadata) : undefined
    return toGenerationDto(updated, skippedTags)
  } catch (err) {
    return respondError(event, err)
  }
})
