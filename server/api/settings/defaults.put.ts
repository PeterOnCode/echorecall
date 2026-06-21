import { setDefaultTags, type DefaultTagsInput } from '#core'
import { getAppConfigRepository } from '../../utils/container'
import { respondError } from '../../utils/errors'

// PUT /api/settings/defaults — save (replace) the default tag values (003). Core
// sanitizes the body (Title and unknown fields dropped; an all-blank set clears the
// row) and stores it as plain JSON. Returns the saved set. Non-secret: no app secret,
// no masking, no 409.
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<DefaultTagsInput>(event)
    return { defaultTags: setDefaultTags({ config: getAppConfigRepository() }, body ?? {}) }
  } catch (err) {
    return respondError(event, err)
  }
})
