<script setup lang="ts">
import type { Metadata } from '#core/client'
import { MAX_UPLOAD_BYTES } from '#core/client'

// 007 · Parallel Generate route (FR-001). Single vertically-scrolling page — page intro →
// three-column editor (Script / Generation settings / Metadata) → generation action bar +
// pending-queue panel → embedded 006 Library workspace (US2, no waveform player) → status
// bar (US2). Replaces the 005 two-pane QueueList + metadata editor. Cut over to `/` and
// delete the old page/components once proven (FR-002). Accent = the app's `indigo` primary.
const {
  items,
  voiceId,
  model,
  format,
  speed,
  metadata,
  generateTarget,
  serialize,
  loadDocument,
  addItem,
  addFromUpload,
  removeItem,
  applyMetadataToPending,
  setDefaults,
} = useQueue()
const { voices, generating, loadVoices, generateAll } = useGeneration()
const { exportQueue, importQueue } = useQueueFile()
const { t } = useI18n()

// Hidden inputs: `.json` saved-queue load (Load queue) and `.txt` batch (Upload .txt).
const queueFileInput = ref<HTMLInputElement | null>(null)
const txtFileInput = ref<HTMLInputElement | null>(null)
const importError = ref<string | null>(null)

onMounted(async () => {
  // Voices and default tags are best-effort: a degraded/offline env just leaves the
  // voice select and metadata blank rather than blanking the whole page.
  try {
    await loadVoices()
    if (!voiceId.value && voices.value.length > 0) voiceId.value = voices.value[0]!.id
  } catch {
    // voices optional
  }
  try {
    const { defaultTags } = await $fetch<{ defaultTags: Metadata }>('/api/settings/defaults')
    if (defaultTags && Object.keys(defaultTags).length > 0) setDefaults(defaultTags)
  } catch {
    // defaults optional
  }
})

function onAdd(text: string) {
  addItem(text)
}

async function onGenerate() {
  if (items.value.length === 0 || generating.value) return
  // Resolve the target once (checked-else-all), stamp the form metadata onto its
  // un-edited rows, then generate and drop each success from the queue.
  const target = generateTarget.value
  applyMetadataToPending(target)
  await generateAll(target, speed.value, removeItem)
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
  <div data-test="generate-next" class="flex flex-col gap-6">
    <!-- Page intro -->
    <section data-test="gen-page-intro" class="flex flex-col gap-1">
      <h1 class="text-xl font-semibold">{{ t('generateNext.intro.title') }}</h1>
      <p class="text-sm text-muted">{{ t('generateNext.intro.subtitle') }}</p>
    </section>

    <!-- Three-column generation editor (no resizable split — FR-003) -->
    <section data-test="gen-editor" class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div data-test="gen-col-script" class="flex flex-col gap-2">
        <ScriptEntryPanel @add="onAdd" />
      </div>
      <div data-test="gen-col-settings" class="flex flex-col gap-2">
        <GenerationSettingsPanel
          v-model:voice-id="voiceId"
          v-model:model="model"
          v-model:format="format"
          v-model:speed="speed"
          :voices="voices"
        />
      </div>
      <div data-test="gen-col-metadata" class="flex flex-col gap-2">
        <MetadataFields v-model="metadata" />
      </div>
    </section>

    <!-- Generation action bar + pending-queue panel -->
    <section data-test="gen-action-bar-region" class="flex flex-col gap-3">
      <GenerationActionBar
        :queue-count="items.length"
        :busy="generating"
        @save-queue="onSaveQueue"
        @load-queue="onLoadQueue"
        @upload-txt="onUploadTxt"
        @generate="onGenerate"
      />
      <QueuePanel :items="items" @remove="removeItem" />
      <p v-if="importError" data-test="queue-import-error" role="alert" class="text-sm text-error">
        {{ importError }}
      </p>
    </section>

    <!-- Embedded Library-style workspace (US2 — reuse 006 components, no waveform player) -->
    <section data-test="gen-embed">
      <!-- US2: LibraryFilterBar + LibraryFileTable + TagInspector + LibraryStatusBar -->
    </section>

    <!-- Status bar (US2) -->
    <section data-test="gen-status-bar">
      <!-- US1/US2: generation status bar -->
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
  </div>
</template>
