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
  const value = newTextValue.value.trim()
  if (!description || !value) return
  model.value = {
    ...model.value,
    customText: [...(model.value.customText ?? []), { description, value }],
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
  <fieldset class="flex flex-col gap-3 rounded border border-default p-3">
    <legend class="px-1 text-sm font-medium">{{ t('generate.metadata.legend') }}</legend>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <UFormField v-for="f in scalarFields" :key="f.key" :label="t(`generate.metadata.${f.key}`)">
        <UInput v-model="bound[f.key].value" :data-test="f.test" class="w-full" />
      </UFormField>
    </div>

    <UFormField :label="t('generate.metadata.comment')">
      <UTextarea v-model="comment" data-test="meta-comment" :rows="2" class="w-full" />
    </UFormField>

    <!-- Languages (multi-value) -->
    <UFormField :label="t('generate.metadata.languages')">
      <div class="flex flex-col gap-2">
        <div v-if="model.languages?.length" class="flex flex-wrap items-center gap-2">
          <UBadge
            v-for="(lang, i) in model.languages ?? []"
            :key="`${lang}-${i}`"
            data-test="meta-language-chip"
            color="neutral"
            variant="soft"
            class="gap-1"
          >
            {{ lang }}
            <UButton
              data-test="meta-language-remove"
              color="neutral"
              variant="link"
              size="xs"
              icon="i-lucide-x"
              :aria-label="t('generate.metadata.removeLanguage')"
              @click="removeLanguage(i)"
            />
          </UBadge>
        </div>
        <div class="flex gap-2">
          <UInput
            v-model="newLanguage"
            data-test="meta-language-input"
            :placeholder="t('generate.metadata.languagePlaceholder')"
            class="w-40"
            @keydown.enter.prevent="addLanguage"
          />
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
    </UFormField>

    <!-- Custom text entries -->
    <UFormField :label="t('generate.metadata.customText')">
      <div class="flex flex-col gap-2">
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
          <UInput
            v-model="newTextDesc"
            data-test="meta-text-desc"
            :placeholder="t('generate.metadata.description')"
            class="w-40"
            @keydown.enter.prevent="addText"
          />
          <UInput
            v-model="newTextValue"
            data-test="meta-text-value"
            :placeholder="t('generate.metadata.value')"
            class="w-40"
            @keydown.enter.prevent="addText"
          />
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
    </UFormField>

    <!-- Custom URL entries (ID3 only) -->
    <UFormField :label="t('generate.metadata.customUrl')">
      <div class="flex flex-col gap-2">
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
          <UInput
            v-model="newUrlDesc"
            data-test="meta-url-desc"
            :placeholder="t('generate.metadata.description')"
            class="w-40"
            @keydown.enter.prevent="addUrl"
          />
          <UInput
            v-model="newUrlValue"
            data-test="meta-url-value"
            type="url"
            :placeholder="t('generate.metadata.url')"
            class="w-40"
            @keydown.enter.prevent="addUrl"
          />
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
    </UFormField>
  </fieldset>
</template>
