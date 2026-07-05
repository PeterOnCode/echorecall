<script setup lang="ts">
import { FORMATS, MODELS, type Voice } from '#core/client'

// 007 · US3 (G-DEFAULTS / FR-011): configurable Voice/Model/Format/Speed defaults, saved
// to the server (plain JSON, non-secret) alongside Default Tags. The Generate editor
// resolves these as the fallback when no last-selected value exists. A blank field means
// "no default"; a per-field reset clears just that field (persisted on the next Save).
const { t } = useI18n()
const { values, hasSaved, loading, saving, error, load, save, clear, resetField } =
  useGenerationDefaults()

const voices = ref<Voice[]>([])

onMounted(async () => {
  await load()
  // Voices are best-effort: a degraded env just leaves the voice list empty.
  try {
    const res = await $fetch<{ voices: Voice[] }>('/api/voices')
    voices.value = res.voices ?? []
  } catch {
    // voices optional
  }
})

// Each select prepends a "(none)" sentinel (empty id) so a default can be left unset.
const noneLabel = computed(() => t('settings.generationDefaults.none'))
const voiceItems = computed(() => [{ id: '', label: noneLabel.value }, ...voices.value])
const modelItems = computed(() => [
  { id: '', label: noneLabel.value },
  ...MODELS.map((m) => ({ id: m, label: m })),
])
const formatItems = computed(() => [
  { id: '', label: noneLabel.value },
  ...FORMATS.map((f) => ({ id: f.id, label: f.ext.toUpperCase() })),
])

async function onSave() {
  // Don't save until the current defaults have loaded: a full-replace PUT from the
  // still-blank initial form would drop untouched saved values.
  if (saving.value || loading.value) return
  await save()
}
</script>

<template>
  <section aria-labelledby="generation-defaults-heading" class="flex flex-col gap-3">
    <h2 id="generation-defaults-heading" class="text-base font-semibold">
      {{ t('settings.generationDefaults.title') }}
    </h2>
    <p class="text-sm text-muted">{{ t('settings.generationDefaults.description') }}</p>

    <p data-test="gen-default-status" class="text-sm">
      <template v-if="hasSaved">{{ t('settings.generationDefaults.saved') }}</template>
      <template v-else>{{ t('settings.generationDefaults.noneSaved') }}</template>
    </p>

    <div class="flex items-end gap-2">
      <UFormField :label="t('settings.generationDefaults.fields.voice')" class="flex-1">
        <USelectMenu
          v-model="values.voiceId"
          data-test="gen-default-voice"
          value-key="id"
          label-key="label"
          :items="voiceItems"
          :disabled="loading || saving"
          class="w-full"
        />
      </UFormField>
      <UButton
        data-test="gen-default-reset-voice"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="ghost"
        :aria-label="t('settings.generationDefaults.reset', { field: t('settings.generationDefaults.fields.voice') })"
        :disabled="loading || saving"
        @click="resetField('voiceId')"
      />
    </div>

    <div class="flex items-end gap-2">
      <UFormField :label="t('settings.generationDefaults.fields.model')" class="flex-1">
        <USelectMenu
          v-model="values.model"
          data-test="gen-default-model"
          value-key="id"
          label-key="label"
          :items="modelItems"
          :disabled="loading || saving"
          class="w-full"
        />
      </UFormField>
      <UButton
        data-test="gen-default-reset-model"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="ghost"
        :aria-label="t('settings.generationDefaults.reset', { field: t('settings.generationDefaults.fields.model') })"
        :disabled="loading || saving"
        @click="resetField('model')"
      />
    </div>

    <div class="flex items-end gap-2">
      <UFormField :label="t('settings.generationDefaults.fields.format')" class="flex-1">
        <USelectMenu
          v-model="values.format"
          data-test="gen-default-format"
          value-key="id"
          label-key="label"
          :items="formatItems"
          :disabled="loading || saving"
          class="w-full"
        />
      </UFormField>
      <UButton
        data-test="gen-default-reset-format"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="ghost"
        :aria-label="t('settings.generationDefaults.reset', { field: t('settings.generationDefaults.fields.format') })"
        :disabled="loading || saving"
        @click="resetField('format')"
      />
    </div>

    <div class="flex items-end gap-2">
      <UFormField
        :label="t('settings.generationDefaults.fields.speed')"
        :help="t('settings.generationDefaults.speedHint')"
        class="flex-1"
      >
        <UInput
          v-model="values.speed"
          data-test="gen-default-speed"
          inputmode="decimal"
          :placeholder="t('settings.generationDefaults.speedPlaceholder')"
          :disabled="loading || saving"
          class="w-full"
        />
      </UFormField>
      <UButton
        data-test="gen-default-reset-speed"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="ghost"
        :aria-label="t('settings.generationDefaults.reset', { field: t('settings.generationDefaults.fields.speed') })"
        :disabled="loading || saving"
        @click="resetField('speed')"
      />
    </div>

    <div class="flex flex-wrap gap-2">
      <UButton
        data-test="gen-default-save"
        icon="i-lucide-save"
        :loading="saving"
        :disabled="loading || saving"
        @click="onSave"
      >
        {{ t('settings.generationDefaults.save') }}
      </UButton>
      <UButton
        data-test="gen-default-clear"
        variant="outline"
        :loading="saving"
        :disabled="!hasSaved"
        @click="clear"
      >
        {{ t('settings.generationDefaults.clear') }}
      </UButton>
    </div>

    <p v-if="error" data-test="gen-default-error" class="text-sm text-error">{{ error }}</p>
  </section>
</template>
