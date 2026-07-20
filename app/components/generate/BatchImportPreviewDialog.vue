<script setup lang="ts">
import type { BatchPreview } from '#core/client'

defineProps<{ open: boolean; preview: BatchPreview }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
const { t } = useI18n()

function onOpenChange(value: boolean) {
  if (!value) emit('cancel')
}
</script>

<template>
  <UModal
    :open="open"
    :title="t('generateNext.batchImport.title')"
    :dismissible="true"
    @update:open="onOpenChange"
  >
    <template #content>
      <div data-test="batch-import-preview-dialog" class="flex max-h-[80vh] flex-col gap-4 p-4 sm:p-6">
        <div>
          <h3 class="text-base font-semibold text-highlighted">
            {{ t('generateNext.batchImport.title') }}
          </h3>
          <p class="text-sm text-muted">{{ preview.filename }}</p>
          <p data-test="batch-preview-counts" class="mt-1 text-sm text-muted">
            {{ t('generateNext.batchImport.counts', {
              valid: preview.counts.valid,
              rejected: preview.counts.rejected,
              blank: preview.counts.blank,
            }) }}
          </p>
        </div>

        <ol class="flex flex-col gap-2 overflow-y-auto">
          <li
            v-for="candidate in preview.candidates"
            :key="`${candidate.location.kind}-${candidate.location.number}`"
            data-test="batch-preview-row"
            class="rounded-md border border-default p-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-medium">
                {{ t(`generateNext.batchImport.${candidate.location.kind}`, { number: candidate.location.number }) }}
              </span>
              <span class="text-xs text-muted">{{ candidate.display.excerpt }}</span>
            </div>
            <dl class="mt-2 grid grid-cols-1 gap-1 text-xs text-muted sm:grid-cols-3">
              <div data-test="batch-preview-voice">
                {{ t('generateNext.batchImport.voice') }}: {{ candidate.display.voiceId }}
              </div>
              <div data-test="batch-preview-model">
                {{ t('generateNext.batchImport.model') }}: {{ candidate.display.model }}
              </div>
              <div data-test="batch-preview-format">
                {{ t('generateNext.batchImport.format') }}: {{ candidate.display.format }}
              </div>
            </dl>
          </li>
        </ol>

        <div class="flex justify-end gap-2">
          <button
            data-test="batch-preview-cancel"
            type="button"
            class="rounded-md px-3 py-2 text-sm text-muted hover:bg-elevated"
            @click="emit('cancel')"
          >
            {{ t('generateNext.batchImport.cancel') }}
          </button>
          <button
            data-test="batch-preview-confirm"
            type="button"
            class="rounded-md bg-primary px-3 py-2 text-sm text-inverted disabled:opacity-50"
            :disabled="!preview.canConfirm"
            @click="emit('confirm')"
          >
            {{ t('generateNext.batchImport.confirm') }}
          </button>
        </div>
      </div>
    </template>
  </UModal>
</template>
