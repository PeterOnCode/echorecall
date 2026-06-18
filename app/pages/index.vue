<script setup lang="ts">
import type { UploadSummary } from '../composables/useQueue'

// US1 batch studio: build a generation list (typed and/or uploaded), then a
// single Generate produces audio per item with isolated failures, each saved to
// the library, with a batch `.zip` download of the successful items.
const { items, voiceId, model, format, speed, metadata, addItem, addFromUpload, removeItem } =
  useQueue()
const { voices, generating, loadVoices, generateAll, downloadArchive } = useGeneration()
const { t } = useI18n()

const uploadSummary = ref<UploadSummary | null>(null)

onMounted(async () => {
  await loadVoices()
  if (!voiceId.value && voices.value.length > 0) voiceId.value = voices.value[0]!.id
})

function onAdd(text: string) {
  addItem(text)
}

function onUploaded(content: string) {
  uploadSummary.value = addFromUpload(content)
}

const doneIds = computed(() =>
  items.value.filter((i) => i.status === 'done' && i.result).map((i) => i.result!.id),
)
const canGenerate = computed(() => items.value.length > 0 && !generating.value)

async function onGenerate() {
  if (!canGenerate.value) return
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

    <MetadataFields v-model="metadata" />

    <QueueList :items="items" @remove="removeItem" />

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
