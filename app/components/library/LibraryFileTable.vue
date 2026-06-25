<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { LibraryQuery } from '#core/client'
import type { LibraryItem } from '../../composables/useLibrary'

// 006 · US1 (FR-005/FR-013) — the redesigned Library file table (forks the 005
// LibraryTable). A controlled, server-driven list: the page owns the network and
// passes `items`/`total`; the table renders the base columns (Filename always-on +
// Title/Artist/Album/Year/Track/Genre), selects a row on click (v-model:active-id)
// with a highlight, drives sort/page through `v-model:query`, and exposes a
// show/hide-inspector control (FR-021). Multi-select, sortable headers, the Configure
// Columns dialog, and bulk actions are layered on in US4; the filter bar (US3) and
// waveform (US2) are separate components mounted by the page.
const props = defineProps<{ items: LibraryItem[]; total: number; loading?: boolean }>()
const emit = defineEmits<{ 'toggle-inspector': [] }>()

const query = defineModel<LibraryQuery>('query', { required: true })
// The active row, shown in the detail pane; null → the inspector shows its empty state.
const activeId = defineModel<string | null>('activeId', { default: null })

const { t } = useI18n()

// Display columns; rendering is entirely through cell/header slots so the table stays
// server-driven (no TanStack client sort). Each column id keys its slots.
const columns: TableColumn<LibraryItem>[] = [
  { id: 'name', accessorKey: 'filename' },
  { id: 'title' },
  { id: 'artist' },
  { id: 'album' },
  { id: 'year' },
  { id: 'track' },
  { id: 'genre' },
]

function select(id: string) {
  activeId.value = id
}

/** Year is the leading 4 chars of the recording date (blank when unset). */
function year(item: LibraryItem): string {
  return item.metadata?.recordedAt?.slice(0, 4) ?? ''
}

// --- Pagination ----------------------------------------------------------------
const pageSize = computed(() => Math.max(1, query.value.pageSize ?? 20))
const currentPage = computed(() => query.value.page ?? 1)
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / pageSize.value)))

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  query.value = { ...query.value, page }
}
</script>

<template>
  <div class="flex flex-col gap-4" data-test="library-file-table">
    <div class="flex items-center justify-end">
      <UButton
        data-test="toggle-inspector"
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-panel-right"
        :aria-label="t('library.toggleInspector')"
        @click="emit('toggle-inspector')"
      >
        {{ t('library.toggleInspector') }}
      </UButton>
    </div>

    <p v-if="items.length === 0" data-test="library-empty" class="text-muted">
      {{ t('library.noResults') }}
    </p>

    <UTable v-else :data="items" :columns="columns" :get-row-id="(row: LibraryItem) => row.id">
      <template #name-header><span class="font-medium">{{ t('library.columns.name') }}</span></template>
      <template #title-header><span class="font-medium">{{ t('library.columns.title') }}</span></template>
      <template #artist-header><span class="font-medium">{{ t('library.columns.artist') }}</span></template>
      <template #album-header><span class="font-medium">{{ t('library.columns.album') }}</span></template>
      <template #year-header><span class="font-medium">{{ t('library.columns.year') }}</span></template>
      <template #track-header><span class="font-medium">{{ t('library.columns.track') }}</span></template>
      <template #genre-header><span class="font-medium">{{ t('library.columns.genre') }}</span></template>

      <template #name-cell="{ row }">
        <button
          type="button"
          data-test="library-row"
          :aria-pressed="activeId === row.original.id"
          class="flex w-full flex-col items-start gap-0.5 text-left"
          @click="select(row.original.id)"
        >
          <span class="font-medium" :class="{ 'text-primary': activeId === row.original.id }">
            {{ row.original.filename }}
          </span>
        </button>
      </template>
      <template #title-cell="{ row }">{{ row.original.metadata?.title }}</template>
      <template #artist-cell="{ row }">{{ row.original.metadata?.artist }}</template>
      <template #album-cell="{ row }">{{ row.original.metadata?.album }}</template>
      <template #year-cell="{ row }">{{ year(row.original) }}</template>
      <template #track-cell="{ row }">{{ row.original.metadata?.track }}</template>
      <template #genre-cell="{ row }">{{ row.original.metadata?.genre }}</template>
    </UTable>

    <div v-if="items.length > 0" class="flex items-center justify-between gap-3 text-sm">
      <span data-test="page-status" class="text-muted">
        {{ t('library.pagination.status', { page: currentPage, pages: totalPages, total }) }}
      </span>
      <div class="flex gap-2">
        <UButton
          data-test="page-prev"
          color="neutral"
          variant="outline"
          size="xs"
          :disabled="currentPage <= 1"
          @click="goToPage(currentPage - 1)"
        >
          {{ t('library.pagination.previous') }}
        </UButton>
        <UButton
          data-test="page-next"
          color="neutral"
          variant="outline"
          size="xs"
          :disabled="currentPage >= totalPages"
          @click="goToPage(currentPage + 1)"
        >
          {{ t('library.pagination.next') }}
        </UButton>
      </div>
    </div>
  </div>
</template>
