<script setup lang="ts">
// In-app default tag values (003). Edited here and saved to the server (plain JSON,
// non-secret); the generation form pre-fills new items from the same values, so a save
// takes effect on the next new generation. Title is never defaulted, so it isn't editable
// here. Values are sanitized server-side, so the inputs are plain v-model bindings.
const { t } = useI18n()
const { values, hasSaved, loading, saving, error, load, save, clear } = useDefaultTags()

onMounted(load)

async function onSave() {
  // Don't save until the current defaults have loaded: a full-replace PUT from the
  // still-blank initial form would overwrite untouched fields, dropping saved values.
  if (saving.value || loading.value) return
  await save()
}
</script>

<template>
  <section aria-labelledby="default-tags-heading" class="flex flex-col gap-3">
    <h2 id="default-tags-heading" class="text-base font-semibold">
      {{ t('settings.defaultTags.title') }}
    </h2>
    <p class="text-sm text-muted">{{ t('settings.defaultTags.description') }}</p>

    <p data-test="default-status" class="text-sm">
      <template v-if="hasSaved">{{ t('settings.defaultTags.saved') }}</template>
      <template v-else>{{ t('settings.defaultTags.none') }}</template>
    </p>

    <label class="flex flex-col gap-1 text-sm">
      <span class="font-medium">{{ t('settings.defaultTags.fields.artist') }}</span>
      <input
        v-model="values.artist"
        data-test="default-artist"
        :disabled="loading || saving"
        class="rounded border px-2 py-1"
      >
    </label>

    <label class="flex flex-col gap-1 text-sm">
      <span class="font-medium">{{ t('settings.defaultTags.fields.album') }}</span>
      <input
        v-model="values.album"
        data-test="default-album"
        :disabled="loading || saving"
        class="rounded border px-2 py-1"
      >
    </label>

    <label class="flex flex-col gap-1 text-sm">
      <span class="font-medium">{{ t('settings.defaultTags.fields.genre') }}</span>
      <input
        v-model="values.genre"
        data-test="default-genre"
        :disabled="loading || saving"
        class="rounded border px-2 py-1"
      >
    </label>

    <label class="flex flex-col gap-1 text-sm">
      <span class="font-medium">{{ t('settings.defaultTags.fields.comment') }}</span>
      <input
        v-model="values.comment"
        data-test="default-comment"
        :disabled="loading || saving"
        class="rounded border px-2 py-1"
      >
    </label>

    <label class="flex flex-col gap-1 text-sm">
      <span class="font-medium">{{ t('settings.defaultTags.fields.languages') }}</span>
      <input
        v-model="values.languages"
        data-test="default-languages"
        :placeholder="t('settings.defaultTags.languagesPlaceholder')"
        :disabled="loading || saving"
        class="rounded border px-2 py-1"
      >
      <span class="text-xs text-muted">{{ t('settings.defaultTags.languagesHint') }}</span>
    </label>

    <div class="flex flex-wrap gap-2">
      <UButton
        data-test="default-save"
        icon="i-lucide-save"
        :loading="saving"
        :disabled="loading || saving"
        @click="onSave"
      >
        {{ t('settings.defaultTags.save') }}
      </UButton>
      <UButton
        data-test="default-clear"
        variant="outline"
        :loading="saving"
        :disabled="!hasSaved"
        @click="clear"
      >
        {{ t('settings.defaultTags.clear') }}
      </UButton>
    </div>

    <p v-if="error" data-test="default-error" class="text-sm text-error">{{ error }}</p>
  </section>
</template>
