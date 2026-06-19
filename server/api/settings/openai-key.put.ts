import { setUiKey } from '#core'
import { getAppConfigRepository } from '../../utils/container'
import { respondError } from '../../utils/errors'

interface KeyBody {
  key?: string
}

// PUT /api/settings/openai-key — store the key encrypted at rest (FR-043) and
// return only its masked status. 409 KEY_STORAGE_DISABLED when NUXT_APP_SECRET is
// unset (nothing stored; the env key remains in use).
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<KeyBody>(event)
    const config = useRuntimeConfig()
    return setUiKey(
      {
        config: getAppConfigRepository(),
        appSecret: (config.appSecret as string) || undefined,
        envKey: (config.openaiApiKey as string) || undefined,
      },
      body?.key ?? '',
    )
  } catch (err) {
    return respondError(event, err)
  }
})
