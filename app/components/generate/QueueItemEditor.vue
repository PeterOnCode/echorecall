<script setup lang="ts">
import {
  FORMATS,
  INSTRUCTIONS_MODEL,
  MODELS,
  type Format,
  type Metadata,
  type Model,
  type Voice,
} from '#core/client'
import {
  isUntaggableFormat,
  validateItemText,
  type ItemPatch,
  type QueueItem,
  type TextRejection,
} from '../../composables/useQueue'

// Per-row editor (US3): edit one queue item's text/voice/model/format/instructions/
// metadata. Controlled — every change emits a minimal `update` patch that the
// owner applies via useQueue().updateItem (the single source of truth), so edits
// reflect immediately and touch only this row. Text is validated here so an
// empty/over-cap edit shows a message and keeps the previous value without
// emitting; instructions are retained (with a note) when the chosen model can't
// apply them; an untaggable format (AAC/PCM) is flagged without discarding the
// entered metadata.
const props = defineProps<{ item: QueueItem; voices: Voice[] }>()
const emit = defineEmits<{ update: [patch: ItemPatch] }>()
const { t } = useI18n()

const voiceId = computed<string>({
  get: () => props.item.voiceId,
  set: (value) => emit('update', { voiceId: value }),
})
const model = computed<Model>({
  get: () => props.item.model,
  set: (value) => emit('update', { model: value }),
})
const format = computed<Format>({
  get: () => props.item.format,
  set: (value) => emit('update', { format: value }),
})
const instructions = computed<string>({
  get: () => props.item.instructions ?? '',
  set: (value) => emit('update', { instructions: value }),
})
const metadata = computed<Metadata>({
  get: () => props.item.metadata,
  set: (value) => emit('update', { metadata: value }),
})

// Text commits on blur so an invalid edit can be refused and the previous valid
// value restored. A local draft holds the in-progress value until then.
const draftText = ref(props.item.text)
watch(
  () => props.item.text,
  (text) => {
    draftText.value = text
  },
)
const textError = ref<TextRejection | null>(null)
function commitText() {
  const result = validateItemText(draftText.value)
  if (!result.ok) {
    textError.value = result.reason
    draftText.value = props.item.text
    return
  }
  textError.value = null
  if (result.text !== props.item.text) emit('update', { text: result.text })
}

const instructionsApplied = computed(() => props.item.model === INSTRUCTIONS_MODEL)
const tagsSkipped = computed(() => isUntaggableFormat(props.item.format))
</script>

<template>
  <div class="flex flex-col gap-3 rounded border bg-elevated p-3" data-test="queue-item-editor">
    <label class="flex flex-col gap-1 text-sm">
      <span class="font-medium">{{ t('generate.form.text') }}</span>
      <textarea
        v-model="draftText"
        data-test="edit-text"
        rows="3"
        class="rounded border px-2 py-1"
        @input="textError = null"
        @blur="commitText"
      />
      <span v-if="textError" data-test="edit-text-error" class="text-xs text-error">
        {{ textError === 'empty' ? t('generate.edit.textEmpty') : t('generate.edit.textTooLong') }}
      </span>
    </label>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">{{ t('generate.form.voice') }}</span>
        <select v-model="voiceId" data-test="edit-voice" class="rounded border px-2 py-1">
          <option v-for="v in voices" :key="v.id" :value="v.id">{{ v.label }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">{{ t('generate.form.model') }}</span>
        <select v-model="model" data-test="edit-model" class="rounded border px-2 py-1">
          <option v-for="m in MODELS" :key="m" :value="m">{{ m }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">{{ t('generate.form.format') }}</span>
        <select v-model="format" data-test="edit-format" class="rounded border px-2 py-1">
          <option v-for="f in FORMATS" :key="f.id" :value="f.id">{{ f.ext.toUpperCase() }}</option>
        </select>
      </label>
    </div>

    <label class="flex flex-col gap-1 text-sm">
      <span class="font-medium">{{ t('generate.edit.instructions') }}</span>
      <textarea
        v-model.lazy="instructions"
        data-test="edit-instructions"
        rows="2"
        :placeholder="t('generate.edit.instructionsPlaceholder')"
        class="rounded border px-2 py-1"
      />
      <span v-if="!instructionsApplied" data-test="edit-instructions-note" class="text-xs text-muted">
        {{ t('generate.edit.instructionsNotApplied') }}
      </span>
    </label>

    <p v-if="tagsSkipped" data-test="edit-skip-warning" class="text-xs text-warning">
      {{ t('generate.edit.tagsSkipped') }}
    </p>

    <MetadataFields v-model="metadata" />
  </div>
</template>
