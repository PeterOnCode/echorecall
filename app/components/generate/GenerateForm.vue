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
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">{{ t('generate.form.voice') }}</span>
        <select v-model="voiceId" data-test="voice" class="rounded border px-2 py-1">
          <option v-for="v in voices" :key="v.id" :value="v.id">{{ v.label }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">{{ t('generate.form.model') }}</span>
        <select v-model="model" data-test="model" class="rounded border px-2 py-1">
          <option v-for="m in MODELS" :key="m" :value="m">{{ m }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">{{ t('generate.form.format') }}</span>
        <select v-model="format" data-test="format" class="rounded border px-2 py-1">
          <option v-for="f in FORMATS" :key="f.id" :value="f.id">{{ f.ext.toUpperCase() }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">{{ t('generate.form.speed') }}</span>
        <input
          v-model.number="speed"
          data-test="speed"
          type="number"
          min="0.25"
          max="4"
          step="0.05"
          class="rounded border px-2 py-1"
        >
      </label>
    </div>

    <label class="flex flex-col gap-1 text-sm">
      <span class="font-medium">{{ t('generate.form.text') }}</span>
      <textarea
        v-model="text"
        data-test="add-text"
        rows="3"
        :placeholder="t('generate.form.textPlaceholder')"
        class="rounded border px-2 py-1"
        @keydown.ctrl.enter="onAdd"
      />
    </label>

    <div>
      <UButton data-test="add-item" icon="i-lucide-plus" @click="onAdd">
        {{ t('generate.form.add') }}
      </UButton>
    </div>
  </div>
</template>
