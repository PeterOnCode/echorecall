<script setup lang="ts">
import type { QueueItem } from '../../composables/useQueue'

// 007 · US1 (FR-018 host): the compact pending-queue list that replaces the 005 two-pane
// QueueList. Each row shows a text preview + status + remove; an empty queue shows a
// placeholder. The per-item cost estimate (US5) renders into `queue-row-cost` later.
defineProps<{ items: QueueItem[] }>()
const emit = defineEmits<{ remove: [clientId: string] }>()
const { t } = useI18n()
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
