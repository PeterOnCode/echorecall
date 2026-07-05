<script setup lang="ts">
// Brand is a proper noun and is never translated (FR-040). The running version
// (FR-046) comes from the single authoritative source (package.json via
// runtimeConfig); it is omitted when unavailable and never triggers a remote
// version check.
const version = useAppVersion()
const { t } = useI18n()

// Settings moved into a modal (005 · US7 / FR-017): the standalone tab/page is gone.
// The header hosts the one shared SettingsModal so it is reachable on every surface,
// driven by a useState-backed open flag. Neither Generate (007 redesign) nor Library
// has its own toolbar settings entry, so the header gear is the sole Settings entry
// point everywhere (FR-017's "only entry point").
const { open: settingsOpen } = useSettingsModal()
</script>

<template>
  <UHeader>
    <template #title>
      <span class="flex items-baseline gap-2">
        <span class="text-lg font-semibold">EchoRecall</span>
        <span
          v-if="version"
          data-test="app-version"
          class="text-xs text-muted tabular-nums"
        >v{{ version }}</span>
      </span>
    </template>

    <template #right>
      <UButton
        data-test="header-settings"
        color="neutral"
        variant="ghost"
        icon="i-lucide-settings"
        :aria-label="t('settings.modal.open')"
        :title="t('settings.modal.open')"
        @click="settingsOpen = true"
      />
      <UColorModeButton />
    </template>
  </UHeader>

  <SettingsModal v-model:open="settingsOpen" />
</template>
