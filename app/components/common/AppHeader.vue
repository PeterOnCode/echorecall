<script setup lang="ts">
// Brand is a proper noun and is never translated (FR-040). The running version
// (FR-046) comes from the single authoritative source (package.json via
// runtimeConfig); it is omitted when unavailable and never triggers a remote
// version check.
const version = useAppVersion()
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
      <UColorModeButton />
    </template>
  </UHeader>
</template>
