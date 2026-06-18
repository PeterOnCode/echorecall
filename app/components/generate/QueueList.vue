<script setup lang="ts">
import type { Voice } from '#core/client'
import type { ItemPatch, QueueItem } from '../../composables/useQueue'

// Renders the ephemeral queue with each row's live generation status. A row that
// hasn't generated yet (queued/failed) can be expanded into a per-row editor
// (US3); rows can also be removed.
defineProps<{ items: QueueItem[]; voices: Voice[] }>()
const emit = defineEmits<{ remove: [clientId: string]; update: [clientId: string, patch: ItemPatch] }>()
const { t } = useI18n()

// Which row's editor is open (one at a time). A row is editable until it has
// successfully generated; a failed row stays editable so it can be fixed + retried.
const editingId = ref<string | null>(null)
function canEdit(item: QueueItem): boolean {
  return item.status === 'queued' || item.status === 'failed'
}
function toggleEdit(clientId: string): void {
  editingId.value = editingId.value === clientId ? null : clientId
}

const STATUS_COLOR: Record<QueueItem['status'], string> = {
  queued: 'text-muted',
  generating: 'text-info',
  done: 'text-success',
  failed: 'text-error',
}

/** Human notice for tags skipped by the chosen format (FR-021). */
function skippedLabel(skipped: string[]): string {
  if (skipped.includes('*')) return t('generate.metadata.skippedAll')
  return t('generate.metadata.skipped', { fields: skipped.join(', ') })
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
            v-if="canEdit(item)"
            data-test="edit-item"
            color="neutral"
            variant="ghost"
            icon="i-lucide-pencil"
            size="xs"
            :aria-expanded="editingId === item.clientId"
            :aria-label="t('generate.queue.edit')"
            @click="toggleEdit(item.clientId)"
          />
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

        <!-- Per-row editor (US3): open/close via the pencil; edits apply to this
             row only and reflect immediately. -->
        <QueueItemEditor
          v-if="editingId === item.clientId && canEdit(item)"
          :item="item"
          :voices="voices"
          @update="(patch) => emit('update', item.clientId, patch)"
        />

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

        <!-- Tags the chosen format couldn't carry (FR-021) — informational, the
             clip still generated and saved. -->
        <p
          v-if="item.status === 'done' && item.result?.skippedTags?.length"
          data-test="item-skipped"
          class="text-xs text-warning"
        >
          {{ skippedLabel(item.result.skippedTags) }}
        </p>
      </li>
    </ul>
  </div>
</template>
