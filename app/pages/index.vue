<script setup lang="ts">
import type { Metadata } from '#core/client'
import type { ItemPatch, QueueItem, UploadSummary } from '../composables/useQueue'

// Generate workspace (005 redesign / US1+US2): a resizable two-pane dashboard —
// the queue list on the left, the selected item's metadata editor on the right —
// driven by a centralized GenerateToolbar (upload, prev/next, generate, save/open
// queue, settings). The defaults bar (voice/model/format/speed) and the interim
// text-add path build the queue (the ad-hoc text panel arrives in US4); the shared
// metadata editor still pre-fills new rows from the deployment default tags (003).
// Generate targets the checked rows if any are checked, else the whole queue, and
// removes each successfully generated row (failures stay for retry); the run's
// successes remain downloadable as one batch `.zip` afterwards (FR-022). Queues are
// saved to / opened from local files the user owns — no server storage (FR-013).
const {
  items,
  voiceId,
  model,
  format,
  speed,
  metadata,
  activeId,
  checkedIds,
  searchTerm,
  filters,
  visibleItems,
  generateTarget,
  hasPrev,
  hasNext,
  selectPrev,
  selectNext,
  serialize,
  loadDocument,
  addItem,
  addFromUpload,
  removeItem,
  removeMany,
  updateItem,
  applyMetadataToPending,
  setDefaults,
} = useQueue()
const { voices, generating, lastBatchIds, loadVoices, generateAll, downloadArchive } = useGeneration()
const { exportQueue, importQueue } = useQueueFile()
const { queueColumns } = useViewPreferences()
const { t } = useI18n()

// Whether the column-visibility chooser is open (US3 / FR-012).
const columnsOpen = ref(false)

const uploadSummary = ref<UploadSummary | null>(null)
// Whether any saved default tag was applied (003) — drives the form hint.
const defaultsApplied = ref(false)

// Refs to imperative DOM/child handles: the upload dropzone (toolbar Upload reuses
// its hidden input + size guard) and the hidden "open queue" file input.
const dropzone = ref<{ open: () => void } | null>(null)
const queueFileInput = ref<HTMLInputElement | null>(null)

// Import flow state: a parsed-but-not-yet-applied document awaiting confirmation
// (only when replacing a non-empty queue), plus the last import error message.
const pendingDoc = ref<ReturnType<typeof serialize> | null>(null)
const confirmReplace = ref(false)
const importError = ref<string | null>(null)

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

const canGenerate = computed(() => items.value.length > 0)

async function onGenerate() {
  if (!canGenerate.value || generating.value) return
  // Resolve the target once (checked-else-all) and use the same snapshot for both
  // stamping and generation: apply the form-level metadata to the batch's un-edited
  // rows (incl. rows added before it was filled) — but only the rows actually being
  // generated, so unchecked rows are never silently overwritten — then process them
  // and remove each success from the queue.
  const target = generateTarget.value
  applyMetadataToPending(target)
  await generateAll(target, speed.value, removeItem)
}

/** Download the most recent run's successful items as one `.zip` (FR-022). */
async function onDownloadBatch() {
  await downloadArchive(lastBatchIds.value)
}

// Toolbar Upload reuses the dropzone's hidden input (and its accept/size guards).
function onToolbarUpload() {
  dropzone.value?.open()
}

/** Save the current queue to a local `.echoqueue.json` file (FR-013). */
function onSaveQueue() {
  exportQueue(serialize())
}

/** Open the local file picker for a saved queue. */
function onOpenQueue() {
  queueFileInput.value?.click()
}

/** Validate a picked queue file; replace the queue (confirming first if non-empty). */
async function onQueueFileChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow re-selecting the same file
  if (!file) return

  const result = await importQueue(file)
  if (!result.ok) {
    importError.value = t(`generate.queueFile.error.${result.reason}`)
    return
  }
  importError.value = null
  if (items.value.length > 0) {
    pendingDoc.value = result.doc
    confirmReplace.value = true
  } else {
    loadDocument(result.doc)
  }
}

function onConfirmReplace() {
  if (pendingDoc.value) loadDocument(pendingDoc.value)
  pendingDoc.value = null
  confirmReplace.value = false
}

function onCancelReplace() {
  pendingDoc.value = null
  confirmReplace.value = false
}

/** Remove all checked rows (the QueueList confirms before emitting this — FR-011). */
function onDeleteSelected() {
  removeMany([...checkedIds.value])
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <GenerateToolbar
      :has-prev="hasPrev"
      :has-next="hasNext"
      :can-generate="canGenerate"
      :generating="generating"
      :checked-count="checkedIds.size"
      @upload="onToolbarUpload"
      @prev="selectPrev"
      @next="selectNext"
      @generate="onGenerate"
      @save-queue="onSaveQueue"
      @open-queue="onOpenQueue"
    />
    <!-- open-settings is emitted by the toolbar but handled in US7 (SettingsModal);
         intentionally unwired here so the toolbar is complete now. -->

    <GenerateForm
      v-model:voice-id="voiceId"
      v-model:model="model"
      v-model:format="format"
      v-model:speed="speed"
      :voices="voices"
      @add="onAdd"
    />

    <UploadDropzone ref="dropzone" :summary="uploadSummary" @uploaded="onUploaded" />

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
        <QueueList
          v-model:active-id="activeId"
          v-model:checked-ids="checkedIds"
          v-model:search="searchTerm"
          v-model:filters="filters"
          :items="visibleItems"
          :voices="voices"
          :visible-columns="queueColumns"
          @remove="removeItem"
          @open-columns="columnsOpen = true"
          @delete-selected="onDeleteSelected"
        />
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

    <div v-if="lastBatchIds.length > 0">
      <UButton
        data-test="download-all"
        color="neutral"
        variant="outline"
        icon="i-lucide-download"
        @click="onDownloadBatch"
      >
        {{ t('generate.actions.downloadAll') }}
      </UButton>
    </div>

    <p v-if="importError" data-test="queue-import-error" role="alert" class="text-sm text-error">
      {{ importError }}
    </p>

    <!-- display:none keeps the native input out of the tab order / a11y tree; the
         toolbar's labelled "open queue" button is the accessible trigger. -->
    <input
      ref="queueFileInput"
      data-test="queue-file-input"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="onQueueFileChosen"
    >

    <ConfirmDialog
      :open="confirmReplace"
      :title="t('generate.queueFile.replaceTitle')"
      :message="t('generate.queueFile.replaceMessage', { count: items.length })"
      :confirm-label="t('generate.queueFile.replaceConfirm')"
      :cancel-label="t('generate.queueFile.replaceCancel')"
      @confirm="onConfirmReplace"
      @cancel="onCancelReplace"
    />

    <QueueColumnsDialog v-model:open="columnsOpen" v-model:columns="queueColumns" />
  </div>
</template>
