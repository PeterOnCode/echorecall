/**
 * Masked status of the in-app OpenAI key, as served by the Settings API. The
 * plaintext key is never returned (FR-041); the UI only ever sees this shape.
 */
export interface OpenAiKeyStatus {
  configured: boolean
  masked?: string
  source: 'ui' | 'env' | 'none'
  secretConfigured: boolean
}

/** Pull the stable domain error code out of an `$fetch` failure, if any. */
function errorCode(err: unknown): string | undefined {
  return (err as { data?: { error?: { code?: string } } })?.data?.error?.code
}

/**
 * Manage the in-app OpenAI key from Settings (US8 / FR-041–045): load the masked
 * status, set/replace it (write-only — the plaintext is never read back), clear
 * it (reverting to the env key), and test the active key. When in-app storage is
 * disabled (no NUXT_APP_SECRET) the status reports `secretConfigured:false` and a
 * `PUT` is rejected with a clear message; the env key (if any) still works.
 */
export function useSettings() {
  const { t } = useI18n()
  const status = ref<OpenAiKeyStatus | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const testing = ref(false)
  const testResult = ref<boolean | null>(null)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      status.value = await $fetch<OpenAiKeyStatus>('/api/settings/openai-key')
    } catch {
      error.value = t('settings.openaiKey.errors.load')
    } finally {
      loading.value = false
    }
  }

  /** Store (encrypted) a new key; returns true on success so the caller can clear its input. */
  async function setKey(key: string): Promise<boolean> {
    saving.value = true
    error.value = null
    testResult.value = null
    try {
      status.value = await $fetch<OpenAiKeyStatus>('/api/settings/openai-key', {
        method: 'PUT',
        body: { key },
      })
      return true
    } catch (err) {
      error.value =
        errorCode(err) === 'KEY_STORAGE_DISABLED'
          ? t('settings.openaiKey.errors.disabled')
          : t('settings.openaiKey.errors.save')
      return false
    } finally {
      saving.value = false
    }
  }

  /** Clear the in-app key, reverting to the env key. */
  async function clearKey(): Promise<void> {
    saving.value = true
    error.value = null
    testResult.value = null
    try {
      status.value = await $fetch<OpenAiKeyStatus>('/api/settings/openai-key', { method: 'DELETE' })
    } catch {
      error.value = t('settings.openaiKey.errors.clear')
    } finally {
      saving.value = false
    }
  }

  /** Test the active resolved key; sets `testResult` to whether it works. */
  async function testKey(): Promise<void> {
    testing.value = true
    error.value = null
    testResult.value = null
    try {
      const res = await $fetch<{ ok: boolean }>('/api/settings/openai-key/test', { method: 'POST' })
      testResult.value = res.ok
    } catch {
      testResult.value = false
    } finally {
      testing.value = false
    }
  }

  return { status, loading, saving, testing, testResult, error, load, setKey, clearKey, testKey }
}
