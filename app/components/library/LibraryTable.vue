<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BulkCleanFilter, LibraryQuery } from '#core/client'
import type { LibraryItem } from '../../composables/useLibrary'

// The Library list pane (005 redesign / US5 · FR-014): a controlled, server-driven
// discovery table. The search/filter bar sits above it, sortable headers and
// pagination drive a single `query` (v-model:query) — never a client-side sort —
// and a bulk-clean trigger removes batches. Clicking a row sets the active id
// (v-model:selected-id) so the page loads that recording into the audio-tags detail
// pane; tag editing, delete, and playback now live in that pane / the waveform, so
// the old inline expanded region is gone. Download stays as a per-row link (a plain
// attachment URL — no provider call). The page owns the network: it provides
// `items`/`total`, reloads on `update:query`, and carries out `bulk-clean`.
const props = defineProps<{ items: LibraryItem[]; total: number }>()
const emit = defineEmits<{ 'bulk-clean': [filter: BulkCleanFilter] }>()

const query = defineModel<LibraryQuery>('query', { required: true })
// The active row, shown in the detail pane; null → the pane shows its empty state.
const selectedId = defineModel<string | null>('selectedId', { default: null })

const { t } = useI18n()

// Display columns; rendering is done entirely through cell/header slots so the
// table is server-driven (no TanStack client sort). Each column id keys its slots.
const columns: TableColumn<LibraryItem>[] = [
  { id: 'name', accessorKey: 'filename' },
  { id: 'voice', accessorKey: 'voiceId' },
  { id: 'format', accessorKey: 'format' },
  { id: 'createdAt', accessorKey: 'createdAt' },
  { id: 'actions' },
]

// --- Selection (drives the detail pane) ----------------------------------------
function select(id: string) {
  selectedId.value = id
}

// --- Sorting (server-driven) ---------------------------------------------------
type SortKey = NonNullable<LibraryQuery['sort']>

function toggleSort(column: SortKey) {
  const current = query.value
  const order = current.sort === column && current.order === 'asc' ? 'desc' : 'asc'
  // Default to ascending on a new column; flip on repeat. Reset to page 1 so the
  // re-sorted set starts at the top.
  query.value = { ...current, sort: column, order, page: 1 }
}

function sortIndicator(column: SortKey): string {
  if (query.value.sort !== column) return ''
  return query.value.order === 'asc' ? '▲' : '▼'
}

// --- Pagination ----------------------------------------------------------------
// Guard against a 0/negative pageSize so totalPages never divides by zero.
const pageSize = computed(() => Math.max(1, query.value.pageSize ?? 20))
const currentPage = computed(() => query.value.page ?? 1)
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / pageSize.value)))

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  query.value = { ...query.value, page }
}

// --- Row actions (local, network-free) -----------------------------------------
function downloadUrl(audioUrl: string): string {
  return `${audioUrl}?download=1`
}

// --- Bulk clean ----------------------------------------------------------------
const cleaning = ref(false)
function onBulkConfirm(filter: BulkCleanFilter) {
  cleaning.value = false
  emit('bulk-clean', filter)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <LibrarySearchBar v-model:query="query" class="flex-1" />
      <UButton
        data-test="open-bulk-clean"
        color="error"
        variant="outline"
        size="sm"
        icon="i-lucide-trash-2"
        @click="cleaning = true"
      >
        {{ t('library.bulkClean.open') }}
      </UButton>
    </div>

    <p v-if="items.length === 0" data-test="library-empty" class="text-muted">
      {{ query.q || query.voiceId || query.format || query.from || query.to
        ? t('library.noResults')
        : t('library.empty') }}
    </p>

    <UTable
      v-else
      :data="items"
      :columns="columns"
      :get-row-id="(row: LibraryItem) => row.id"
    >
      <template #name-header>
        <UButton
          data-test="sort-title"
          color="neutral"
          variant="ghost"
          size="xs"
          class="font-medium"
          @click="toggleSort('title')"
        >
          {{ t('library.columns.name') }} {{ sortIndicator('title') }}
        </UButton>
      </template>
      <template #voice-header>
        <UButton
          data-test="sort-voice"
          color="neutral"
          variant="ghost"
          size="xs"
          class="font-medium"
          @click="toggleSort('voice')"
        >
          {{ t('library.columns.voice') }} {{ sortIndicator('voice') }}
        </UButton>
      </template>
      <template #format-header>
        <UButton
          data-test="sort-format"
          color="neutral"
          variant="ghost"
          size="xs"
          class="font-medium"
          @click="toggleSort('format')"
        >
          {{ t('library.columns.format') }} {{ sortIndicator('format') }}
        </UButton>
      </template>
      <template #createdAt-header>
        <UButton
          data-test="sort-createdAt"
          color="neutral"
          variant="ghost"
          size="xs"
          class="font-medium"
          @click="toggleSort('createdAt')"
        >
          {{ t('library.columns.created') }} {{ sortIndicator('createdAt') }}
        </UButton>
      </template>
      <template #actions-header>
        <span class="font-medium">{{ t('library.columns.actions') }}</span>
      </template>

      <template #name-cell="{ row }">
        <button
          type="button"
          data-test="library-row"
          :aria-pressed="selectedId === row.original.id"
          class="flex w-full flex-col items-start gap-0.5 text-left"
          @click="select(row.original.id)"
        >
          <span class="font-medium" :class="{ 'text-primary': selectedId === row.original.id }">
            {{ row.original.filename }}
          </span>
          <span class="whitespace-normal break-words text-xs text-muted">{{ row.original.text }}</span>
        </button>
      </template>
      <template #voice-cell="{ row }">{{ row.original.voiceId }}</template>
      <template #format-cell="{ row }"><span class="uppercase">{{ row.original.format }}</span></template>
      <template #createdAt-cell="{ row }">
        <span class="whitespace-nowrap">{{ new Date(row.original.createdAt).toLocaleString() }}</span>
      </template>
      <template #actions-cell="{ row }">
        <div class="flex justify-end gap-1">
          <UButton
            data-test="download"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-download"
            :href="downloadUrl(row.original.audioUrl)"
            external
            download
            :aria-label="t('library.item.download')"
          />
        </div>
      </template>
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

    <BulkCleanDialog :open="cleaning" @confirm="onBulkConfirm" @cancel="cleaning = false" />
  </div>
</template>
