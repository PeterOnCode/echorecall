<script setup lang="ts">
import type { Metadata } from '#core/client'

// Editor for the full, standards-oriented tag set (US2 / FR-018): scalar fields,
// multi-value `languages`, and repeatable `customText` / `customUrl`. Controlled
// via v-model; every edit emits a fresh Metadata object (immutable update) so the
// owner (form-level defaults, queue row, or library item) stays the source of
// truth. Saving replaces the whole set — clearing a field removes it (FR-023).
const model = defineModel<Metadata>({ required: true })
const { t } = useI18n()

/** A computed bound to one scalar field that drops the key when cleared. */
function scalar(key: 'title' | 'artist' | 'album' | 'genre' | 'comment' | 'recordedAt' | 'track') {
  return computed<string>({
    get: () => model.value[key] ?? '',
    // Clearing a field removes it (FR-023): set undefined, which the JSON clone in
    // useQueue drops before the row is sent.
    set: (value: string) => {
      model.value = { ...model.value, [key]: value === '' ? undefined : value }
    },
  })
}

const scalarFields = [
  { key: 'title', test: 'meta-title' },
  { key: 'artist', test: 'meta-artist' },
  { key: 'album', test: 'meta-album' },
  { key: 'genre', test: 'meta-genre' },
  { key: 'recordedAt', test: 'meta-recordedAt' },
  { key: 'track', test: 'meta-track' },
] as const

const title = scalar('title')
const artist = scalar('artist')
const album = scalar('album')
const genre = scalar('genre')
const comment = scalar('comment')
const recordedAt = scalar('recordedAt')
const track = scalar('track')
const bound = { title, artist, album, genre, recordedAt, track }

// Languages (multi-value, ID3 TLAN).
const newLanguage = ref('')
function addLanguage() {
  const value = newLanguage.value.trim()
  if (!value) return
  model.value = { ...model.value, languages: [...(model.value.languages ?? []), value] }
  newLanguage.value = ''
}
function removeLanguage(index: number) {
  const languages = [...(model.value.languages ?? [])]
  languages.splice(index, 1)
  model.value = { ...model.value, languages: languages.length ? languages : undefined }
}

// Custom text entries (description-keyed, repeatable → TXXX).
const newTextDesc = ref('')
const newTextValue = ref('')
function addText() {
  const description = newTextDesc.value.trim()
  if (!description) return
  model.value = {
    ...model.value,
    customText: [...(model.value.customText ?? []), { description, value: newTextValue.value }],
  }
  newTextDesc.value = ''
  newTextValue.value = ''
}
function removeText(index: number) {
  const customText = [...(model.value.customText ?? [])]
  customText.splice(index, 1)
  model.value = { ...model.value, customText: customText.length ? customText : undefined }
}

// Custom URL entries (description-keyed, repeatable → WXXX; ID3-only).
const newUrlDesc = ref('')
const newUrlValue = ref('')
function addUrl() {
  const description = newUrlDesc.value.trim()
  const url = newUrlValue.value.trim()
  if (!description || !url) return
  model.value = {
    ...model.value,
    customUrl: [...(model.value.customUrl ?? []), { description, url }],
  }
  newUrlDesc.value = ''
  newUrlValue.value = ''
}
function removeUrl(index: number) {
  const customUrl = [...(model.value.customUrl ?? [])]
  customUrl.splice(index, 1)
  model.value = { ...model.value, customUrl: customUrl.length ? customUrl : undefined }
}
</script>

<template>
  <fieldset class="flex flex-col gap-3 rounded border p-3">
    <legend class="px-1 text-sm font-medium">{{ t('generate.metadata.legend') }}</legend>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <label v-for="f in scalarFields" :key="f.key" class="flex flex-col gap-1 text-sm">
        <span class="font-medium">{{ t(`generate.metadata.${f.key}`) }}</span>
        <input
          v-model="bound[f.key].value"
          :data-test="f.test"
          type="text"
          class="rounded border px-2 py-1"
        >
      </label>
    </div>

    <label class="flex flex-col gap-1 text-sm">
      <span class="font-medium">{{ t('generate.metadata.comment') }}</span>
      <textarea v-model="comment" data-test="meta-comment" rows="2" class="rounded border px-2 py-1" />
    </label>

    <!-- Languages (multi-value) -->
    <div class="flex flex-col gap-1 text-sm">
      <span class="font-medium">{{ t('generate.metadata.languages') }}</span>
      <div class="flex flex-wrap items-center gap-2">
        <span
          v-for="(lang, i) in model.languages ?? []"
          :key="`${lang}-${i}`"
          data-test="meta-language-chip"
          class="inline-flex items-center gap-1 rounded bg-elevated px-2 py-0.5 text-xs"
        >
          {{ lang }}
          <button
            type="button"
            data-test="meta-language-remove"
            class="text-muted hover:text-error"
            :aria-label="t('generate.metadata.removeLanguage')"
            @click="removeLanguage(i)"
          >
            ×
          </button>
        </span>
      </div>
      <div class="flex gap-2">
        <input
          v-model="newLanguage"
          data-test="meta-language-input"
          type="text"
          :placeholder="t('generate.metadata.languagePlaceholder')"
          class="w-40 rounded border px-2 py-1"
          @keydown.enter.prevent="addLanguage"
        >
        <UButton
          data-test="meta-language-add"
          color="neutral"
          variant="outline"
          size="xs"
          icon="i-lucide-plus"
          @click="addLanguage"
        >
          {{ t('generate.metadata.addLanguage') }}
        </UButton>
      </div>
    </div>

    <!-- Custom text entries -->
    <div class="flex flex-col gap-1 text-sm">
      <span class="font-medium">{{ t('generate.metadata.customText') }}</span>
      <ul v-if="model.customText?.length" class="flex flex-col gap-1">
        <li
          v-for="(entry, i) in model.customText"
          :key="i"
          data-test="meta-text-entry"
          class="flex items-center gap-2"
        >
          <span class="flex-1 truncate">{{ entry.description }}: {{ entry.value }}</span>
          <UButton
            data-test="meta-text-remove"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-x"
            :aria-label="t('generate.metadata.remove')"
            @click="removeText(i)"
          />
        </li>
      </ul>
      <div class="flex flex-wrap gap-2">
        <input
          v-model="newTextDesc"
          data-test="meta-text-desc"
          type="text"
          :placeholder="t('generate.metadata.description')"
          class="w-40 rounded border px-2 py-1"
        >
        <input
          v-model="newTextValue"
          data-test="meta-text-value"
          type="text"
          :placeholder="t('generate.metadata.value')"
          class="w-40 rounded border px-2 py-1"
        >
        <UButton
          data-test="meta-text-add"
          color="neutral"
          variant="outline"
          size="xs"
          icon="i-lucide-plus"
          @click="addText"
        >
          {{ t('generate.metadata.add') }}
        </UButton>
      </div>
    </div>

    <!-- Custom URL entries (ID3 only) -->
    <div class="flex flex-col gap-1 text-sm">
      <span class="font-medium">{{ t('generate.metadata.customUrl') }}</span>
      <ul v-if="model.customUrl?.length" class="flex flex-col gap-1">
        <li
          v-for="(entry, i) in model.customUrl"
          :key="i"
          data-test="meta-url-entry"
          class="flex items-center gap-2"
        >
          <span class="flex-1 truncate">{{ entry.description }}: {{ entry.url }}</span>
          <UButton
            data-test="meta-url-remove"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-x"
            :aria-label="t('generate.metadata.remove')"
            @click="removeUrl(i)"
          />
        </li>
      </ul>
      <div class="flex flex-wrap gap-2">
        <input
          v-model="newUrlDesc"
          data-test="meta-url-desc"
          type="text"
          :placeholder="t('generate.metadata.description')"
          class="w-40 rounded border px-2 py-1"
        >
        <input
          v-model="newUrlValue"
          data-test="meta-url-value"
          type="url"
          :placeholder="t('generate.metadata.url')"
          class="w-40 rounded border px-2 py-1"
        >
        <UButton
          data-test="meta-url-add"
          color="neutral"
          variant="outline"
          size="xs"
          icon="i-lucide-plus"
          @click="addUrl"
        >
          {{ t('generate.metadata.add') }}
        </UButton>
      </div>
    </div>
  </fieldset>
</template>
