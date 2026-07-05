<script setup lang="ts">
import type { Format, Metadata, Model } from '#core/client'
import { MAX_UPLOAD_BYTES } from '#core/client'

// 007 · Parallel Generate route (FR-001). Single vertically-scrolling page — page intro →
// two-column editor (Script / Generation settings) with a full-width Metadata row below →
// generation action bar + pending-queue panel. A focused queue builder: generated
// recordings are managed on the separate Library tab (/library), so the Generate page no
// longer embeds the Library workspace (removed at the user's request). Replaces the 005
// two-pane QueueList + metadata editor. Cut over to `/` once proven (FR-002). Accent = the
// app's `indigo` primary.
// View preferences are read first so the queue can be told which metadata fields are visible
// (only visible fields are saved onto rows — Configure Visible Fields, 007).
const { genSettings, setGenSetting, resetGenSetting, metadataFields, setMetadataFields } =
  useViewPreferences()
const {
  items,
  voiceId,
  model,
  format,
  speed,
  metadata,
  checkedIds,
  generateTarget,
  queueCost,
  serialize,
  loadDocument,
  addItem,
  addFromUpload,
  removeItem,
  removeMany,
  toggleChecked,
  toggleAll,
  clear: clearQueue,
  applyMetadataToPending,
  stampRecordingDates,
  stampDerivedMetadata,
  setDefaults,
} = useQueue({
  visibleMetadataFields: () => metadataFields.value.filter((f) => f.visible).map((f) => f.id),
})
const { voices, generating, progress, loadVoices, generateAll, requestCancel, reset } =
  useGeneration()
const { exportQueue, importQueue } = useQueueFile()
const { t } = useI18n()

// Configure Visible Fields modal state (007): the applied set persists via useViewPreferences,
// which drives both the form's rendered fields and the queue's metadata projection.
const metadataFieldsOpen = ref(false)
function onApplyMetadataFields(next: typeof metadataFields.value) {
  setMetadataFields(next)
}

// 007 · US3 (G-DEFAULTS, FR-012/FR-013). Each of Voice/Model/Format resolves as
// last-selected (client, `genSettings`) → configured default (server) → built-in fallback.
// The configured half is fetched once on mount; the last-selected half persists on every
// user change (guarded by `settingsReady` so the initial resolution isn't mistaken for a
// user pick). A per-field reset forgets the last-selected value and restores the configured
// default (or the built-in fallback when none is configured). Speed is not resolved here:
// synthesis always runs at 1× (`speed` stays the queue's fixed default), so it has no
// UI control and no defaults resolution.
type ConfiguredDefaults = { voiceId?: string; model?: string; format?: string }
const configuredDefaults = ref<ConfiguredDefaults>({})
const settingsReady = ref(false)

const fallbackVoice = () => voices.value[0]?.id ?? ''

function resolveSettings() {
  const ls = genSettings.value
  const cd = configuredDefaults.value
  voiceId.value = ls.voiceId ?? cd.voiceId ?? fallbackVoice()
  model.value = (ls.model ?? cd.model ?? 'gpt-4o-mini-tts') as Model
  format.value = (ls.format ?? cd.format ?? 'mp3') as Format
}

watch(voiceId, (v) => { if (settingsReady.value) setGenSetting('voiceId', v) })
watch(model, (v) => { if (settingsReady.value) setGenSetting('model', v) })
watch(format, (v) => { if (settingsReady.value) setGenSetting('format', v) })

/** Per-field reset (FR-013): forget the last-selected value, restore the configured default. */
async function onResetSetting(field: 'voiceId' | 'model' | 'format') {
  resetGenSetting(field)
  // Suppress the change-watcher so restoring the default isn't re-saved as last-selected.
  settingsReady.value = false
  const cd = configuredDefaults.value
  if (field === 'voiceId') voiceId.value = cd.voiceId ?? fallbackVoice()
  else if (field === 'model') model.value = (cd.model ?? 'gpt-4o-mini-tts') as Model
  else format.value = (cd.format ?? 'mp3') as Format
  await nextTick()
  settingsReady.value = true
}

// Hidden inputs: `.json` saved-queue load (Load queue) and `.txt` batch (Upload .txt).
const queueFileInput = ref<HTMLInputElement | null>(null)
const txtFileInput = ref<HTMLInputElement | null>(null)
const importError = ref<string | null>(null)

onMounted(async () => {
  // Voices, default tags, and generation defaults are best-effort: a degraded/offline env
  // just falls back to built-ins rather than blanking the whole page.
  try {
    await loadVoices()
  } catch {
    // voices optional
  }
  try {
    const { defaultTags } = await $fetch<{ defaultTags: Metadata }>('/api/settings/defaults')
    if (defaultTags && Object.keys(defaultTags).length > 0) setDefaults(defaultTags)
  } catch {
    // defaults optional
  }
  try {
    const { generationDefaults } = await $fetch<{ generationDefaults: ConfiguredDefaults }>(
      '/api/settings/generation-defaults',
    )
    configuredDefaults.value = generationDefaults ?? {}
  } catch {
    // generation defaults optional
  }
  // Resolve the four controls (last-selected → configured → fallback), then arm the
  // change-watchers so subsequent user edits persist as last-selected.
  resolveSettings()
  await nextTick()
  settingsReady.value = true
})

function onAdd(text: string) {
  addItem(text)
}

/** Bulk-remove the currently checked rows from the queue (client-only, no confirm needed). */
function onDeleteSelected() {
  removeMany([...checkedIds.value])
}

// 007 · US4 (G-CANCEL, FR-014): the generation progress modal opens on Generate,
// disables the page while the run is in flight (`generating`), and — via the modal's
// in-modal confirm — allows a graceful stop. It stays open on the end summary until the
// user dismisses it (`done`), which closes it and resets the progress state.
const progressOpen = ref(false)

async function onGenerate() {
  if (items.value.length === 0 || generating.value) return
  // Resolve the target once (checked-else-all), stamp the form metadata onto its
  // un-edited rows, fill today's recording date on any row still missing one (US6 /
  // FR-020), derive the Title + Track that are not user-editable on Generate, then
  // generate and drop each success from the queue.
  const target = generateTarget.value
  applyMetadataToPending(target)
  stampRecordingDates(target)
  stampDerivedMetadata(target)
  reset()
  progressOpen.value = true
  await generateAll(target, speed.value, removeItem)
  // Generated recordings are managed on the Library tab (/library); the run's outcome is
  // shown in the progress modal's end summary.
}

/** The modal's cancel-confirm was accepted: request a graceful stop (finish in-flight). */
function onProgressConfirmCancel() {
  requestCancel()
}

/** Dismiss the end summary: close the modal and clear the progress state. */
function onProgressDone() {
  progressOpen.value = false
  reset()
}

function onSaveQueue() {
  exportQueue(serialize())
}

function onLoadQueue() {
  queueFileInput.value?.click()
}

function onUploadTxt() {
  txtFileInput.value?.click()
}

/** Validate a picked `.json` queue file and replace the queue with its rows. */
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
  loadDocument(result.doc)
}

/** Read a picked `.txt` batch and append its parsed rows to the queue (FR-007). */
async function onTxtFileChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > MAX_UPLOAD_BYTES) {
    importError.value = t('generateNext.upload.tooLarge')
    return
  }
  const content = await file.text()
  importError.value = null
  addFromUpload(content, file.name)
}
</script>

<template>
  <div data-test="generate-next" class="flex flex-col gap-6" :inert="generating">
    <!-- Page intro -->
    <section data-test="gen-page-intro" class="flex flex-col gap-1">
      <h1 class="text-xl font-semibold">{{ t('generateNext.intro.title') }}</h1>
      <p class="text-sm text-muted">{{ t('generateNext.intro.subtitle') }}</p>
    </section>

    <!-- Two-column generation editor: Script + Generation settings on the top row,
         Metadata on its own full-width row below (no resizable split — FR-003). -->
    <section data-test="gen-editor" class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div data-test="gen-col-script" class="flex flex-col gap-2">
        <ScriptEntryPanel @add="onAdd" />
      </div>
      <div data-test="gen-col-settings" class="flex flex-col gap-2">
        <GenerationSettingsPanel
          v-model:voice-id="voiceId"
          v-model:model="model"
          v-model:format="format"
          :voices="voices"
          @reset="onResetSetting"
        />
      </div>
      <div data-test="gen-col-metadata" class="flex flex-col gap-2 lg:col-span-2">
        <MetadataFields
          v-model="metadata"
          :fields="metadataFields"
          @configure="metadataFieldsOpen = true"
        />
      </div>
    </section>

    <!-- Generation action bar + pending-queue panel -->
    <section data-test="gen-action-bar-region" class="flex flex-col gap-3">
      <GenerationActionBar
        :queue-count="items.length"
        :busy="generating"
        :total-usd="queueCost.totalUsd"
        :unavailable-count="queueCost.unavailableCount"
        @save-queue="onSaveQueue"
        @load-queue="onLoadQueue"
        @upload-txt="onUploadTxt"
        @generate="onGenerate"
      />
      <QueuePanel
        :items="items"
        :cost="queueCost"
        :selected-ids="checkedIds"
        @remove="removeItem"
        @toggle="toggleChecked"
        @toggle-all="toggleAll(items)"
        @delete-selected="onDeleteSelected"
        @clear="clearQueue"
      />
      <p v-if="importError" data-test="queue-import-error" role="alert" class="text-sm text-error">
        {{ importError }}
      </p>
    </section>

    <!-- Hidden file inputs (display:none keeps them out of the tab order / a11y tree;
         the action-bar buttons are the accessible triggers). -->
    <input
      ref="queueFileInput"
      data-test="queue-file-input"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="onQueueFileChosen"
    >
    <input
      ref="txtFileInput"
      data-test="txt-file-input"
      type="file"
      accept=".txt,text/plain"
      class="hidden"
      @change="onTxtFileChosen"
    >

    <!-- Generation progress modal (US4 — teleports to body, so the inert root above
         never disables it). Opens on Generate; the modal's in-modal confirm drives a
         graceful stop; the end summary stays until dismissed. -->
    <GenerationProgressModal
      :open="progressOpen"
      :progress="progress"
      @confirm-cancel="onProgressConfirmCancel"
      @done="onProgressDone"
    />

    <!-- Configure Visible Fields modal for the metadata editor (007): toggle + reorder the
         fields; only visible fields render in the form and are saved onto queue rows. -->
    <MetadataFieldsDialog
      v-model:open="metadataFieldsOpen"
      :fields="metadataFields"
      @apply="onApplyMetadataFields"
    />
  </div>
</template>
