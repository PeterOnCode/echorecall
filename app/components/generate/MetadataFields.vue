<script setup lang="ts">
import type { Metadata } from '#core/client'
import type { MetadataFieldId, MetadataFieldPref } from '../../composables/useViewPreferences'
import { parseDate, type CalendarDate } from '@internationalized/date'

// Editor for the full, standards-oriented tag set (US2 / FR-018): scalar fields,
// multi-value `languages`, and repeatable `customText` / `customUrl`. Controlled
// via v-model; every edit emits a fresh Metadata object (immutable update) so the
// owner (form-level defaults, queue row, or library item) stays the source of
// truth. Saving replaces the whole set — clearing a field removes it (FR-023).
//
// 007 · The visible field set + order can be configured by the parent via `fields`
// (Configure Visible Fields dialog): only visible fields render, in the given order, and a
// "Configure fields" button is shown. When `fields` is omitted (Library / queue-row
// editors), every field renders in canonical order with no Configure button — those
// consumers are unaffected.
const props = defineProps<{ fields?: MetadataFieldPref[] }>()
const emit = defineEmits<{ configure: [] }>()
const model = defineModel<Metadata>({ required: true })
const { t, locale } = useI18n()

/** A computed bound to one scalar field that drops the key when cleared. */
function scalar(key: 'title' | 'artist' | 'album' | 'genre' | 'comment' | 'track') {
  return computed<string>({
    get: () => model.value[key] ?? '',
    // Clearing a field removes it (FR-023): set undefined, which the JSON clone in
    // useQueue drops before the row is sent.
    set: (value: string) => {
      model.value = { ...model.value, [key]: value === '' ? undefined : value }
    },
  })
}

const title = scalar('title')
const artist = scalar('artist')
const album = scalar('album')
const genre = scalar('genre')
const comment = scalar('comment')
const track = scalar('track')
// Scalar single-line fields, looked up by id in the ordered render (string index →
// `| undefined` under noUncheckedIndexedAccess, so callers use `!` inside the scalar branch).
const bound: Record<string, ReturnType<typeof scalar>> = { title, artist, album, genre, track }

// Canonical field order + the render-shape classification. `orderedFields` is the parent's
// visible set (in order) when `fields` is passed, else every field canonically.
const CANONICAL: MetadataFieldId[] = [
  'title',
  'artist',
  'album',
  'genre',
  'track',
  'recordedAt',
  'comment',
  'languages',
  'customText',
  'customUrl',
]
const orderedFields = computed<MetadataFieldId[]>(() =>
  props.fields ? props.fields.filter((f) => f.visible).map((f) => f.id) : CANONICAL,
)
const configurable = computed(() => props.fields != null)
const SCALAR_IDS = new Set<MetadataFieldId>(['title', 'artist', 'album', 'genre', 'track'])
// Fields that span the full grid width (their own row); the rest are single grid cells.
const WIDE_IDS = new Set<MetadataFieldId>(['comment', 'languages', 'customText', 'customUrl'])
function isScalar(id: MetadataFieldId): boolean {
  return SCALAR_IDS.has(id)
}
function isWide(id: MetadataFieldId): boolean {
  return WIDE_IDS.has(id)
}

// Recording date (005 redesign / FR-008): a UPopover + UCalendar picker that maps
// the stored `YYYY-MM-DD` string to/from a CalendarDate. A legacy/unparseable value
// (e.g. an old year-only entry) reads as "no date" until the user picks one. The
// field stays clearable — clearing drops the key (FR-023).
const recordedDate = computed<CalendarDate | undefined>({
  get: () => {
    const value = model.value.recordedAt
    if (!value) return undefined
    try {
      return parseDate(value)
    } catch {
      return undefined
    }
  },
  set: (value) => {
    model.value = { ...model.value, recordedAt: value ? value.toString() : undefined }
  },
})

/** Localized label for the picker trigger, or a placeholder when no date is set. */
const recordedLabel = computed(() => {
  const date = recordedDate.value
  if (!date) return t('generate.metadata.recordedAtPlaceholder')
  return new Date(date.year, date.month - 1, date.day).toLocaleDateString(locale.value)
})

function clearRecordedAt() {
  recordedDate.value = undefined
}

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

    <div v-if="configurable" class="flex justify-end">
      <UButton
        data-test="metadata-configure-fields"
        color="neutral"
        variant="outline"
        size="xs"
        icon="i-lucide-sliders-horizontal"
        @click="emit('configure')"
      >
        {{ t('generate.metadataFields.configure') }}
      </UButton>
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div v-for="id in orderedFields" :key="id" :class="isWide(id) ? 'col-span-2 sm:col-span-3' : ''">
        <!-- Scalar single-line fields (title / artist / album / genre / track) -->
        <UFormField v-if="isScalar(id)" :label="t(`generate.metadata.${id}`)">
          <UInput v-model="bound[id]!.value" :data-test="`meta-${id}`" class="w-full" />
        </UFormField>

        <!-- Recording date: a calendar picker (FR-008) -->
        <UFormField v-else-if="id === 'recordedAt'" :label="t('generate.metadata.recordedAt')">
          <UPopover>
            <UButton
              data-test="meta-recordedAt-trigger"
              color="neutral"
              variant="outline"
              icon="i-lucide-calendar"
              class="w-full justify-start"
            >
              {{ recordedLabel }}
            </UButton>
            <template #content>
              <div class="flex flex-col gap-2 p-2">
                <UCalendar v-model="recordedDate" data-test="meta-recordedAt-calendar" />
                <div class="flex justify-end">
                  <UButton
                    data-test="meta-recordedAt-clear"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    @click="clearRecordedAt"
                  >
                    {{ t('generate.metadata.recordedAtClear') }}
                  </UButton>
                </div>
              </div>
            </template>
          </UPopover>
        </UFormField>

        <!-- Comment -->
        <UFormField v-else-if="id === 'comment'" :label="t('generate.metadata.comment')">
          <UTextarea v-model="comment" data-test="meta-comment" :rows="2" class="w-full" />
        </UFormField>

        <!-- Languages (multi-value) -->
        <UFormField v-else-if="id === 'languages'" :label="t('generate.metadata.languages')">
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
        <UFormField v-else-if="id === 'customText'" :label="t('generate.metadata.customText')">
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
        <UFormField v-else-if="id === 'customUrl'" :label="t('generate.metadata.customUrl')">
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
      </div>
    </div>
  </fieldset>
</template>
