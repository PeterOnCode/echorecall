<script setup lang="ts">
// 007 · US1 (FR-007): the generation action bar — a queue summary + count badge and
// Save queue / Load queue / Upload .txt batch / Generate. Generate is disabled when the
// queue is empty or a run is in flight. `totalUsd`/`unavailableCount` are optional and
// filled by the per-item cost estimate in US5 (kept here so the bar's props are stable).
withDefaults(
  defineProps<{
    queueCount: number
    busy?: boolean
    totalUsd?: number
    unavailableCount?: number
  }>(),
  { busy: false, totalUsd: 0, unavailableCount: 0 },
)
const emit = defineEmits<{ 'save-queue': []; 'load-queue': []; 'upload-txt': []; generate: [] }>()
const { t } = useI18n()
</script>

<template>
  <div
    data-test="action-bar"
    class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-default p-3"
  >
    <div class="flex items-center gap-2">
      <span class="text-sm text-muted">{{ t('generateNext.actionBar.summary') }}</span>
      <UBadge data-test="queue-count-badge" color="primary" variant="subtle">{{ queueCount }}</UBadge>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UButton
        data-test="action-save-queue"
        color="neutral"
        variant="outline"
        icon="i-lucide-save"
        @click="emit('save-queue')"
      >
        {{ t('generateNext.actionBar.saveQueue') }}
      </UButton>
      <UButton
        data-test="action-load-queue"
        color="neutral"
        variant="outline"
        icon="i-lucide-folder-open"
        @click="emit('load-queue')"
      >
        {{ t('generateNext.actionBar.loadQueue') }}
      </UButton>
      <UButton
        data-test="action-upload-txt"
        color="neutral"
        variant="outline"
        icon="i-lucide-upload"
        @click="emit('upload-txt')"
      >
        {{ t('generateNext.actionBar.uploadTxt') }}
      </UButton>
      <UButton
        data-test="action-generate"
        icon="i-lucide-mic"
        :disabled="queueCount === 0 || busy"
        :loading="busy"
        @click="emit('generate')"
      >
        {{ t('generateNext.actionBar.generate') }}
      </UButton>
    </div>
  </div>
</template>
