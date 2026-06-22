<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BulkCleanFilter, LibraryQuery, Metadata } from '#core/client'
import type { LibraryItem } from '../../composables/useLibrary'

// The library discovery surface (US6 / FR-034-037). Controlled and network-free:
// it renders a search/filter bar, a sortable table, and pagination that all drive
// a single `query` (v-model:query), plus a bulk-clean trigger. Row actions stay
// inline — replay reuses AudioPlayer over the stored `audioUrl` (no provider
// call), edit opens the existing LibraryItemEditor in an expanded row, and a row
// whose stored audio fails to load shows an "unavailable" badge (FR-029 edge
// case). The page owns the network: it provides `items`/`total`, reloads on
// `update:query`, and handles `save` / `delete` / `bulk-clean`.
const props = defineProps<{ items: LibraryItem[]; total: number }>()
const emit = defineEmits<{
  save: [item: LibraryItem, patch: { filename: string; metadata: Metadata }]
  delete: [id: string]
  'bulk-clean': [filter: BulkCleanFilter]
}>()

const query = defineModel<LibraryQuery>('query', { required: true })
// Which row's inline editor is open. Two-way bound so the page can close it after
// a successful save (the network result lands there).
const editingId = defineModel<string | null>('editingId', { default: null })

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
const playingId = ref<string | null>(null)
const unavailableIds = ref<string[]>([])

// One expanded region per row, driven by replay (player) / edit (editor); they are
// mutually exclusive per row. UTable wants an { [rowId]: true } map; we derive it
// from the two ids and never let the table mutate it (no built-in expand control).
const expanded = computed<Record<string, boolean>>({
  get: () => {
    const r: Record<string, boolean> = {}
    if (playingId.value) r[playingId.value] = true
    if (editingId.value) r[editingId.value] = true
    return r
  },
  set: () => {},
})

function rowMode(id: string): 'player' | 'editor' | 'none' {
  if (editingId.value === id) return 'editor'
  if (playingId.value === id) return 'player'
  return 'none'
}

function toggleReplay(id: string) {
  if (playingId.value === id) {
    playingId.value = null
    return
  }
  playingId.value = id
  if (editingId.value === id) editingId.value = null
}

function toggleEdit(id: string) {
  if (editingId.value === id) {
    editingId.value = null
    return
  }
  editingId.value = id
  if (playingId.value === id) playingId.value = null
}

function downloadUrl(audioUrl: string): string {
  return `${audioUrl}?download=1`
}

function isUnavailable(id: string): boolean {
  return unavailableIds.value.includes(id)
}

// The stored file is gone (or unreadable): the <audio> element errors loading the
// src. Mark the row so the user sees it instead of a silently broken control.
function markUnavailable(id: string) {
  if (!unavailableIds.value.includes(id)) unavailableIds.value = [...unavailableIds.value, id]
  if (playingId.value === id) playingId.value = null
}

function onEditorSave(item: LibraryItem, patch: { filename: string; metadata: Metadata }) {
  emit('save', item, patch)
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
      :expanded="expanded"
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
        <div data-test="library-row">
          <p class="font-medium" :class="{ 'text-muted line-through': isUnavailable(row.original.id) }">
            {{ row.original.filename }}
          </p>
          <p class="whitespace-normal break-words text-xs text-muted">{{ row.original.text }}</p>
          <p v-if="isUnavailable(row.original.id)" data-test="row-unavailable" class="text-xs text-error">
            {{ t('library.unavailable') }}
          </p>
        </div>
      </template>
      <template #voice-cell="{ row }">{{ row.original.voiceId }}</template>
      <template #format-cell="{ row }"><span class="uppercase">{{ row.original.format }}</span></template>
      <template #createdAt-cell="{ row }">
        <span class="whitespace-nowrap">{{ new Date(row.original.createdAt).toLocaleString() }}</span>
      </template>
      <template #actions-cell="{ row }">
        <div class="flex justify-end gap-1">
          <UButton
            data-test="replay"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-play"
            :disabled="isUnavailable(row.original.id)"
            :aria-label="t('library.item.replay')"
            @click="toggleReplay(row.original.id)"
          />
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
          <UButton
            data-test="edit-item"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-pencil"
            :aria-expanded="editingId === row.original.id"
            :aria-label="t('library.item.edit')"
            @click="toggleEdit(row.original.id)"
          />
        </div>
      </template>

      <template #expanded="{ row }">
        <AudioPlayer
          v-if="rowMode(row.original.id) === 'player'"
          :src="row.original.audioUrl"
          :label="row.original.filename"
          @error="markUnavailable(row.original.id)"
        />
        <LibraryItemEditor
          v-else-if="rowMode(row.original.id) === 'editor'"
          :item="row.original"
          @save="(patch) => onEditorSave(row.original, patch)"
          @delete="(id) => emit('delete', id)"
          @cancel="editingId = null"
        />
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
