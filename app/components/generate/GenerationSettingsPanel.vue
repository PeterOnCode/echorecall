<script setup lang="ts">
import { FORMATS, MODELS, type Format, type Model, type Voice } from '#core/client'

// 007 · US1/US3 (FR-005/FR-013): the Generation settings column — Voice / Model / Format /
// Speed over the existing catalogs, controlled via v-model. Forks the 005 GenerateForm as a
// vertical editor column (no external voice-preview link). Each control has a per-field reset
// that asks the page to restore that field to its configured default (resolution: last-
// selected → configured default → built-in fallback is owned by the page, US3).
type GenSettingField = 'voiceId' | 'model' | 'format' | 'speed'

defineProps<{ voices: Voice[] }>()
const voiceId = defineModel<string>('voiceId', { required: true })
const model = defineModel<Model>('model', { required: true })
const format = defineModel<Format>('format', { required: true })
const speed = defineModel<number>('speed', { required: true })
const emit = defineEmits<{ reset: [field: GenSettingField] }>()
const { t } = useI18n()

// MODELS is readonly; USelectMenu wants a mutable items array. Formats show the
// uppercased extension but bind the format id.
const modelItems = [...MODELS]
const formatItems = FORMATS.map((f) => ({ id: f.id, label: f.ext.toUpperCase() }))
</script>

<template>
  <div data-test="generation-settings" class="flex flex-col gap-3">
    <div class="flex items-end gap-2">
      <UFormField :label="t('generateNext.settings.voice')" class="flex-1">
        <USelectMenu
          v-model="voiceId"
          data-test="voice"
          value-key="id"
          label-key="label"
          :items="voices"
          class="w-full"
        />
      </UFormField>
      <UButton
        data-test="gen-reset-voice"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="ghost"
        :aria-label="t('generateNext.settings.reset', { field: t('generateNext.settings.voice') })"
        @click="emit('reset', 'voiceId')"
      />
    </div>

    <div class="flex items-end gap-2">
      <UFormField :label="t('generateNext.settings.model')" class="flex-1">
        <USelectMenu v-model="model" data-test="model" :items="modelItems" class="w-full" />
      </UFormField>
      <UButton
        data-test="gen-reset-model"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="ghost"
        :aria-label="t('generateNext.settings.reset', { field: t('generateNext.settings.model') })"
        @click="emit('reset', 'model')"
      />
    </div>

    <div class="flex items-end gap-2">
      <UFormField :label="t('generateNext.settings.format')" class="flex-1">
        <USelectMenu
          v-model="format"
          data-test="format"
          value-key="id"
          label-key="label"
          :items="formatItems"
          class="w-full"
        />
      </UFormField>
      <UButton
        data-test="gen-reset-format"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="ghost"
        :aria-label="t('generateNext.settings.reset', { field: t('generateNext.settings.format') })"
        @click="emit('reset', 'format')"
      />
    </div>

    <div class="flex items-end gap-2">
      <UFormField :label="t('generateNext.settings.speed')" class="flex-1">
        <UInputNumber v-model="speed" data-test="speed" :min="0.25" :max="4" :step="0.05" class="w-full" />
      </UFormField>
      <UButton
        data-test="gen-reset-speed"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="ghost"
        :aria-label="t('generateNext.settings.reset', { field: t('generateNext.settings.speed') })"
        @click="emit('reset', 'speed')"
      />
    </div>
  </div>
</template>
