<script setup lang="ts">
import type { QueueCost, QueueItem } from '../../composables/useQueue'

// 007 · US1 (FR-018 host): the compact pending-queue list that replaces the 005 two-pane
// QueueList. Each row shows a leading selection checkbox, a text preview, per-item cost
// (US5), a status, and a remove button; an empty queue shows a placeholder. A bulk toolbar
// (shown only when there are items) offers select-all, "Delete selected" over the checked
// rows, and "Clear queue". Selection state is owned by the page (useQueue's checkedIds) and
// passed via `selectedIds`; the panel is otherwise stateless and emits the intents.
const props = defineProps<{ items: QueueItem[]; cost?: QueueCost; selectedIds?: Set<string> }>()
const emit = defineEmits<{
  remove: [clientId: string]
  toggle: [clientId: string]
  'toggle-all': []
  clear: []
  'delete-selected': []
}>()
const { t, locale } = useI18n()

const selected = computed(() => props.selectedIds ?? new Set<string>())
// Count only selections still present in the queue (a removed row is dropped from the set
// by useQueue, but guard anyway so the label/enabled-state can never go stale).
const selectedCount = computed(() => props.items.reduce((n, i) => n + (selected.value.has(i.clientId) ? 1 : 0), 0))
const allChecked = computed(
  () => props.items.length > 0 && props.items.every((i) => selected.value.has(i.clientId)),
)
function isChecked(clientId: string): boolean {
  return selected.value.has(clientId)
}

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
  <div data-test="queue-panel" class="flex flex-col gap-2">
    <p v-if="items.length === 0" data-test="queue-empty" class="text-sm text-muted">
      {{ t('generateNext.queue.empty') }}
    </p>
    <template v-else>
      <!-- Bulk toolbar: select-all, delete selected, clear queue -->
      <div data-test="queue-toolbar" class="flex flex-wrap items-center gap-2">
        <UCheckbox
          data-test="queue-select-all"
          :model-value="allChecked"
          :aria-label="t('generateNext.queue.selectAll')"
          @update:model-value="emit('toggle-all')"
        />
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

      <ul class="flex flex-col divide-y divide-default rounded-lg border border-default">
        <li
          v-for="row in items"
          :key="row.clientId"
          data-test="queue-row"
          class="flex items-center gap-3 p-2"
        >
          <UCheckbox
            data-test="queue-row-checkbox"
            :model-value="isChecked(row.clientId)"
            :aria-label="t('generateNext.queue.selectRow')"
            @update:model-value="emit('toggle', row.clientId)"
          />
          <span class="min-w-0 flex-1 truncate text-sm">{{ row.text }}</span>
          <span
            v-if="cost"
            data-test="queue-row-cost"
            class="whitespace-nowrap text-xs text-muted"
          >
            {{ costLabel(row.clientId) }}
          </span>
          <span data-test="queue-row-status" class="text-xs uppercase text-muted">{{ row.status }}</span>
          <UButton
            data-test="remove-item"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            :aria-label="t('generateNext.queue.remove')"
            @click="emit('remove', row.clientId)"
          />
        </li>
      </ul>
    </template>
  </div>
</template>
