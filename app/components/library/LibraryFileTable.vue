<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { LibraryQuery } from '#core/client'
import type { LibraryItem } from '../../composables/useLibrary'
import type { LibraryColumnPref } from '../../composables/useViewPreferences'

// 006 · US1+US4 (FR-005/FR-013/FR-014/FR-017) — the Library file table. A controlled,
// server-driven list: the page passes `items`/`total` and the visible/ordered
// `columns` (from useViewPreferences); the table renders Filename (always-on) + the
// configured columns, selects the active row on click (v-model:active-id), supports
// multi-select (header select-all + per-row → v-model:selected-ids), sortable headers
// (Composer/Duration/Bitrate are display-only), and a toolbar with bulk actions, the
// Configure-Columns gear, and the show/hide-inspector control. Sort/page changes flow
// through v-model:query (no client-side sort).
const props = withDefaults(
  defineProps<{
    items: LibraryItem[]
    total: number
    loading?: boolean
    columns?: LibraryColumnPref[]
  }>(),
  { loading: false, columns: () => [] },
)
const emit = defineEmits<{
  'toggle-inspector': []
  'open-columns-dialog': []
  'bulk-delete': []
  'open-bulk-tag-edit': []
}>()

const query = defineModel<LibraryQuery>('query', { required: true })
const activeId = defineModel<string | null>('activeId', { default: null })
const selectedIds = defineModel<Set<string>>('selectedIds', { default: () => new Set<string>() })

const { t } = useI18n()

// Column id → sort key. Year + Date both sort by recordedAt; Composer/Duration/
// Bitrate are display-only (absent here → no sort control rendered).
const SORT_KEYS: Partial<Record<string, NonNullable<LibraryQuery['sort']>>> = {
  name: 'filename',
  title: 'title',
  artist: 'artist',
  album: 'album',
  year: 'recordedAt',
  track: 'track',
  genre: 'genre',
  comment: 'comment',
  date: 'recordedAt',
}

const visibleColumns = computed(() => props.columns.filter((c) => c.visible))
const tableColumns = computed<TableColumn<LibraryItem>[]>(() => [
  { id: 'select' },
  { id: 'name', accessorKey: 'filename' },
  ...visibleColumns.value.map((c) => ({ id: c.id })),
])

// --- Selection -----------------------------------------------------------------
function select(id: string) {
  activeId.value = id
}
const allSelected = computed(
  () => props.items.length > 0 && props.items.every((i) => selectedIds.value.has(i.id)),
)
function toggleAll(value: boolean) {
  const next = new Set(selectedIds.value)
  for (const i of props.items) {
    if (value) next.add(i.id)
    else next.delete(i.id)
  }
  selectedIds.value = next
}
function toggleRow(id: string, value: boolean) {
  const next = new Set(selectedIds.value)
  if (value) next.add(id)
  else next.delete(id)
  selectedIds.value = next
}

// --- Sorting (server-driven) ---------------------------------------------------
function toggleSort(columnId: string) {
  const key = SORT_KEYS[columnId]
  if (!key) return
  const cur = query.value
  const order = cur.sort === key && cur.order === 'asc' ? 'desc' : 'asc'
  query.value = { ...cur, sort: key, order, page: 1 }
}
function sortIndicator(columnId: string): string {
  const key = SORT_KEYS[columnId]
  if (!key || query.value.sort !== key) return ''
  return query.value.order === 'asc' ? '▲' : '▼'
}

// --- Cell helpers --------------------------------------------------------------
function year(item: LibraryItem): string {
  return item.metadata?.recordedAt?.slice(0, 4) ?? ''
}
function fmtDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
function fmtBitrate(bitrate?: number): string {
  return bitrate ? `${bitrate} kbps` : ''
}

// --- Pagination ----------------------------------------------------------------
const pageSize = computed(() => Math.max(1, query.value.pageSize ?? 20))
const currentPage = computed(() => query.value.page ?? 1)
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / pageSize.value)))
function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  query.value = { ...query.value, page }
}

const hasSelection = computed(() => selectedIds.value.size > 0)
</script>

<template>
  <div class="flex flex-col gap-4" data-test="library-file-table">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <UButton
          data-test="bulk-delete"
          color="error"
          variant="outline"
          size="xs"
          icon="i-lucide-trash-2"
          :disabled="!hasSelection"
          @click="emit('bulk-delete')"
        >
          {{ t('library.bulkActions.delete') }}
        </UButton>
        <UButton
          data-test="open-bulk-tag-edit"
          color="neutral"
          variant="outline"
          size="xs"
          icon="i-lucide-tags"
          :disabled="!hasSelection"
          @click="emit('open-bulk-tag-edit')"
        >
          {{ t('library.bulkActions.edit') }}
        </UButton>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          data-test="open-columns-dialog"
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-settings-2"
          :aria-label="t('library.columnsDialog.open')"
          @click="emit('open-columns-dialog')"
        />
        <UButton
          data-test="toggle-inspector"
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-lucide-panel-right"
          :aria-label="t('library.toggleInspector')"
          @click="emit('toggle-inspector')"
        />
      </div>
    </div>

    <p v-if="items.length === 0" data-test="library-empty" class="text-muted">
      {{ t('library.noResults') }}
    </p>

    <UTable v-else :data="items" :columns="tableColumns" :get-row-id="(row: LibraryItem) => row.id">
      <!-- Header slots -->
      <template #select-header>
        <UCheckbox
          data-test="select-all"
          :model-value="allSelected"
          :aria-label="t('library.selectAll')"
          @update:model-value="(v) => toggleAll(v === true)"
        />
      </template>
      <template #name-header>
        <UButton data-test="sort-name" color="neutral" variant="ghost" size="xs" class="font-medium" @click="toggleSort('name')">
          {{ t('library.columns.name') }} {{ sortIndicator('name') }}
        </UButton>
      </template>
      <template #title-header>
        <UButton data-test="sort-title" color="neutral" variant="ghost" size="xs" class="font-medium" @click="toggleSort('title')">
          {{ t('library.columns.title') }} {{ sortIndicator('title') }}
        </UButton>
      </template>
      <template #artist-header>
        <UButton data-test="sort-artist" color="neutral" variant="ghost" size="xs" class="font-medium" @click="toggleSort('artist')">
          {{ t('library.columns.artist') }} {{ sortIndicator('artist') }}
        </UButton>
      </template>
      <template #album-header>
        <UButton data-test="sort-album" color="neutral" variant="ghost" size="xs" class="font-medium" @click="toggleSort('album')">
          {{ t('library.columns.album') }} {{ sortIndicator('album') }}
        </UButton>
      </template>
      <template #year-header>
        <UButton data-test="sort-year" color="neutral" variant="ghost" size="xs" class="font-medium" @click="toggleSort('year')">
          {{ t('library.columns.year') }} {{ sortIndicator('year') }}
        </UButton>
      </template>
      <template #track-header>
        <UButton data-test="sort-track" color="neutral" variant="ghost" size="xs" class="font-medium" @click="toggleSort('track')">
          {{ t('library.columns.track') }} {{ sortIndicator('track') }}
        </UButton>
      </template>
      <template #genre-header>
        <UButton data-test="sort-genre" color="neutral" variant="ghost" size="xs" class="font-medium" @click="toggleSort('genre')">
          {{ t('library.columns.genre') }} {{ sortIndicator('genre') }}
        </UButton>
      </template>
      <template #comment-header>
        <UButton data-test="sort-comment" color="neutral" variant="ghost" size="xs" class="font-medium" @click="toggleSort('comment')">
          {{ t('library.columns.comment') }} {{ sortIndicator('comment') }}
        </UButton>
      </template>
      <template #date-header>
        <UButton data-test="sort-date" color="neutral" variant="ghost" size="xs" class="font-medium" @click="toggleSort('date')">
          {{ t('library.columns.date') }} {{ sortIndicator('date') }}
        </UButton>
      </template>
      <template #composer-header><span class="font-medium">{{ t('library.columns.composer') }}</span></template>
      <template #duration-header><span class="font-medium">{{ t('library.columns.duration') }}</span></template>
      <template #bitrate-header><span class="font-medium">{{ t('library.columns.bitrate') }}</span></template>

      <!-- Cell slots -->
      <template #select-cell="{ row }">
        <UCheckbox
          :data-test="`row-select-${row.original.id}`"
          :model-value="selectedIds.has(row.original.id)"
          :aria-label="t('library.selectRow')"
          @update:model-value="(v) => toggleRow(row.original.id, v === true)"
        />
      </template>
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
      <template #comment-cell="{ row }">{{ row.original.metadata?.comment }}</template>
      <template #date-cell="{ row }">{{ row.original.metadata?.recordedAt }}</template>
      <template #composer-cell="{ row }">{{ row.original.metadata?.composer }}</template>
      <template #duration-cell="{ row }">{{ fmtDuration(row.original.audioProperties?.duration) }}</template>
      <template #bitrate-cell="{ row }">{{ fmtBitrate(row.original.audioProperties?.bitrate) }}</template>
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
