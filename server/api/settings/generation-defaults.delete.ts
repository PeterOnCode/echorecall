import { clearGenerationDefaults } from '#core'
import { getAppConfigRepository } from '../../utils/container'
import { respondError } from '../../utils/errors'

// DELETE /api/settings/generation-defaults — clear the saved generation defaults (007 · US3).
// After this, the Generate editor falls back to its built-in Voice/Model/Format/Speed.
// Returns {}.
export default defineEventHandler((event) => {
  try {
    return { generationDefaults: clearGenerationDefaults({ config: getAppConfigRepository() }) }
  } catch (err) {
    return respondError(event, err)
  }
})
