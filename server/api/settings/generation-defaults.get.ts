import { getGenerationDefaults } from '#core'
import { getAppConfigRepository } from '../../utils/container'
import { respondError } from '../../utils/errors'

// GET /api/settings/generation-defaults — saved Voice/Model/Format/Speed defaults for the
// Settings form and the Generate-editor resolution (007 · US3). Read from the in-app
// app_config store as plain JSON (non-secret). Unreadable/out-of-catalog data yields a
// clean subset (or {}), so this never 500s.
export default defineEventHandler((event) => {
  try {
    return { generationDefaults: getGenerationDefaults({ config: getAppConfigRepository() }) }
  } catch (err) {
    return respondError(event, err)
  }
})
