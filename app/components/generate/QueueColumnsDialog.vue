<script setup lang="ts">
import type { QueueColumnId } from '../../composables/useViewPreferences'

// Column-visibility chooser for the queue (005 · US3 / FR-012, contract §4). A modal
// with one toggle per data column, controlled via v-model:columns. The not-all-hidden
// guard never lets the user hide every column: the last remaining visible toggle is
// disabled. Persistence lives in useViewPreferences (the page binds this dialog's
// columns model to it), so this component stays presentational.
const open = defineModel<boolean>('open', { default: false })
const columns = defineModel<Record<QueueColumnId, boolean>>('columns', { required: true })
const { t } = useI18n()

const COLUMN_IDS: QueueColumnId[] = ['source', 'voice', 'format', 'recordedAt', 'language', 'status']
const visibleCount = computed(() => COLUMN_IDS.filter((id) => columns.value[id]).length)

function toggle(id: QueueColumnId, value: boolean) {
  // Refuse to hide the last visible column (FR-012).
  if (!value && columns.value[id] && visibleCount.value <= 1) return
  columns.value = { ...columns.value, [id]: value }
}
</script>

<template>
  <UModal v-model:open="open" :title="t('generate.columns.title')">
    <template #content>
      <div data-test="queue-columns-dialog" class="flex flex-col gap-4 p-4 sm:p-6">
        <h3 class="text-base font-semibold text-highlighted">{{ t('generate.columns.title') }}</h3>
        <div class="flex flex-col gap-2">
          <UCheckbox
            v-for="id in COLUMN_IDS"
            :key="id"
            :data-test="`queue-column-toggle-${id}`"
            :model-value="columns[id]"
            :disabled="columns[id] && visibleCount <= 1"
            :label="t(`generate.columns.${id}`)"
            @update:model-value="(value) => toggle(id, value === true)"
          />
        </div>
        <div class="flex justify-end">
          <UButton data-test="queue-columns-apply" size="sm" @click="open = false">
            {{ t('generate.columns.apply') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
