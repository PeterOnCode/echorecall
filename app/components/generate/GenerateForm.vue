<script setup lang="ts">
import { FORMATS, MODELS, type Format, type Model, type Voice } from '#core/client'

// Form-level defaults shared by every queued row (FR-014/FR-021: voice/model/format/
// speed are single form-level values that newly added rows inherit). Ad-hoc text entry
// now lives in AddTextPanel (US4); this is purely the compact defaults bar.
defineProps<{ voices: Voice[] }>()
const voiceId = defineModel<string>('voiceId', { required: true })
const model = defineModel<Model>('model', { required: true })
const format = defineModel<Format>('format', { required: true })
const speed = defineModel<number>('speed', { required: true })
const { t } = useI18n()

// USelectMenu items: formats display the uppercased extension but bind the format
// id (matching the prior <option :value="f.id"> mapping). MODELS is readonly, so a
// mutable copy is needed for USelectMenu's `items` type.
const modelItems = [...MODELS]
const formatItems = FORMATS.map((f) => ({ id: f.id, label: f.ext.toUpperCase() }))
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <UFormField :label="t('generate.form.voice')">
        <div class="flex gap-2">
          <USelectMenu
            v-model="voiceId"
            data-test="voice"
            value-key="id"
            label-key="label"
            :items="voices"
            class="min-w-0 flex-1"
          />
          <UButton
            to="https://www.openai.fm/"
            target="_blank"
            rel="noopener noreferrer"
            color="neutral"
            variant="ghost"
            icon="i-lucide-external-link"
            :aria-label="t('generate.form.voiceLink')"
          />
        </div>
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
  </div>
</template>
