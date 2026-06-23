<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { QueueItem } from '../../composables/useQueue'

// The Generate list pane (005 redesign / US1 · FR-001/003): the ephemeral queue
// rendered as a selectable table. Clicking a row sets the active id (v-model) so
// the detail pane loads that item's metadata editor — per-row editing now lives
// there, not inline. Search, filters, the checkbox column, and the source column
// land in US3; this is the minimal selectable list the workspace needs.
defineProps<{ items: QueueItem[] }>()
const activeId = defineModel<string | null>('activeId', { default: null })
const emit = defineEmits<{ remove: [clientId: string] }>()
const { t } = useI18n()

const columns: TableColumn<QueueItem>[] = [
  { id: 'text', accessorKey: 'text' },
  { id: 'status' },
  { id: 'actions' },
]

const STATUS_COLOR: Record<QueueItem['status'], string> = {
  queued: 'text-muted',
  generating: 'text-info',
  done: 'text-success',
  failed: 'text-error',
}

function setActive(clientId: string) {
  activeId.value = clientId
}
</script>

<template>
  <div>
    <p v-if="items.length === 0" data-test="queue-empty" class="text-sm text-muted">
      {{ t('generate.queue.empty') }}
    </p>

    <div v-else data-test="queue-table">
      <UTable :data="items" :columns="columns" :get-row-id="(row: QueueItem) => row.clientId">
        <template #text-header>
          <span class="font-medium">{{ t('generate.queue.columns.text') }}</span>
        </template>
        <template #status-header>
          <span class="font-medium">{{ t('generate.queue.columns.status') }}</span>
        </template>
        <template #actions-header>
          <span class="sr-only">{{ t('generate.queue.columns.actions') }}</span>
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
        <template #status-cell="{ row }">
          <span
            data-test="item-status"
            class="text-xs uppercase"
            :class="STATUS_COLOR[row.original.status]"
          >
            {{ row.original.status }}
          </span>
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
  </div>
</template>
