<script setup lang="ts">
import type { Metadata } from '#core/client'
import type { UploadSummary } from '../composables/useQueue'

// US1 batch studio: build a generation list (typed and/or uploaded), then a
// single Generate produces audio per item with isolated failures, each saved to
// the library, with a batch `.zip` download of the successful items.
const {
  items,
  voiceId,
  model,
  format,
  speed,
  metadata,
  addItem,
  addFromUpload,
  removeItem,
  updateItem,
  applyMetadataToPending,
  setDefaults,
} = useQueue()
const { voices, generating, loadVoices, generateAll, downloadArchive } = useGeneration()
const { t } = useI18n()

const uploadSummary = ref<UploadSummary | null>(null)
// Whether any saved default tag was applied (003) — drives the form hint.
const defaultsApplied = ref(false)

onMounted(async () => {
  await loadVoices()
  if (!voiceId.value && voices.value.length > 0) voiceId.value = voices.value[0]!.id

  // Pre-fill non-title metadata from the saved default tags (003). Best effort:
  // a failed or empty fetch simply leaves the fields blank.
  try {
    const { defaultTags } = await $fetch<{ defaultTags: Metadata }>('/api/settings/defaults')
    if (defaultTags && Object.keys(defaultTags).length > 0) {
      setDefaults(defaultTags)
      defaultsApplied.value = Object.keys(defaultTags).some((key) => key !== 'title')
    }
  } catch {
    // Defaults are optional; leave the form blank on any error.
  }
})

function onAdd(text: string) {
  addItem(text)
}

function onUploaded(content: string) {
  uploadSummary.value = addFromUpload(content)
}

// The (optional) metadata editor lives in a collapsible accordion section, open by
// default so the fields are visible without an extra click.
const metadataSections = [{ label: t('generate.metadata.legend'), slot: 'metadata' as const, value: 'metadata' }]

const doneIds = computed(() =>
  items.value.filter((i) => i.status === 'done' && i.result).map((i) => i.result!.id),
)
const canGenerate = computed(() => items.value.length > 0 && !generating.value)

async function onGenerate() {
  if (!canGenerate.value) return
  // Apply the form-level metadata to the whole batch (incl. rows added before it
  // was filled) just before generating.
  applyMetadataToPending()
  await generateAll(items.value, speed.value)
}

async function onDownloadAll() {
  await downloadArchive(doneIds.value)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <GenerateForm
      v-model:voice-id="voiceId"
      v-model:model="model"
      v-model:format="format"
      v-model:speed="speed"
      :voices="voices"
      @add="onAdd"
    />

    <UploadDropzone :summary="uploadSummary" @uploaded="onUploaded" />

    <UAccordion :items="metadataSections" default-value="metadata">
      <template #metadata>
        <div class="flex flex-col gap-1">
          <p v-if="defaultsApplied" data-test="defaults-hint" class="text-xs text-muted">
            {{ t('generate.metadata.defaultsHint') }}
          </p>
          <MetadataFields v-model="metadata" />
        </div>
      </template>
    </UAccordion>

    <QueueList
      :items="items"
      :voices="voices"
      :shared-metadata="metadata"
      @remove="removeItem"
      @update="updateItem"
    />

    <div class="flex gap-3">
      <UButton
        data-test="generate-all"
        :disabled="!canGenerate"
        :loading="generating"
        icon="i-lucide-mic"
        @click="onGenerate"
      >
        {{ t('generate.actions.generate') }}
      </UButton>
      <UButton
        v-if="doneIds.length > 0"
        data-test="download-all"
        color="neutral"
        variant="outline"
        icon="i-lucide-download"
        @click="onDownloadAll"
      >
        {{ t('generate.actions.downloadAll') }}
      </UButton>
    </div>
  </div>
</template>
