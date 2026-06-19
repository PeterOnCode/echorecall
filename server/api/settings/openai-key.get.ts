import { getKeyStatus } from '#core'
import { getAppConfigRepository } from '../../utils/container'
import { respondError } from '../../utils/errors'

// GET /api/settings/openai-key — masked status only (FR-041). Reports the active
// source (ui/env/none) and whether in-app storage is enabled (NUXT_APP_SECRET);
// the plaintext key is never returned.
export default defineEventHandler((event) => {
  try {
    const config = useRuntimeConfig()
    return getKeyStatus({
      config: getAppConfigRepository(),
      appSecret: (config.appSecret as string) || undefined,
      envKey: (config.openaiApiKey as string) || undefined,
    })
  } catch (err) {
    return respondError(event, err)
  }
})
