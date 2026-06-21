<script setup lang="ts">
import { MAX_UPLOAD_BYTES } from '#core/client'
import type { UploadSummary } from '../../composables/useQueue'

// Accepts a `.txt` batch, guards the size (FR-004), reads it client-side, and
// hands the raw text up to the queue (which parses it via the shared
// parseUploadText). The parsed summary is rendered back here. The file is never
// uploaded to the server (FR-010).
const props = withDefaults(
  defineProps<{ summary?: UploadSummary | null; maxBytes?: number }>(),
  { summary: null, maxBytes: MAX_UPLOAD_BYTES },
)
const emit = defineEmits<{ uploaded: [content: string] }>()
const { t } = useI18n()

const error = ref<string | null>(null)
// The file input is a visually-hidden native control (FR-009 justified exception):
// @nuxt/ui's UFileUpload owns/previews the selected file, which breaks the
// read-and-discard contract (FR-002) and crashes in the test DOM. A design-system
// UButton triggers the hidden input, so the user-facing control is consistent while
// the click-to-select / size-guard / emit / reset behavior stays byte-identical.
const fileInput = ref<HTMLInputElement | null>(null)

async function onChange(event: Event) {
  error.value = null
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (file.size > props.maxBytes) {
    error.value = t('generate.upload.tooLarge')
    input.value = ''
    return
  }
  const content = await file.text()
  emit('uploaded', content)
  input.value = '' // allow re-selecting the same file
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <span class="text-sm font-medium">{{ t('generate.upload.label') }}</span>
    <input
      ref="fileInput"
      data-test="upload-input"
      type="file"
      accept=".txt,text/plain"
      class="sr-only"
      @change="onChange"
    >
    <div>
      <UButton
        data-test="upload-button"
        color="neutral"
        variant="outline"
        icon="i-lucide-upload"
        @click="fileInput?.click()"
      >
        {{ t('generate.upload.choose') }}
      </UButton>
    </div>
    <p v-if="error" data-test="upload-error" role="alert" class="text-sm text-error">{{ error }}</p>
    <p v-if="summary" data-test="upload-summary" class="text-sm text-muted">
      <span data-test="summary-added">{{ summary.added }}</span> {{ t('generate.upload.added') }} ·
      <span data-test="summary-blank">{{ summary.skippedBlank }}</span>
      {{ t('generate.upload.blank') }} ·
      <span data-test="summary-rejected">{{ summary.rejectedTooLong }}</span>
      {{ t('generate.upload.tooLong') }}
    </p>
  </div>
</template>
