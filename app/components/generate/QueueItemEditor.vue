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

// USelectMenu items: voices carry their own {id,label}; formats display the
// uppercased extension but bind the format id (matching the prior <option> mapping).
// MODELS is readonly, so a mutable copy is needed for USelectMenu's `items` type.
const modelItems = [...MODELS]
const formatItems = FORMATS.map((f) => ({ id: f.id, label: f.ext.toUpperCase() }))
</script>

<template>
  <div class="flex flex-col gap-3 rounded border border-default bg-elevated p-3" data-test="queue-item-editor">
    <UFormField :label="t('generate.form.text')">
      <UTextarea
        v-model="draftText"
        data-test="edit-text"
        :rows="3"
        class="w-full"
        @input="textError = null"
        @blur="commitText"
      />
      <template v-if="textError" #error>
        <span data-test="edit-text-error">
          {{ textError === 'empty' ? t('generate.edit.textEmpty') : t('generate.edit.textTooLong') }}
        </span>
      </template>
    </UFormField>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <UFormField :label="t('generate.form.voice')">
        <USelectMenu
          v-model="voiceId"
          data-test="edit-voice"
          value-key="id"
          label-key="label"
          :items="voices"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('generate.form.model')">
        <USelectMenu v-model="model" data-test="edit-model" :items="modelItems" class="w-full" />
      </UFormField>
      <UFormField :label="t('generate.form.format')">
        <USelectMenu
          v-model="format"
          data-test="edit-format"
          value-key="id"
          label-key="label"
          :items="formatItems"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField :label="t('generate.edit.instructions')">
      <UTextarea
        v-model.lazy="instructions"
        data-test="edit-instructions"
        :rows="2"
        :placeholder="t('generate.edit.instructionsPlaceholder')"
        class="w-full"
      />
      <template v-if="!instructionsApplied" #help>
        <span data-test="edit-instructions-note">{{ t('generate.edit.instructionsNotApplied') }}</span>
      </template>
    </UFormField>

    <p v-if="tagsSkipped" data-test="edit-skip-warning" class="text-xs text-warning">
      {{ t('generate.edit.tagsSkipped') }}
    </p>

    <MetadataFields v-model="metadata" />
  </div>
</template>
