<script setup lang="ts">
import { FORMATS, type LibraryQuery } from '#core/client'
import { CalendarDate } from '@internationalized/date'

// 006 · US3 (FR-011/FR-012) — the Library filter bar (supersedes LibrarySearchBar).
// Controlled via v-model:query: every change emits a fresh query object (the page
// stays the single source of truth) and snaps to page 1 so a narrowed set is never
// hidden behind an out-of-range page. Controls: search-all (q), audio-format, a
// SINGLE recording-date (one calendar day → recordedFrom/recordedTo day-bounds over
// the tag date, distinct from generation time), genre, and language. Genre/language
// options are supplied by the page; the "__all__" sentinel clears a select (reka-ui's
// Combobox reserves the empty string for its own cleared state).
const props = withDefaults(
  defineProps<{ genres?: string[]; languages?: string[] }>(),
  { genres: () => [], languages: () => [] },
)
const query = defineModel<LibraryQuery>('query', { required: true })
const { t, locale } = useI18n()

/** Merge a partial change and snap back to the first page. */
function patch(part: Partial<LibraryQuery>) {
  query.value = { ...query.value, ...part, page: 1 }
}

const ALL = '__all__'

const q = computed<string>({
  get: () => query.value.q ?? '',
  set: (value) => patch({ q: value.trim() === '' ? undefined : value }),
})

const formatItems = computed(() => [
  { id: ALL, label: t('library.filters.allFormats') },
  ...FORMATS.map((f) => ({ id: f.id, label: f.ext.toUpperCase() })),
])
const genreItems = computed(() => [
  { id: ALL, label: t('library.filters.allGenres') },
  ...props.genres.map((g) => ({ id: g, label: g })),
])
const languageItems = computed(() => [
  { id: ALL, label: t('library.filters.allLanguages') },
  ...props.languages.map((l) => ({ id: l, label: l })),
])

const format = computed<string>({
  get: () => query.value.format ?? ALL,
  set: (value) => patch({ format: (value === ALL ? undefined : value) as LibraryQuery['format'] }),
})
const genre = computed<string>({
  get: () => query.value.genre ?? ALL,
  set: (value) => patch({ genre: value === ALL ? undefined : value }),
})
const language = computed<string>({
  get: () => query.value.language ?? ALL,
  set: (value) => patch({ language: value === ALL ? undefined : value }),
})

// Single recording-date → that day's inclusive local-day bounds (start at midnight,
// end at 23:59:59.999), emitted as UTC instants so filtering lines up with the
// calendar day the user sees. Targets recordedAt (the tag), not createdAt.
function isoToCalendarDate(iso?: string): CalendarDate | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
}
function startIso(d: CalendarDate): string {
  return new Date(d.year, d.month - 1, d.day, 0, 0, 0, 0).toISOString()
}
function endIso(d: CalendarDate): string {
  return new Date(d.year, d.month - 1, d.day, 23, 59, 59, 999).toISOString()
}

const recordedDate = computed<CalendarDate | undefined>({
  get: () => isoToCalendarDate(query.value.recordedFrom),
  set: (value) =>
    patch({
      recordedFrom: value ? startIso(value) : undefined,
      recordedTo: value ? endIso(value) : undefined,
    }),
})

function clearRecordedDate() {
  recordedDate.value = undefined
}

const recordedLabel = computed(() => {
  const iso = query.value.recordedFrom
  if (!iso) return t('library.filters.recordedRange')
  return new Date(iso).toLocaleDateString(locale.value)
})
</script>

<template>
  <div class="flex flex-wrap items-end gap-3">
    <UFormField :label="t('library.search.label')" class="min-w-48 flex-1">
      <UInput
        v-model="q"
        data-test="library-search"
        type="search"
        :placeholder="t('library.search.placeholder')"
        class="w-full"
      />
    </UFormField>

    <UFormField :label="t('library.filters.format')">
      <USelectMenu
        v-model="format"
        data-test="filter-format"
        value-key="id"
        label-key="label"
        :items="formatItems"
      />
    </UFormField>

    <UFormField :label="t('library.filters.genre')">
      <USelectMenu
        v-model="genre"
        data-test="filter-genre"
        value-key="id"
        label-key="label"
        :items="genreItems"
      />
    </UFormField>

    <UFormField :label="t('library.filters.language')">
      <USelectMenu
        v-model="language"
        data-test="filter-language"
        value-key="id"
        label-key="label"
        :items="languageItems"
      />
    </UFormField>

    <UFormField :label="t('library.filters.recordedRange')">
      <UPopover>
        <UButton
          data-test="filter-recorded-date"
          color="neutral"
          variant="outline"
          icon="i-lucide-calendar"
        >
          {{ recordedLabel }}
        </UButton>
        <template #content>
          <div class="flex flex-col gap-2 p-2">
            <UCalendar v-model="recordedDate" />
            <div class="flex justify-end">
              <UButton
                data-test="filter-recorded-date-clear"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="clearRecordedDate"
              >
                {{ t('library.filters.clearDates') }}
              </UButton>
            </div>
          </div>
        </template>
      </UPopover>
    </UFormField>
  </div>
</template>
