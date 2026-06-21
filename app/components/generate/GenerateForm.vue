<script setup lang="ts">
import { FORMATS, MODELS, type Format, type Model, type Voice } from '#core/client'

// Form-level controls shared by every queued row (FR-014: speed is a single
// form-level value), plus the text box + Add to append a row. Per-row editing
// lands in US3.
defineProps<{ voices: Voice[] }>()
const voiceId = defineModel<string>('voiceId', { required: true })
const model = defineModel<Model>('model', { required: true })
const format = defineModel<Format>('format', { required: true })
const speed = defineModel<number>('speed', { required: true })
const emit = defineEmits<{ add: [text: string] }>()
const { t } = useI18n()

const text = ref('')

// USelectMenu items: formats display the uppercased extension but bind the format
// id (matching the prior <option :value="f.id"> mapping). MODELS is readonly, so a
// mutable copy is needed for USelectMenu's `items` type.
const modelItems = [...MODELS]
const formatItems = FORMATS.map((f) => ({ id: f.id, label: f.ext.toUpperCase() }))

function onAdd() {
  const value = text.value.trim()
  if (!value) return
  emit('add', value)
  text.value = ''
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <UFormField :label="t('generate.form.voice')">
        <USelectMenu
          v-model="voiceId"
          data-test="voice"
          value-key="id"
          label-key="label"
          :items="voices"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('generate.form.model')">
        <USelectMenu v-model="model" data-test="model" :items="modelItems" class="w-full" />
      </UFormField>
      <UFormField :label="t('generate.form.format')">
        <USelectMenu
          v-model="format"
          data-test="format"
          value-key="id"
          label-key="label"
          :items="formatItems"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('generate.form.speed')">
        <UInputNumber
          v-model="speed"
          data-test="speed"
          :min="0.25"
          :max="4"
          :step="0.05"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField :label="t('generate.form.text')">
      <UTextarea
        v-model="text"
        data-test="add-text"
        :rows="3"
        :placeholder="t('generate.form.textPlaceholder')"
        class="w-full"
        @keydown.ctrl.enter="onAdd"
      />
    </UFormField>

    <div>
      <UButton data-test="add-item" icon="i-lucide-plus" @click="onAdd">
        {{ t('generate.form.add') }}
      </UButton>
    </div>
  </div>
</template>
