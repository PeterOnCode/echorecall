<script setup lang="ts">
// Settings area. Appearance + language (US7) and the in-app OpenAI key (US8) ship
// here; default tags (US10) are added in a later story.
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-8">
    <h1 class="text-xl font-semibold">{{ t('settings.title') }}</h1>
    <AppearanceSettings />
    <LanguageSettings />
    <OpenAiKeySettings />
  </div>
</template>
