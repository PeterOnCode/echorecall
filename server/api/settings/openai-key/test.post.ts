import OpenAI from 'openai'
import { testApiKey } from '#core'
import { getAppConfigRepository } from '../../../utils/container'
import { respondError } from '../../../utils/errors'

// POST /api/settings/openai-key/test — verify the active resolved key (FR-044).
// Returns only `{ ok }`; the key is never echoed and failures carry no detail.
export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
    return await testApiKey(
      {
        config: getAppConfigRepository(),
        appSecret: (config.appSecret as string) || undefined,
        envKey: (config.openaiApiKey as string) || undefined,
      },
      async (apiKey) => {
        // A lightweight authenticated call: it succeeds with a usable key and
        // throws on an invalid one (caught by testApiKey → ok:false). A short
        // timeout keeps an unresponsive OpenAI from hanging the handler.
        await new OpenAI({ apiKey, timeout: 10_000 }).models.list()
        return true
      },
    )
  } catch (err) {
    return respondError(event, err)
  }
})
