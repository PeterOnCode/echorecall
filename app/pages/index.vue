<script setup lang="ts">
import type { Metadata } from '#core/client'
import type { ItemPatch, QueueItem, UploadSummary } from '../composables/useQueue'

// Generate workspace (005 redesign / US1): a resizable two-pane dashboard — the
// queue list on the left, the selected item's metadata editor on the right. The
// defaults bar (voice/model/format/speed) and the interim upload + text-add path
// build the queue (the centralized toolbar arrives in US2); the shared metadata
// editor still pre-fills new rows from the deployment default tags (003). A single
// Generate produces audio per item with isolated failures, each saved to the
// library, with a batch `.zip` download of the successful items.
const {
  items,
  voiceId,
  model,
  format,
  speed,
  metadata,
  activeId,
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

// The row shown in the detail pane; null → the pane shows its empty state (FR-003).
const activeItem = computed<QueueItem | null>(
  () => items.value.find((i) => i.clientId === activeId.value) ?? null,
)

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

function onUploaded(content: string, filename: string) {
  uploadSummary.value = addFromUpload(content, filename)
}

/** Apply a per-row edit from the detail-pane editor to the active item only. */
function onUpdate(patch: ItemPatch) {
  if (activeId.value) updateItem(activeId.value, patch)
}

// The shared (form-level) metadata editor lives in a collapsible accordion, open by
// default. It seeds new rows and is stamped onto un-edited rows at generation.
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

    <DashboardWorkspace storage-key="generate-workspace" :detail-empty="!activeItem">
      <template #list>
        <QueueList v-model:active-id="activeId" :items="items" @remove="removeItem" />
      </template>
      <template #detail>
        <QueueItemEditor
          v-if="activeItem"
          :item="activeItem"
          :voices="voices"
          @update="onUpdate"
        />
      </template>
      <template #empty>
        <p data-test="generate-detail-empty" class="text-sm text-muted">
          {{ t('generate.workspace.detailEmpty') }}
        </p>
      </template>
    </DashboardWorkspace>

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
