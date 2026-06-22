<script setup lang="ts">
import { VOICES, FORMATS, type LibraryQuery } from '#core/client'
import { CalendarDate } from '@internationalized/date'

// Search + filter controls for the library (US6 / FR-034-036). Controlled via
// v-model:query — every change emits a fresh query object so the owner
// (LibraryTable / the page) stays the single source of truth. Any search or
// filter change resets to page 1 so a narrowed result set is never hidden behind
// a now-out-of-range page.
const query = defineModel<LibraryQuery>('query', { required: true })
const { t } = useI18n()

/** Merge a partial change and snap back to the first page. */
function patch(part: Partial<LibraryQuery>) {
  query.value = { ...query.value, ...part, page: 1 }
}

const q = computed<string>({
  get: () => query.value.q ?? '',
  set: (value) => patch({ q: value.trim() === '' ? undefined : value }),
})

// Filters are USelectMenu now; the "all" item clears the filter. reka-ui's
// Combobox reserves the empty string for its own cleared/placeholder state and
// throws if an item's value is '', so "all" uses a non-empty sentinel that maps
// back to `undefined` (no filter) in the query.
const ALL = '__all__'
const voiceItems = [
  { id: ALL, label: t('library.filters.allVoices') },
  ...VOICES.map((v) => ({ id: v.id, label: v.label })),
]
const formatItems = [
  { id: ALL, label: t('library.filters.allFormats') },
  ...FORMATS.map((f) => ({ id: f.id, label: f.ext.toUpperCase() })),
]

const voiceId = computed<string>({
  get: () => query.value.voiceId ?? ALL,
  set: (value) => patch({ voiceId: value === ALL ? undefined : value }),
})

const format = computed<string>({
  get: () => query.value.format ?? ALL,
  set: (value) => patch({ format: (value === ALL ? undefined : value) as LibraryQuery['format'] }),
})

// Date range picker (FR-010/011). The single range selection maps to the same
// inclusive local-day bounds the two native date inputs produced: start ->
// `from` at local midnight, end -> `to` at local end-of-day, both as UTC instants
// (so filtering lines up with the calendar days the user sees, not UTC).
// reka-ui's RangeCalendar models bounds as DateValue | undefined (not null).
type DateRange = { start: CalendarDate | undefined; end: CalendarDate | undefined }

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

const range = computed<DateRange | undefined>({
  get: () => {
    const start = isoToCalendarDate(query.value.from)
    const end = isoToCalendarDate(query.value.to)
    return start || end ? { start, end } : undefined
  },
  set: (value) => {
    patch({
      from: value?.start ? startIso(value.start) : undefined,
      to: value?.end ? endIso(value.end) : undefined,
    })
  },
})

function clearRange() {
  range.value = undefined
}

const rangeLabel = computed(() => {
  const { from, to } = query.value
  if (!from && !to) return t('library.filters.anyDate')
  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '…')
  return `${fmt(from)} – ${fmt(to)}`
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

    <UFormField :label="t('library.filters.voice')">
      <USelectMenu
        v-model="voiceId"
        data-test="filter-voice"
        value-key="id"
        label-key="label"
        :items="voiceItems"
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

    <UFormField :label="t('library.filters.dateRange')">
      <UPopover>
        <UButton
          data-test="filter-range"
          color="neutral"
          variant="outline"
          icon="i-lucide-calendar"
        >
          {{ rangeLabel }}
        </UButton>
        <template #content>
          <div class="flex flex-col gap-2 p-2">
            <UCalendar v-model="range" range :number-of-months="2" />
            <div class="flex justify-end">
              <UButton
                data-test="filter-range-clear"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="clearRange"
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
