<script setup lang="ts">
import type { QueueCost, QueueItem } from '../../composables/useQueue'

// 007 · US1 (FR-018 host): the compact pending-queue list that replaces the 005 two-pane
// QueueList. Each row shows a text preview + status + remove; an empty queue shows a
// placeholder. US5 (FR-018/FR-019): a per-item cost renders into `queue-row-cost` — a
// dollar amount for estimable models, an "unavailable" label for the token-priced model.
const props = defineProps<{ items: QueueItem[]; cost?: QueueCost }>()
const emit = defineEmits<{ remove: [clientId: string] }>()
const { t, locale } = useI18n()

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
    <ul v-else class="flex flex-col divide-y divide-default rounded-lg border border-default">
      <li
        v-for="row in items"
        :key="row.clientId"
        data-test="queue-row"
        class="flex items-center gap-3 p-2"
      >
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
  </div>
</template>
