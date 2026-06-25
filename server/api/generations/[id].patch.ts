import { skippedFields } from '#core'
import type { Metadata } from '#core'
import { getLibraryService } from '../../utils/container'
import { respondError } from '../../utils/errors'
import { toGenerationDto } from '../../utils/serialize'

interface PatchBody {
  filename?: string
  // `Metadata` now carries the 006 · R-TAGS extra editable fields (notes/encodedBy/
  // albumArtist/composer/bpm/rating); they flow through updateMetadata → the taglib
  // mapping + the SQLite `tags_extra` mirror unchanged (no new column/migration).
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

    // Atomic combined edit: the filename is validated (INVALID_FILENAME) up front, then
    // the retag runs BEFORE the rename so a tagging failure leaves the file, its name,
    // and the tags all untouched — never a partial success where the file was renamed
    // but the request errored. The title is never used to rename (only the explicit
    // `filename` field). Unknown id → 404.
    const updated = await service.update(id, { filename: body.filename, metadata: body.metadata })

    // The skipped-tags notice is a pure function of the final format + tag set, so
    // it is reported only when metadata was edited in this request.
    const skippedTags =
      body.metadata !== undefined ? skippedFields(updated.format, body.metadata) : undefined
    return toGenerationDto(updated, skippedTags)
  } catch (err) {
    return respondError(event, err)
  }
})
