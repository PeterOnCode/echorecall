<script setup lang="ts">
import type { QueueItem } from '../../composables/useQueue'

// Renders the ephemeral queue with each row's live generation status. Per-row
// editing is added in US3; for now rows can be removed.
defineProps<{ items: QueueItem[] }>()
const emit = defineEmits<{ remove: [clientId: string] }>()
const { t } = useI18n()

const STATUS_COLOR: Record<QueueItem['status'], string> = {
  queued: 'text-muted',
  generating: 'text-info',
  done: 'text-success',
  failed: 'text-error',
}
</script>

<template>
  <div>
    <p v-if="items.length === 0" data-test="queue-empty" class="text-sm text-muted">
      {{ t('generate.queue.empty') }}
    </p>
    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="item in items"
        :key="item.clientId"
        data-test="queue-item"
        class="flex flex-col gap-2 rounded border p-2"
      >
        <div class="flex items-center gap-3">
          <span class="flex-1 truncate">{{ item.text }}</span>
          <span
            data-test="item-status"
            class="text-xs uppercase"
            :class="STATUS_COLOR[item.status]"
          >
            {{ item.status }}
          </span>
          <span v-if="item.error" class="text-xs text-error" :title="item.error">⚠</span>
          <UButton
            data-test="remove-item"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            size="xs"
            :aria-label="t('generate.queue.remove')"
            @click="emit('remove', item.clientId)"
          />
        </div>

        <!-- A finished item is playable + downloadable in place; all items are
             also saved to the library and bundled by Download all (.zip). -->
        <div v-if="item.status === 'done' && item.result" class="flex items-center gap-3">
          <AudioPlayer :src="item.result.audioUrl" :label="item.text" class="flex-1" />
          <UButton
            data-test="item-download"
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-lucide-download"
            :href="`${item.result.audioUrl}?download=1`"
            :aria-label="t('generate.queue.download')"
          />
        </div>
      </li>
    </ul>
  </div>
</template>
