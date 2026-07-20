<script setup lang="ts">
import type { BatchIssue, BatchPreview, ImportCandidate } from '#core/client'

const props = defineProps<{ open: boolean; preview: BatchPreview }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
const { t } = useI18n()
const PAGE_SIZE = 100
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(props.preview.candidates.length / PAGE_SIZE)))
const visibleCandidates = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return props.preview.candidates.slice(start, start + PAGE_SIZE)
})

watch(() => props.preview, () => { page.value = 1 })

function issueId(candidate: ImportCandidate, index: number): string {
  return `batch-issue-${candidate.location.kind}-${candidate.location.number}-${index}`
}

function issueIds(candidate: ImportCandidate): string | undefined {
  if (candidate.valid) return undefined
  return candidate.issues.map((_issue, index) => issueId(candidate, index)).join(' ')
}

function issueLabel(issue: BatchIssue): string {
  return t(`generateNext.batchImport.issue.${issue.code}`, { path: issue.path, ...issue.details })
}

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
          <p
            data-test="batch-preview-status"
            role="status"
            aria-live="polite"
            class="sr-only"
          >
            {{ t('generateNext.batchImport.ready', {
              valid: preview.counts.valid,
              rejected: preview.counts.rejected,
            }) }}
          </p>
        </div>

        <ol class="flex flex-col gap-2 overflow-y-auto">
          <li
            v-for="candidate in visibleCandidates"
            :key="`${candidate.location.kind}-${candidate.location.number}`"
            data-test="batch-preview-row"
            :data-valid="String(candidate.valid)"
            :aria-describedby="issueIds(candidate)"
            class="rounded-md border border-default p-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-medium">
                {{ t(`generateNext.batchImport.${candidate.location.kind}`, { number: candidate.location.number }) }}
              </span>
              <UBadge
                v-if="candidate.valid"
                data-test="batch-preview-valid"
                color="success"
                variant="subtle"
              >
                {{ t('generateNext.batchImport.valid') }}
              </UBadge>
              <UBadge
                v-else
                data-test="batch-preview-invalid"
                color="error"
                variant="subtle"
              >
                {{ t('generateNext.batchImport.invalid') }}
              </UBadge>
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
            <ul
              v-if="!candidate.valid"
              data-test="batch-preview-issues"
              role="alert"
              class="mt-2 list-disc space-y-1 ps-5 text-xs text-error"
            >
              <li
                v-for="(candidateIssue, issueIndex) in candidate.issues"
                :id="issueId(candidate, issueIndex)"
                :key="`${candidateIssue.code}-${candidateIssue.path}-${issueIndex}`"
                data-test="batch-preview-issue"
              >
                {{ issueLabel(candidateIssue) }}
              </li>
            </ul>
          </li>
        </ol>

        <div v-if="totalPages > 1" class="flex items-center justify-between gap-2">
          <button
            data-test="batch-preview-previous"
            type="button"
            class="rounded-md px-3 py-2 text-sm text-muted disabled:opacity-50"
            :disabled="page === 1"
            @click="page--"
          >
            {{ t('generateNext.batchImport.previous') }}
          </button>
          <span data-test="batch-preview-page" class="text-sm text-muted">
            {{ t('generateNext.batchImport.page', { page, pages: totalPages }) }}
          </span>
          <button
            data-test="batch-preview-next"
            type="button"
            class="rounded-md px-3 py-2 text-sm text-muted disabled:opacity-50"
            :disabled="page === totalPages"
            @click="page++"
          >
            {{ t('generateNext.batchImport.next') }}
          </button>
        </div>

        <p
          v-if="!preview.canConfirm"
          id="batch-preview-disabled-reason"
          data-test="batch-preview-disabled-reason"
          class="text-sm text-error"
        >
          {{ t('generateNext.batchImport.noValid') }}
        </p>

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
            :aria-describedby="preview.canConfirm ? undefined : 'batch-preview-disabled-reason'"
            @click="emit('confirm')"
          >
            {{ t('generateNext.batchImport.confirmCount', { count: preview.counts.valid }) }}
          </button>
        </div>
      </div>
    </template>
  </UModal>
</template>
