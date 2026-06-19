<script setup lang="ts">
import { VOICES, FORMATS, type LibraryQuery } from '#core/client'

// Search + filter controls for the library (US6 / FR-034–036). Controlled via
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

const voiceId = computed<string>({
  get: () => query.value.voiceId ?? '',
  set: (value) => patch({ voiceId: value === '' ? undefined : value }),
})

const format = computed<string>({
  get: () => query.value.format ?? '',
  set: (value) => patch({ format: (value === '' ? undefined : value) as LibraryQuery['format'] }),
})

// Date inputs work in calendar days; map them to inclusive ISO bounds so a single
// day "from = to" still matches everything created that day.
const fromDate = computed<string>({
  get: () => query.value.from?.slice(0, 10) ?? '',
  set: (value) => patch({ from: value ? `${value}T00:00:00.000Z` : undefined }),
})
const toDate = computed<string>({
  get: () => query.value.to?.slice(0, 10) ?? '',
  set: (value) => patch({ to: value ? `${value}T23:59:59.999Z` : undefined }),
})
</script>

<template>
  <div class="flex flex-wrap items-end gap-3">
    <label class="flex min-w-48 flex-1 flex-col gap-1 text-sm">
      <span class="font-medium">{{ t('library.search.label') }}</span>
      <input
        v-model="q"
        data-test="library-search"
        type="search"
        :placeholder="t('library.search.placeholder')"
        class="rounded border px-2 py-1"
      >
    </label>

    <label class="flex flex-col gap-1 text-sm">
      <span class="font-medium">{{ t('library.filters.voice') }}</span>
      <select v-model="voiceId" data-test="filter-voice" class="rounded border px-2 py-1">
        <option value="">{{ t('library.filters.allVoices') }}</option>
        <option v-for="v in VOICES" :key="v.id" :value="v.id">{{ v.label }}</option>
      </select>
    </label>

    <label class="flex flex-col gap-1 text-sm">
      <span class="font-medium">{{ t('library.filters.format') }}</span>
      <select v-model="format" data-test="filter-format" class="rounded border px-2 py-1">
        <option value="">{{ t('library.filters.allFormats') }}</option>
        <option v-for="f in FORMATS" :key="f.id" :value="f.id">{{ f.ext.toUpperCase() }}</option>
      </select>
    </label>

    <label class="flex flex-col gap-1 text-sm">
      <span class="font-medium">{{ t('library.filters.from') }}</span>
      <input v-model="fromDate" data-test="filter-from" type="date" class="rounded border px-2 py-1">
    </label>

    <label class="flex flex-col gap-1 text-sm">
      <span class="font-medium">{{ t('library.filters.to') }}</span>
      <input v-model="toDate" data-test="filter-to" type="date" class="rounded border px-2 py-1">
    </label>
  </div>
</template>
