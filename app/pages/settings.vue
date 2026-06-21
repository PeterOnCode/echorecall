<script setup lang="ts">
// Settings area: appearance + language (US7), the in-app OpenAI key (US8), and the
// in-app default tag values (003).
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-8">
    <h1 class="text-xl font-semibold">{{ t('settings.title') }}</h1>
    <AppearanceSettings />
    <LanguageSettings />
    <OpenAiKeySettings />
    <DefaultTagsSettings />
  </div>
</template>
