import { readDefaultTags } from '#core'
import { respondError } from '../../utils/errors'

// GET /api/settings/defaults — non-secret default tag values for pre-filling the
// generation form (US10 / FR-048). Read from NUXT_DEFAULT_TAG_* per request and
// never persisted; Title is never defaulted and invalid/missing config yields an
// empty object, so this never 500s.
export default defineEventHandler((event) => {
  try {
    return { defaultTags: readDefaultTags(process.env) }
  } catch (err) {
    return respondError(event, err)
  }
})
