<script setup lang="ts">
import { FORMATS, type LibraryQuery } from '#core/client'
import { CalendarDate } from '@internationalized/date'

// 006 · US3 (FR-011/FR-012) — the Library filter bar (supersedes LibrarySearchBar).
// Controlled via v-model:query: every change emits a fresh query object (the page
// stays the single source of truth) and snaps to page 1 so a narrowed set is never
// hidden behind an out-of-range page. Controls: search-all (q), audio-format, a
// recording-date RANGE (start/end calendar days → recordedFrom/recordedTo inclusive
// bounds over the tag date, distinct from generation time; either bound alone makes
// the range open-ended), genre, and language. Genre/language options are supplied by
// the page; the "__all__" sentinel clears a select (reka-ui's Combobox reserves the
// empty string for its own cleared state).
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

// Recording-date filtering is timezone-NAIVE end to end: the tag stores a plain
// `YYYY-MM-DD` (no zone), the repository compares it as a string, and the chosen range
// must match each day's own rows in EVERY timezone. So the range picker parses and
// emits date-only `YYYY-MM-DD` bounds — a `new Date(iso)` round-trip through UTC would
// shift the day for negative-offset users and make a `…T00:00:00.000Z` lower bound sort
// AFTER the plain date string, dropping that day entirely. Both bounds are inclusive
// (repo compares `>= recordedFrom` / `<= recordedTo` on date-only strings) and either
// alone is a valid open-ended range. Targets recordedAt (the tag the user sets), not
// createdAt. reka-ui's RangeCalendar models bounds as `DateValue | undefined` (not
// null), so the computed view does the same.
type DateRange = { start: CalendarDate | undefined; end: CalendarDate | undefined }

function calendarToDateOnly(d: CalendarDate): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
}
function dateOnlyToCalendar(value?: string): CalendarDate | undefined {
  if (!value) return undefined
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  if (y && m && d) return new CalendarDate(y, m, d)
  return undefined
}

const recordedRange = computed<DateRange | undefined>({
  get: () => {
    const start = dateOnlyToCalendar(query.value.recordedFrom)
    const end = dateOnlyToCalendar(query.value.recordedTo)
    return start || end ? { start, end } : undefined
  },
  set: (value) => {
    patch({
      recordedFrom: value?.start ? calendarToDateOnly(value.start) : undefined,
      recordedTo: value?.end ? calendarToDateOnly(value.end) : undefined,
    })
  },
})

function clearRecordedDate() {
  recordedRange.value = undefined
}

// Format each bound from its naive Y/M/D via a LOCAL Date (no UTC parse → no day shift);
// an unset bound renders as an ellipsis so an open-ended range still reads clearly.
const recordedLabel = computed(() => {
  const { recordedFrom, recordedTo } = query.value
  if (!recordedFrom && !recordedTo) return t('library.filters.recordedRange')
  const fmt = (value?: string) => {
    const cd = dateOnlyToCalendar(value)
    return cd ? new Date(cd.year, cd.month - 1, cd.day).toLocaleDateString(locale.value) : '…'
  }
  return `${fmt(recordedFrom)} – ${fmt(recordedTo)}`
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
            <UCalendar v-model="recordedRange" range />
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
