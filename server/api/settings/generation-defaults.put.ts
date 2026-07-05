import { setGenerationDefaults, type GenerationDefaultsInput } from '#core'
import { getAppConfigRepository } from '../../utils/container'
import { respondError } from '../../utils/errors'

// PUT /api/settings/generation-defaults — save (replace) the generation defaults (007 · US3).
// Core sanitizes the body (out-of-catalog voice/model/format dropped, speed clamped, an
// all-blank set clears the row) and stores it as plain JSON. Returns the saved set.
// Non-secret: no app secret, no masking, no 409.
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<GenerationDefaultsInput>(event)
    return { generationDefaults: setGenerationDefaults({ config: getAppConfigRepository() }, body ?? {}) }
  } catch (err) {
    return respondError(event, err)
  }
})
