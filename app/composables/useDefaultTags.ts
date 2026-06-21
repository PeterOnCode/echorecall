import type { Metadata } from '#core/client'

/** Editable form state for the default-tags Settings section (all strings). */
export interface DefaultTagsForm {
  artist: string
  album: string
  genre: string
  comment: string
  /** Comma-separated ISO 639-2 codes; the server parses + de-dupes them. */
  languages: string
}

function emptyForm(): DefaultTagsForm {
  return { artist: '', album: '', genre: '', comment: '', languages: '' }
}

/** Map the saved Metadata subset into the string-based form. */
function toForm(tags: Metadata): DefaultTagsForm {
  return {
    artist: tags.artist ?? '',
    album: tags.album ?? '',
    genre: tags.genre ?? '',
    comment: tags.comment ?? '',
    languages: (tags.languages ?? []).join(', '),
  }
}

/**
 * Manage the in-app default tag values from Settings (003): load the saved values, save
 * (replace) them, and clear them. Non-secret — stored as plain JSON server-side; the
 * generation form pre-fills from the same `GET /api/settings/defaults` endpoint, so a
 * save here changes the next new generation. Title is never defaulted (no Title field).
 */
export function useDefaultTags() {
  const { t } = useI18n()
  const values = reactive<DefaultTagsForm>(emptyForm())
  const saved = ref<Metadata>({})
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const hasSaved = computed(() => Object.keys(saved.value).length > 0)

  function apply(tags: Metadata) {
    saved.value = tags
    Object.assign(values, toForm(tags))
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      const { defaultTags } = await $fetch<{ defaultTags: Metadata }>('/api/settings/defaults')
      apply(defaultTags ?? {})
    } catch {
      error.value = t('settings.defaultTags.errors.load')
    } finally {
      loading.value = false
    }
  }

  /** Save (replace) the defaults; returns true on success. */
  async function save(): Promise<boolean> {
    saving.value = true
    error.value = null
    try {
      const { defaultTags } = await $fetch<{ defaultTags: Metadata }>('/api/settings/defaults', {
        method: 'PUT',
        body: {
          artist: values.artist,
          album: values.album,
          genre: values.genre,
          comment: values.comment,
          languages: values.languages,
        },
      })
      apply(defaultTags ?? {})
      return true
    } catch {
      error.value = t('settings.defaultTags.errors.save')
      return false
    } finally {
      saving.value = false
    }
  }

  /** Clear the saved defaults; new generations then start blank. */
  async function clear(): Promise<void> {
    if (saving.value) return
    saving.value = true
    error.value = null
    try {
      const { defaultTags } = await $fetch<{ defaultTags: Metadata }>('/api/settings/defaults', {
        method: 'DELETE',
      })
      apply(defaultTags ?? {})
    } catch {
      error.value = t('settings.defaultTags.errors.clear')
    } finally {
      saving.value = false
    }
  }

  return { values, saved, hasSaved, loading, saving, error, load, save, clear }
}
