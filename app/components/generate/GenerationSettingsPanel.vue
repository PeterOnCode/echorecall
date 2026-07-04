<script setup lang="ts">
import { FORMATS, MODELS, type Format, type Model, type Voice } from '#core/client'

// 007 · US1 (FR-005): the Generation settings column — Voice / Model / Format / Speed
// over the existing catalogs, controlled via v-model. Forks the 005 GenerateForm as a
// vertical editor column (no external voice-preview link). Per-field reset + defaults
// resolution (last-selected → configured default → fallback) are wired in US3.
defineProps<{ voices: Voice[] }>()
const voiceId = defineModel<string>('voiceId', { required: true })
const model = defineModel<Model>('model', { required: true })
const format = defineModel<Format>('format', { required: true })
const speed = defineModel<number>('speed', { required: true })
const { t } = useI18n()

// MODELS is readonly; USelectMenu wants a mutable items array. Formats show the
// uppercased extension but bind the format id.
const modelItems = [...MODELS]
const formatItems = FORMATS.map((f) => ({ id: f.id, label: f.ext.toUpperCase() }))
</script>

<template>
  <div data-test="generation-settings" class="flex flex-col gap-3">
    <UFormField :label="t('generateNext.settings.voice')">
      <USelectMenu
        v-model="voiceId"
        data-test="voice"
        value-key="id"
        label-key="label"
        :items="voices"
        class="w-full"
      />
    </UFormField>
    <UFormField :label="t('generateNext.settings.model')">
      <USelectMenu v-model="model" data-test="model" :items="modelItems" class="w-full" />
    </UFormField>
    <UFormField :label="t('generateNext.settings.format')">
      <USelectMenu
        v-model="format"
        data-test="format"
        value-key="id"
        label-key="label"
        :items="formatItems"
        class="w-full"
      />
    </UFormField>
    <UFormField :label="t('generateNext.settings.speed')">
      <UInputNumber v-model="speed" data-test="speed" :min="0.25" :max="4" :step="0.05" class="w-full" />
    </UFormField>
  </div>
</template>
