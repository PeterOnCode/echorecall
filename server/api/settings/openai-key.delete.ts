import { clearUiKey } from '#core'
import { getAppConfigRepository } from '../../utils/container'
import { respondError } from '../../utils/errors'

// DELETE /api/settings/openai-key — clear the in-app key, reverting resolution to
// the environment key (FR-042). Returns the resulting masked status.
export default defineEventHandler((event) => {
  try {
    const config = useRuntimeConfig()
    return clearUiKey({
      config: getAppConfigRepository(),
      appSecret: (config.appSecret as string) || undefined,
      envKey: (config.openaiApiKey as string) || undefined,
    })
  } catch (err) {
    return respondError(event, err)
  }
})
