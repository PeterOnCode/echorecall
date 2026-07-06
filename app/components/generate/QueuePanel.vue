<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { moveArrayElement, useSortable } from '@vueuse/integrations/useSortable'
import type { QueueCost, QueueItem } from '../../composables/useQueue'

// 007 · The pending-queue list as a Nuxt UI UTable with drag-and-drop reordering
// (https://ui.nuxt.com/docs/components/table#with-drag-and-drop). Columns: select (checkbox,
// with select-all in the header) · text (also the drag handle) · cost (US5) · status · remove.
// Dragging a row reorders the queue via the `reorder` emit; because the derived Track is the
// row's queue position (useQueue.stampDerivedMetadata), a reorder renumbers the tracks at
// generation time. A bulk toolbar (shown only when there are items) offers Delete selected +
// Clear queue. Selection state is owned by the page (useQueue's checkedIds) via `selectedIds`;
// the panel is otherwise stateless and emits the intents.
const props = defineProps<{ items: QueueItem[]; cost?: QueueCost; selectedIds?: Set<string> }>()
const emit = defineEmits<{
  remove: [clientId: string]
  toggle: [clientId: string]
  'toggle-all': []
  clear: []
  'delete-selected': []
  reorder: [orderedClientIds: string[]]
}>()
const { t, locale } = useI18n()

// UTable renders from this local mirror so sortablejs can reorder it directly. It holds the SAME
// row objects as props.items (shallow copy), so per-row status/cost updates still reflect live;
// it is only re-mirrored when the queue's id set/order changes (add/remove/reorder from the
// page), not on in-row edits.
const rows = ref<QueueItem[]>([...props.items])
watch(
  () => props.items.map((i) => i.clientId).join(','),
  () => { rows.value = [...props.items] },
)

const columns: TableColumn<QueueItem>[] = [
  { id: 'select' },
  { id: 'text', accessorKey: 'text' },
  { id: 'cost' },
  { id: 'status' },
  { id: 'remove' },
]

// --- Drag-and-drop reorder (Nuxt UI table pattern via useSortable) --------------
const panel = ref<HTMLElement | null>(null)
// The <tbody> only exists while the table is rendered (a non-empty queue). Track it in a
// reactive ref so useSortable (watchElement) attaches when rows appear and detaches when the
// queue empties. The `.queue-drag-handle` (the text cell) is the drag handle, so the row
// checkbox and remove button stay click-safe. Sync from onMounted (panel is bound by then) and
// re-sync whenever the row count crosses to/from zero — a plain reactive watch can't rely on
// its first (immediate) run landing after the ref is bound.
const tbody = ref<HTMLElement | null>(null)
function syncTbody() {
  tbody.value = props.items.length > 0 ? (panel.value?.querySelector('tbody') ?? null) : null
}
onMounted(async () => {
  await nextTick()
  syncTbody()
})
watch(
  () => props.items.length > 0,
  async () => {
    await nextTick()
    syncTbody()
  },
)
useSortable(tbody, rows, {
  animation: 150,
  handle: '.queue-drag-handle',
  watchElement: true,
  onUpdate: (e) => {
    const { oldIndex, newIndex } = e
    if (oldIndex === undefined || newIndex === undefined) return
    // Reconcile the DOM + local mirror, then emit the resulting order for the page to apply to
    // useQueue (which owns the queue). rows.value updates on the next tick.
    moveArrayElement(rows, oldIndex, newIndex, e)
    nextTick(() => emit('reorder', rows.value.map((r) => r.clientId)))
  },
})

// --- Selection + bulk actions ---------------------------------------------------
const selected = computed(() => props.selectedIds ?? new Set<string>())
// Count only selections still present in the queue (a removed row is dropped from the set by
// useQueue, but guard anyway so the label/enabled-state can never go stale).
const selectedCount = computed(() =>
  props.items.reduce((n, i) => n + (selected.value.has(i.clientId) ? 1 : 0), 0),
)
const allChecked = computed(
  () => props.items.length > 0 && props.items.every((i) => selected.value.has(i.clientId)),
)
function isChecked(clientId: string): boolean {
  return selected.value.has(clientId)
}

// --- Cost -----------------------------------------------------------------------
/** Format a USD amount in the active locale; sub-cent estimates keep up to 4 decimals. */
function formatUsd(amount: number): string {
  return new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount)
}
/** A row's cost label: the "unavailable" text for token-priced models, else the amount. */
function costLabel(clientId: string): string {
  const estimate = props.cost?.perItem.get(clientId)
  if (!estimate) return ''
  return estimate === 'unavailable'
    ? t('generateNext.cost.unavailable')
    : formatUsd(estimate.amountUsd)
}
</script>

<template>
  <div ref="panel" data-test="queue-panel" class="flex flex-col gap-2">
    <p v-if="items.length === 0" data-test="queue-empty" class="text-sm text-muted">
      {{ t('generateNext.queue.empty') }}
    </p>
    <template v-else>
      <!-- Bulk toolbar: selected count, delete selected, clear queue (select-all lives in the
           table's select-column header). -->
      <div data-test="queue-toolbar" class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-muted">
          {{ t('generateNext.queue.selectedCount', { count: selectedCount }) }}
        </span>
        <div class="ms-auto flex items-center gap-2">
          <UButton
            data-test="queue-delete-selected"
            color="error"
            variant="outline"
            icon="i-lucide-trash-2"
            size="sm"
            :disabled="selectedCount === 0"
            @click="emit('delete-selected')"
          >
            {{ t('generateNext.queue.deleteSelected', { count: selectedCount }) }}
          </UButton>
          <UButton
            data-test="queue-clear"
            color="neutral"
            variant="outline"
            icon="i-lucide-eraser"
            size="sm"
            @click="emit('clear')"
          >
            {{ t('generateNext.queue.clear') }}
          </UButton>
        </div>
      </div>

      <UTable
        :data="rows"
        :columns="columns"
        :get-row-id="(row: QueueItem) => row.clientId"
        class="rounded-lg border border-default"
      >
        <!-- select -->
        <template #select-header>
          <UCheckbox
            data-test="queue-select-all"
            :model-value="allChecked"
            :aria-label="t('generateNext.queue.selectAll')"
            @update:model-value="emit('toggle-all')"
          />
        </template>
        <template #select-cell="{ row }">
          <UCheckbox
            data-test="queue-row-checkbox"
            :model-value="isChecked(row.original.clientId)"
            :aria-label="t('generateNext.queue.selectRow')"
            @update:model-value="emit('toggle', row.original.clientId)"
          />
        </template>

        <!-- text (also the drag handle) -->
        <template #text-header>
          <span class="font-medium">{{ t('generateNext.queue.columns.text') }}</span>
        </template>
        <template #text-cell="{ row }">
          <span
            data-test="queue-row"
            class="queue-drag-handle block w-full cursor-move select-none truncate text-sm"
            :title="t('generateNext.queue.dragHandle')"
          >{{ row.original.text }}</span>
        </template>

        <!-- cost -->
        <template #cost-header>
          <span class="font-medium">{{ t('generateNext.queue.columns.cost') }}</span>
        </template>
        <template #cost-cell="{ row }">
          <span data-test="queue-row-cost" class="whitespace-nowrap text-xs text-muted">
            {{ costLabel(row.original.clientId) }}
          </span>
        </template>

        <!-- status -->
        <template #status-header>
          <span class="font-medium">{{ t('generateNext.queue.columns.status') }}</span>
        </template>
        <template #status-cell="{ row }">
          <span data-test="queue-row-status" class="text-xs uppercase text-muted">{{ row.original.status }}</span>
        </template>

        <!-- remove -->
        <template #remove-header><span class="sr-only">{{ t('generateNext.queue.remove') }}</span></template>
        <template #remove-cell="{ row }">
          <UButton
            data-test="remove-item"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            :aria-label="t('generateNext.queue.remove')"
            @click="emit('remove', row.original.clientId)"
          />
        </template>
      </UTable>
    </template>
  </div>
</template>
