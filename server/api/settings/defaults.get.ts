import { getDefaultTags } from '#core'
import { getAppConfigRepository } from '../../utils/container'
import { respondError } from '../../utils/errors'

// GET /api/settings/defaults — saved default tag values for the Settings form and the
// generation-form pre-fill (003). Read from the in-app app_config store (no longer from
// NUXT_DEFAULT_TAG_*). Title is never returned and unreadable data yields {}, so this
// never 500s.
export default defineEventHandler((event) => {
  try {
    return { defaultTags: getDefaultTags({ config: getAppConfigRepository() }) }
  } catch (err) {
    return respondError(event, err)
  }
})
