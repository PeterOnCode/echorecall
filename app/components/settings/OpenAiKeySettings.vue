<script setup lang="ts">
// In-app OpenAI key (US8 / FR-041–045). Write-only from the UI: we only ever show
// a masked status + source; the plaintext is never returned by the server. When
// NUXT_APP_SECRET is unset, in-app storage is disabled — the controls are disabled
// and a notice is shown (the env key, if any, is still used for generation).
const { t } = useI18n()
const { status, saving, testing, testResult, error, load, setKey, clearKey, testKey } = useSettings()

const draft = ref('')

onMounted(load)

const storageDisabled = computed(() => status.value?.secretConfigured === false)

async function onSave() {
  // Guard against the Enter key bypassing the button's disabled/loading state
  // (concurrent submits or a submit while storage is disabled).
  if (saving.value || storageDisabled.value) return
  const key = draft.value.trim()
  if (!key) return
  if (await setKey(key)) draft.value = ''
}
</script>

<template>
  <section aria-labelledby="openai-key-heading" class="flex flex-col gap-3">
    <h2 id="openai-key-heading" class="text-base font-semibold">
      {{ t('settings.openaiKey.title') }}
    </h2>
    <p class="text-sm text-muted">{{ t('settings.openaiKey.description') }}</p>

    <p
      v-if="storageDisabled"
      data-test="key-storage-disabled"
      class="rounded border border-warning/50 bg-warning/10 px-3 py-2 text-sm"
    >
      {{ t('settings.openaiKey.disabledNotice') }}
    </p>

    <p data-test="key-status" class="text-sm">
      <template v-if="status?.configured">
        {{ t('settings.openaiKey.current') }}
        <span class="font-mono">{{ status.masked }}</span>
        <span class="text-muted"> · {{ t(`settings.openaiKey.source.${status.source}`) }}</span>
      </template>
      <template v-else>{{ t('settings.openaiKey.none') }}</template>
    </p>

    <label class="flex flex-col gap-1 text-sm">
      <span class="font-medium">{{ t('settings.openaiKey.inputLabel') }}</span>
      <input
        v-model="draft"
        data-test="key-input"
        type="password"
        autocomplete="off"
        :placeholder="t('settings.openaiKey.placeholder')"
        :disabled="storageDisabled || saving"
        class="rounded border px-2 py-1"
        @keydown.enter="onSave"
      >
    </label>

    <div class="flex flex-wrap gap-2">
      <UButton
        data-test="key-save"
        icon="i-lucide-key-round"
        :loading="saving"
        :disabled="storageDisabled || !draft.trim()"
        @click="onSave"
      >
        {{ t('settings.openaiKey.save') }}
      </UButton>
      <UButton
        data-test="key-clear"
        variant="outline"
        :loading="saving"
        :disabled="storageDisabled || status?.source !== 'ui'"
        @click="clearKey"
      >
        {{ t('settings.openaiKey.clear') }}
      </UButton>
      <UButton
        data-test="key-test"
        variant="outline"
        icon="i-lucide-plug"
        :loading="testing"
        :disabled="!status?.configured"
        @click="testKey"
      >
        {{ t('settings.openaiKey.test') }}
      </UButton>
    </div>

    <p v-if="testResult === true" data-test="key-test-ok" class="text-sm text-success">
      {{ t('settings.openaiKey.testOk') }}
    </p>
    <p v-else-if="testResult === false" data-test="key-test-fail" class="text-sm text-error">
      {{ t('settings.openaiKey.testFail') }}
    </p>
    <p v-if="error" data-test="key-error" class="text-sm text-error">{{ error }}</p>
  </section>
</template>
