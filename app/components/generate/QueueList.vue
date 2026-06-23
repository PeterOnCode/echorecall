<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { FORMATS, type Format, type Voice } from '#core/client'
import { parseDate, type CalendarDate } from '@internationalized/date'
import type { QueueFilters, QueueItem } from '../../composables/useQueue'
import type { QueueColumnId } from '../../composables/useViewPreferences'

// The Generate list pane (005 redesign / US1+US3 · FR-001/003/006/009/010/011/012):
// the queue rendered as a selectable, searchable, filterable table. Clicking a row
// sets the active id (v-model:active-id) so the detail pane loads it; a leading
// checkbox column drives the multi-select set (v-model:checked-ids) used for bulk
// delete and the generate target; a source column shows the uploaded filename or a
// "Text Entered" label; search + per-field filters narrow the rows (the actual
// filtering lives in useQueue, this pane is driven by `items` = the visible set);
// and column visibility is configurable (gated by `visibleColumns`, chosen in the
// columns dialog). select / text / actions are structural columns, always present.
const props = withDefaults(
  defineProps<{
    items: QueueItem[]
    voices?: Voice[]
    visibleColumns?: Record<QueueColumnId, boolean>
  }>(),
  {
    voices: () => [],
    visibleColumns: () => ({
      source: true,
      voice: true,
      format: true,
      recordedAt: true,
      language: true,
      status: true,
    }),
  },
)
const activeId = defineModel<string | null>('activeId', { default: null })
const checkedIds = defineModel<Set<string>>('checkedIds', { default: () => new Set() })
const search = defineModel<string>('search', { default: '' })
const filters = defineModel<QueueFilters>('filters', { default: () => ({}) })
const emit = defineEmits<{ remove: [clientId: string]; 'open-columns': []; 'delete-selected': [] }>()
const { t, locale } = useI18n()

// reka-ui's Combobox reserves '' for its cleared/placeholder state, so the "all"
// (no filter) option uses a non-empty sentinel that maps back to undefined.
const ALL = '__all__'

const columns = computed<TableColumn<QueueItem>[]>(() => {
  const cols: TableColumn<QueueItem>[] = [{ id: 'select' }]
  if (props.visibleColumns.source) cols.push({ id: 'source' })
  cols.push({ id: 'text', accessorKey: 'text' })
  if (props.visibleColumns.voice) cols.push({ id: 'voice' })
  if (props.visibleColumns.format) cols.push({ id: 'format' })
  if (props.visibleColumns.recordedAt) cols.push({ id: 'recordedAt' })
  if (props.visibleColumns.language) cols.push({ id: 'language' })
  if (props.visibleColumns.status) cols.push({ id: 'status' })
  cols.push({ id: 'actions' })
  return cols
})

const STATUS_COLOR: Record<QueueItem['status'], string> = {
  queued: 'text-muted',
  generating: 'text-info',
  done: 'text-success',
  failed: 'text-error',
}

function setActive(clientId: string) {
  activeId.value = clientId
}

// Multi-select (v-model:checked-ids). Header toggles all visible rows; row toggles one.
function isChecked(id: string) {
  return checkedIds.value.has(id)
}
function setRowChecked(id: string, value: boolean) {
  const next = new Set(checkedIds.value)
  if (value) next.add(id)
  else next.delete(id)
  checkedIds.value = next
}
const allChecked = computed(
  () => props.items.length > 0 && props.items.every((i) => checkedIds.value.has(i.clientId)),
)
function setAllChecked(value: boolean) {
  const next = new Set(checkedIds.value)
  for (const i of props.items) {
    if (value) next.add(i.clientId)
    else next.delete(i.clientId)
  }
  checkedIds.value = next
}
const checkedCount = computed(() => checkedIds.value.size)

// Source-column display: the uploaded filename, else the localized "Text Entered".
function sourceLabel(item: QueueItem): string {
  return item.source === 'upload' ? (item.sourceName ?? '') : t('generate.queue.textEntered')
}
function voiceLabel(id: string): string {
  return props.voices.find((v) => v.id === id)?.label ?? id
}

// Filters: USelectMenu with the `__all__` sentinel mapping to "no filter".
const voiceItems = computed(() => [
  { id: ALL, label: t('generate.queue.filters.allVoices') },
  ...props.voices.map((v) => ({ id: v.id, label: v.label })),
])
const formatItems = computed(() => [
  { id: ALL, label: t('generate.queue.filters.allFormats') },
  ...FORMATS.map((f) => ({ id: f.id, label: f.ext.toUpperCase() })),
])
function distinct(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => !!value))].sort()
}
const albumItems = computed(() => [
  { id: ALL, label: t('generate.queue.filters.allAlbums') },
  ...distinct(props.items.map((i) => i.metadata.album)).map((a) => ({ id: a, label: a })),
])
const languageItems = computed(() => [
  { id: ALL, label: t('generate.queue.filters.allLanguages') },
  ...distinct(props.items.flatMap((i) => i.metadata.languages ?? [])).map((l) => ({ id: l, label: l })),
])

const voiceFilter = computed<string>({
  get: () => filters.value.voiceId ?? ALL,
  set: (value) => {
    filters.value = { ...filters.value, voiceId: value === ALL ? undefined : value }
  },
})
const formatFilter = computed<string>({
  get: () => filters.value.format ?? ALL,
  set: (value) => {
    filters.value = { ...filters.value, format: value === ALL ? undefined : (value as Format) }
  },
})
const albumFilter = computed<string>({
  get: () => filters.value.album ?? ALL,
  set: (value) => {
    filters.value = { ...filters.value, album: value === ALL ? undefined : value }
  },
})
const languageFilter = computed<string>({
  get: () => filters.value.language ?? ALL,
  set: (value) => {
    filters.value = { ...filters.value, language: value === ALL ? undefined : value }
  },
})

// Recording-date filter: a UPopover + UCalendar mapping the stored YYYY-MM-DD string.
const recordedAtDate = computed<CalendarDate | undefined>({
  get: () => {
    const value = filters.value.recordedAt
    if (!value) return undefined
    try {
      return parseDate(value)
    } catch {
      return undefined
    }
  },
  set: (value) => {
    filters.value = { ...filters.value, recordedAt: value ? value.toString() : undefined }
  },
})
const recordedAtLabel = computed(() => {
  const date = recordedAtDate.value
  if (!date) return t('generate.queue.filters.anyDate')
  return new Date(date.year, date.month - 1, date.day).toLocaleDateString(locale.value)
})
function clearRecordedAt() {
  recordedAtDate.value = undefined
}

function clearFilters() {
  search.value = ''
  filters.value = {}
}

// Multi-select delete, confirmed before it removes anything (FR-011).
const confirmDelete = ref(false)
function requestDelete() {
  if (checkedCount.value > 0) confirmDelete.value = true
}
function onConfirmDelete() {
  confirmDelete.value = false
  emit('delete-selected')
}
function onCancelDelete() {
  confirmDelete.value = false
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Search + filters + view controls -->
    <div class="flex flex-wrap items-end gap-2">
      <UFormField :label="t('generate.queue.searchLabel')" class="min-w-40 flex-1">
        <UInput
          v-model="search"
          data-test="queue-search"
          type="search"
          :placeholder="t('generate.queue.searchPlaceholder')"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('generate.queue.filters.voice')">
        <USelectMenu
          v-model="voiceFilter"
          data-test="queue-filter-voice"
          value-key="id"
          label-key="label"
          :items="voiceItems"
        />
      </UFormField>
      <UFormField :label="t('generate.queue.filters.format')">
        <USelectMenu
          v-model="formatFilter"
          data-test="queue-filter-format"
          value-key="id"
          label-key="label"
          :items="formatItems"
        />
      </UFormField>
      <UFormField :label="t('generate.queue.filters.album')">
        <USelectMenu
          v-model="albumFilter"
          data-test="queue-filter-album"
          value-key="id"
          label-key="label"
          :items="albumItems"
        />
      </UFormField>
      <UFormField :label="t('generate.queue.filters.recordedAt')">
        <UPopover>
          <UButton
            data-test="queue-filter-recordedAt"
            color="neutral"
            variant="outline"
            icon="i-lucide-calendar"
          >
            {{ recordedAtLabel }}
          </UButton>
          <template #content>
            <div class="flex flex-col gap-2 p-2">
              <UCalendar v-model="recordedAtDate" />
              <div class="flex justify-end">
                <UButton color="neutral" variant="ghost" size="xs" @click="clearRecordedAt">
                  {{ t('generate.queue.filters.clearDate') }}
                </UButton>
              </div>
            </div>
          </template>
        </UPopover>
      </UFormField>
      <UFormField :label="t('generate.queue.filters.language')">
        <USelectMenu
          v-model="languageFilter"
          data-test="queue-filter-language"
          value-key="id"
          label-key="label"
          :items="languageItems"
        />
      </UFormField>

      <UButton
        data-test="queue-filters-clear"
        color="neutral"
        variant="ghost"
        icon="i-lucide-filter-x"
        @click="clearFilters"
      >
        {{ t('generate.queue.filters.clear') }}
      </UButton>
      <UButton
        data-test="queue-columns-button"
        color="neutral"
        variant="outline"
        icon="i-lucide-columns-3"
        @click="emit('open-columns')"
      >
        {{ t('generate.columns.title') }}
      </UButton>
    </div>

    <div v-if="checkedCount > 0">
      <UButton
        data-test="queue-delete-selected"
        color="error"
        variant="outline"
        icon="i-lucide-trash-2"
        size="sm"
        @click="requestDelete"
      >
        {{ t('generate.queue.deleteSelected', { count: checkedCount }) }}
      </UButton>
    </div>

    <p v-if="items.length === 0" data-test="queue-empty" class="text-sm text-muted">
      {{ t('generate.queue.empty') }}
    </p>

    <div v-else data-test="queue-table">
      <UTable :data="items" :columns="columns" :get-row-id="(row: QueueItem) => row.clientId">
        <template #select-header>
          <UCheckbox
            data-test="queue-select-all"
            :model-value="allChecked"
            :aria-label="t('generate.queue.selectAll')"
            @update:model-value="(value) => setAllChecked(value === true)"
          />
        </template>
        <template #select-cell="{ row }">
          <UCheckbox
            data-test="queue-row-checkbox"
            :model-value="isChecked(row.original.clientId)"
            :aria-label="t('generate.queue.selectRow')"
            @update:model-value="(value) => setRowChecked(row.original.clientId, value === true)"
          />
        </template>

        <template #source-header>
          <span data-test="queue-col-source" class="font-medium">{{ t('generate.columns.source') }}</span>
        </template>
        <template #source-cell="{ row }">
          <span data-test="queue-row-source" class="block max-w-40 truncate text-sm text-muted">
            {{ sourceLabel(row.original) }}
          </span>
        </template>

        <template #text-header>
          <span class="font-medium">{{ t('generate.queue.columns.text') }}</span>
        </template>
        <template #text-cell="{ row }">
          <button
            type="button"
            data-test="queue-row"
            :aria-pressed="activeId === row.original.clientId"
            class="flex w-full items-center gap-2 text-left"
            :class="{ 'font-medium text-primary': activeId === row.original.clientId }"
            @click="setActive(row.original.clientId)"
          >
            <span class="flex-1 truncate">{{ row.original.text }}</span>
            <span v-if="row.original.error" class="text-xs text-error" :title="row.original.error">⚠</span>
          </button>
        </template>

        <template #voice-header>
          <span data-test="queue-col-voice" class="font-medium">{{ t('generate.columns.voice') }}</span>
        </template>
        <template #voice-cell="{ row }">
          <span class="text-sm">{{ voiceLabel(row.original.voiceId) }}</span>
        </template>

        <template #format-header>
          <span data-test="queue-col-format" class="font-medium">{{ t('generate.columns.format') }}</span>
        </template>
        <template #format-cell="{ row }">
          <span class="text-sm uppercase">{{ row.original.format }}</span>
        </template>

        <template #recordedAt-header>
          <span data-test="queue-col-recordedAt" class="font-medium">{{ t('generate.columns.recordedAt') }}</span>
        </template>
        <template #recordedAt-cell="{ row }">
          <span class="text-sm tabular-nums">{{ row.original.metadata.recordedAt ?? '—' }}</span>
        </template>

        <template #language-header>
          <span data-test="queue-col-language" class="font-medium">{{ t('generate.columns.language') }}</span>
        </template>
        <template #language-cell="{ row }">
          <span class="text-sm">{{ (row.original.metadata.languages ?? []).join(', ') || '—' }}</span>
        </template>

        <template #status-header>
          <span data-test="queue-col-status" class="font-medium">{{ t('generate.columns.status') }}</span>
        </template>
        <template #status-cell="{ row }">
          <span data-test="item-status" class="text-xs uppercase" :class="STATUS_COLOR[row.original.status]">
            {{ row.original.status }}
          </span>
        </template>

        <template #actions-header>
          <span class="sr-only">{{ t('generate.queue.columns.actions') }}</span>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end">
            <UButton
              data-test="remove-item"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              size="xs"
              :aria-label="t('generate.queue.remove')"
              @click="emit('remove', row.original.clientId)"
            />
          </div>
        </template>
      </UTable>
    </div>

    <ConfirmDialog
      :open="confirmDelete"
      :title="t('generate.queue.deleteTitle')"
      :message="t('generate.queue.deleteMessage', { count: checkedCount })"
      :confirm-label="t('generate.queue.deleteConfirm')"
      :cancel-label="t('generate.queue.deleteCancel')"
      @confirm="onConfirmDelete"
      @cancel="onCancelDelete"
    />
  </div>
</template>
