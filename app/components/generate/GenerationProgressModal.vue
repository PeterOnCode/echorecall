<script setup lang="ts">
// 007 · US4 (G-CANCEL, FR-014–017): the generation progress modal. While a run is in
// flight it shows the current file and a succeeded/failed tally; UModal's overlay
// disables the rest of the page (backdrop). Requesting a close (the Stop button, Esc, or
// a backdrop click) surfaces an IN-MODAL confirm — never a native window.confirm/alert
// (a11y + browser-automation rule). Confirming emits `confirm-cancel` (the page then
// asks for a graceful stop: finish the in-flight file, break before the next); declining
// emits `decline-cancel` and keeps the run going. When the run ends the modal shows a
// succeeded / failed / not-generated summary; dismissing it emits `done`.
//
// Built on `UModal` like the app's other overlays (ConfirmDialog/BulkCleanDialog): the
// design-system overlay supplies the focus trap, Escape/backdrop dismiss, focus return,
// and dark-mode theming. `open`/`progress` are parent-controlled; the confirm visibility
// is local. Composable *types* are imported by relative path (typecheck gotcha).
import type { GenerationProgress } from '../../composables/useGeneration'

const props = defineProps<{ open: boolean; progress: GenerationProgress }>()
const emit = defineEmits<{
  'request-close': []
  'confirm-cancel': []
  'decline-cancel': []
  done: []
}>()
const { t } = useI18n()

const showConfirm = ref(false)
const isRunning = computed(() => props.progress.state === 'running')
const isCancelled = computed(() => props.progress.state === 'cancelled')
// The confirm only makes sense mid-run; once the run ends the summary replaces it.
const confirmVisible = computed(() => showConfirm.value && isRunning.value)

/** A file's display label: the uploaded filename, else its script text (previewed). */
function fileLabel(item: GenerationProgress['current']): string {
  if (!item) return ''
  return item.sourceName ?? item.text
}

/** Close-request: while running, surface the confirm; once finished, dismiss (done). */
function onRequestClose() {
  if (isRunning.value) {
    showConfirm.value = true
    emit('request-close')
  } else {
    emit('done')
  }
}

function onConfirmCancel() {
  showConfirm.value = false
  emit('confirm-cancel')
}

function onDeclineCancel() {
  showConfirm.value = false
  emit('decline-cancel')
}

// UModal emits update:open(false) on Esc/backdrop. `open` is parent-controlled, so the
// modal stays open; we route that dismiss through the same confirm-or-done path.
function onOpenChange(value: boolean) {
  if (!value) onRequestClose()
}

// Leaving the running state (cancel confirmed, or the run finished) clears any pending
// confirm so the summary renders cleanly.
watch(isRunning, (running) => {
  if (!running) showConfirm.value = false
})
</script>

<template>
  <UModal
    :open="open"
    :title="t('generateNext.progress.title')"
    :dismissible="true"
    @update:open="onOpenChange"
  >
    <template #content>
      <div
        data-test="progress-modal"
        class="flex flex-col gap-4 p-4 sm:p-6"
        role="status"
        aria-live="polite"
      >
        <h3 class="text-base font-semibold text-highlighted">
          {{ t('generateNext.progress.title') }}
        </h3>

        <!-- Running: current file + live tally -->
        <template v-if="isRunning">
          <p data-test="progress-current" class="text-sm text-muted">
            {{
              t('generateNext.progress.current', {
                index: progress.index + 1,
                total: progress.total,
                name: fileLabel(progress.current),
              })
            }}
          </p>
          <div class="flex gap-4 text-sm">
            <span data-test="progress-succeeded">
              {{ t('generateNext.progress.succeeded', { count: progress.succeeded.length }) }}
            </span>
            <span data-test="progress-failed">
              {{ t('generateNext.progress.failed', { count: progress.failed.length }) }}
            </span>
          </div>

          <!-- In-modal cancel confirm (no native dialog) -->
          <div
            v-if="confirmVisible"
            data-test="progress-cancel-confirm"
            class="flex flex-col gap-2 rounded-md border border-default p-3"
          >
            <p class="text-sm">{{ t('generateNext.progress.confirm.message') }}</p>
            <div class="flex justify-end gap-2">
              <UButton
                data-test="progress-cancel-confirm-no"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="onDeclineCancel"
              >
                {{ t('generateNext.progress.confirm.decline') }}
              </UButton>
              <UButton
                data-test="progress-cancel-confirm-yes"
                color="error"
                size="sm"
                @click="onConfirmCancel"
              >
                {{ t('generateNext.progress.confirm.accept') }}
              </UButton>
            </div>
          </div>

          <div class="flex justify-end">
            <UButton
              data-test="progress-close"
              color="neutral"
              variant="outline"
              size="sm"
              @click="onRequestClose"
            >
              {{ t('generateNext.progress.stop') }}
            </UButton>
          </div>
        </template>

        <!-- Finished: succeeded / failed / not-generated summary -->
        <template v-else>
          <div data-test="progress-summary" class="flex flex-col gap-1 text-sm">
            <p class="text-highlighted">
              {{
                t(
                  isCancelled
                    ? 'generateNext.progress.summary.cancelled'
                    : 'generateNext.progress.summary.completed',
                )
              }}
            </p>
            <span data-test="progress-succeeded">
              {{ t('generateNext.progress.succeeded', { count: progress.succeeded.length }) }}
            </span>
            <span data-test="progress-failed">
              {{ t('generateNext.progress.failed', { count: progress.failed.length }) }}
            </span>
            <span data-test="progress-not-generated">
              {{ t('generateNext.progress.notGenerated', { count: progress.notGenerated.length }) }}
            </span>
          </div>
          <div class="flex justify-end">
            <UButton data-test="progress-close" size="sm" @click="emit('done')">
              {{ t('generateNext.progress.close') }}
            </UButton>
          </div>
        </template>
      </div>
    </template>
  </UModal>
</template>
