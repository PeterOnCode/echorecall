<script setup lang="ts">
import type { BulkCleanFilter, LibraryQuery, Metadata } from '#core/client'
import type { LibraryItem } from '../../composables/useLibrary'

// The library discovery surface (US6 / FR-034–037). Controlled and network-free:
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

const COLUMN_COUNT = 5

// --- Sorting -------------------------------------------------------------------
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

function toggleReplay(id: string) {
  playingId.value = playingId.value === id ? null : id
}

function toggleEdit(id: string) {
  editingId.value = editingId.value === id ? null : id
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

    <table v-else class="w-full border-collapse text-sm table-fixed">
      <thead>
        <tr class="border-b text-left">
          <th class="py-2 pr-3">
            <button type="button" data-test="sort-title" class="font-medium" @click="toggleSort('title')">
              {{ t('library.columns.name') }} {{ sortIndicator('title') }}
            </button>
          </th>
          <th class="py-2 pr-3">
            <button type="button" data-test="sort-voice" class="font-medium" @click="toggleSort('voice')">
              {{ t('library.columns.voice') }} {{ sortIndicator('voice') }}
            </button>
          </th>
          <th class="py-2 pr-3">
            <button type="button" data-test="sort-format" class="font-medium" @click="toggleSort('format')">
              {{ t('library.columns.format') }} {{ sortIndicator('format') }}
            </button>
          </th>
          <th class="py-2 pr-3">
            <button
              type="button"
              data-test="sort-createdAt"
              class="font-medium"
              @click="toggleSort('createdAt')"
            >
              {{ t('library.columns.created') }} {{ sortIndicator('createdAt') }}
            </button>
          </th>
          <th class="py-2 text-right font-medium">{{ t('library.columns.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="g in items" :key="g.id">
          <tr data-test="library-row" class="border-b align-top">
            <td class="py-2 pr-3">
              <p class="font-medium" :class="{ 'text-muted line-through': isUnavailable(g.id) }">
                {{ g.filename }}
              </p>
              <p class="whitespace-normal break-words text-xs text-muted">{{ g.text }}</p>
              <p v-if="isUnavailable(g.id)" data-test="row-unavailable" class="text-xs text-error">
                {{ t('library.unavailable') }}
              </p>
            </td>
            <td class="py-2 pr-3">{{ g.voiceId }}</td>
            <td class="py-2 pr-3 uppercase">{{ g.format }}</td>
            <td class="py-2 pr-3 whitespace-nowrap">{{ new Date(g.createdAt).toLocaleString() }}</td>
            <td class="py-2">
              <div class="flex justify-end gap-1">
                <UButton
                  data-test="replay"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-play"
                  :disabled="isUnavailable(g.id)"
                  :aria-label="t('library.item.replay')"
                  @click="toggleReplay(g.id)"
                />
                <UButton
                  data-test="download"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-download"
                  :href="downloadUrl(g.audioUrl)"
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
                  :aria-expanded="editingId === g.id"
                  :aria-label="t('library.item.edit')"
                  @click="toggleEdit(g.id)"
                />
              </div>
            </td>
          </tr>
          <tr v-if="playingId === g.id" :key="`${g.id}-player`">
            <td :colspan="COLUMN_COUNT" class="pb-3">
              <AudioPlayer :src="g.audioUrl" :label="g.filename" @error="markUnavailable(g.id)" />
            </td>
          </tr>
          <tr v-if="editingId === g.id" :key="`${g.id}-editor`">
            <td :colspan="COLUMN_COUNT" class="pb-3">
              <LibraryItemEditor
                :item="g"
                @save="(patch) => onEditorSave(g, patch)"
                @delete="(id) => emit('delete', id)"
                @cancel="editingId = null"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>

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
