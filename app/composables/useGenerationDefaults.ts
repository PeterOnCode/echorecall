import type { Format, Model } from '#core/client'

/**
 * The configured Voice/Model/Format defaults, mirrored client-side. Structurally matches
 * the server's `GenerationDefaults`; kept local so this browser composable never imports
 * the server core barrel. An unset field means "no configured default".
 */
export interface GenerationDefaults {
  voiceId?: string
  model?: Model
  format?: Format
}

/** Editable form state for generation defaults; catalog ids are joined by '' as the unset sentinel. */
export interface GenerationDefaultsForm {
  voiceId: string
  model: Model | ''
  format: Format | ''
}

export type GenerationDefaultField = 'voiceId' | 'model' | 'format'

function emptyForm(): GenerationDefaultsForm {
  return { voiceId: '', model: '', format: '' }
}

/** Map the saved defaults into the string-based form. */
function toForm(d: GenerationDefaults): GenerationDefaultsForm {
  return {
    voiceId: d.voiceId ?? '',
    model: d.model ?? '',
    format: d.format ?? '',
  }
}

/**
 * Manage the in-app generation defaults from Settings (007 · US3): load the saved values,
 * save (replace) them, clear them, and reset a single field. Non-secret — stored as plain
 * JSON server-side alongside the default tags; the Generate editor resolves the same
 * `GET /api/settings/generation-defaults`, so a save here changes future sessions' fallback.
 */
export function useGenerationDefaults() {
  const { t } = useI18n()
  const values = reactive<GenerationDefaultsForm>(emptyForm())
  const saved = ref<GenerationDefaults>({})
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const hasSaved = computed(() => Object.keys(saved.value).length > 0)

  function apply(d: GenerationDefaults) {
    saved.value = d
    Object.assign(values, toForm(d))
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      const { generationDefaults } = await $fetch<{ generationDefaults: GenerationDefaults }>(
        '/api/settings/generation-defaults',
      )
      apply(generationDefaults ?? {})
    } catch {
      error.value = t('settings.generationDefaults.errors.load')
    } finally {
      loading.value = false
    }
  }

  /** Save (replace) the defaults; returns true on success. Blank fields are omitted. */
  async function save(): Promise<boolean> {
    saving.value = true
    error.value = null
    try {
      const { generationDefaults } = await $fetch<{ generationDefaults: GenerationDefaults }>(
        '/api/settings/generation-defaults',
        {
          method: 'PUT',
          body: {
            voiceId: values.voiceId || undefined,
            model: values.model || undefined,
            format: values.format || undefined,
          },
        },
      )
      apply(generationDefaults ?? {})
      return true
    } catch {
      error.value = t('settings.generationDefaults.errors.save')
      return false
    } finally {
      saving.value = false
    }
  }

  /** Clear all saved defaults; the editor then falls back to built-ins. */
  async function clear(): Promise<void> {
    if (saving.value) return
    saving.value = true
    error.value = null
    try {
      const { generationDefaults } = await $fetch<{ generationDefaults: GenerationDefaults }>(
        '/api/settings/generation-defaults',
        { method: 'DELETE' },
      )
      apply(generationDefaults ?? {})
    } catch {
      error.value = t('settings.generationDefaults.errors.clear')
    } finally {
      saving.value = false
    }
  }

  /** Reset a single field to unset in the form (persisted on the next Save). */
  function resetField(field: GenerationDefaultField): void {
    values[field] = ''
  }

  return { values, saved, hasSaved, loading, saving, error, load, save, clear, resetField }
}
