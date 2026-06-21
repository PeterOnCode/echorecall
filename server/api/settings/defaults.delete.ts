import { clearDefaultTags } from '#core'
import { getAppConfigRepository } from '../../utils/container'
import { respondError } from '../../utils/errors'

// DELETE /api/settings/defaults — clear the saved default tag values (003). After this,
// new generations start with empty tag fields. Returns {}.
export default defineEventHandler((event) => {
  try {
    return { defaultTags: clearDefaultTags({ config: getAppConfigRepository() }) }
  } catch (err) {
    return respondError(event, err)
  }
})
