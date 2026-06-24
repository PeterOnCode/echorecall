<script setup lang="ts">
// Brand is a proper noun and is never translated (FR-040). The running version
// (FR-046) comes from the single authoritative source (package.json via
// runtimeConfig); it is omitted when unavailable and never triggers a remote
// version check.
const version = useAppVersion()
const { t } = useI18n()
const route = useRoute()

// Settings moved into a modal (005 · US7 / FR-017): the standalone tab/page is gone.
// The header hosts the one shared SettingsModal so it is reachable on every surface,
// driven by a useState-backed open flag. The Generate surface opens it from its own
// workspace toolbar (FR-004), so the header gear is the entry point only on surfaces
// that have no toolbar (e.g. Library) — keeping exactly one settings entry per surface
// (FR-017's "only entry point") without leaving toolbar-less surfaces unable to reach
// it. Route comparison mirrors the layout's tab routing (no locale prefix).
const { open: settingsOpen } = useSettingsModal()
const showSettingsGear = computed(() => route.path !== '/')
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
        v-if="showSettingsGear"
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
