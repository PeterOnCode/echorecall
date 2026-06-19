<script setup lang="ts">
// Appearance selector (FR-038): light / dark / system, default system. Backed by
// @nuxtjs/color-mode (bundled with @nuxt/ui); the module persists the preference
// and applies it app-wide with no theme flash. We only read/write `preference`.
const { t } = useI18n()
const colorMode = useColorMode()

const options = [
  { value: 'light', icon: 'i-lucide-sun' },
  { value: 'dark', icon: 'i-lucide-moon' },
  { value: 'system', icon: 'i-lucide-monitor' },
] as const
</script>

<template>
  <section aria-labelledby="appearance-heading" class="flex flex-col gap-2">
    <h2 id="appearance-heading" class="text-base font-semibold">
      {{ t('settings.appearance.title') }}
    </h2>
    <div role="group" :aria-label="t('settings.appearance.title')" class="flex flex-wrap gap-2">
      <UButton
        v-for="opt in options"
        :key="opt.value"
        :data-test="`theme-${opt.value}`"
        :icon="opt.icon"
        :color="colorMode.preference === opt.value ? 'primary' : 'neutral'"
        :variant="colorMode.preference === opt.value ? 'solid' : 'outline'"
        :aria-pressed="colorMode.preference === opt.value"
        @click="colorMode.preference = opt.value"
      >
        {{ t(`settings.appearance.${opt.value}`) }}
      </UButton>
    </div>
  </section>
</template>
