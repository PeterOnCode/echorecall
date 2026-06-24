<script setup lang="ts">
// Settings in a modal (005 · US7 / FR-017, contract §9). A UModal hosting the four
// existing settings sections unchanged (appearance, language, OpenAI key, default
// tags). With the standalone Settings page/tab removed, this modal — opened from the
// header gear (any surface) or the Generate toolbar — is the sole entry point. We use
// UModal's structured slots (title + close + body) rather than #content so the panel
// keeps the built-in viewport height cap and the body's overflow-y-auto: tall content
// (all four sections) scrolls inside the modal instead of clipping off-screen. UModal
// provides the focus trap, Escape-to-close, and focus return on close (FR-020); the
// child sections are auto-imported and own their own state and network.
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
</script>

<template>
  <UModal v-model:open="open" :title="t('settings.modal.title')">
    <template #close>
      <UButton
        data-test="settings-modal-close"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        :aria-label="t('settings.modal.close')"
        @click="open = false"
      />
    </template>

    <template #body>
      <div data-test="settings-modal" class="flex flex-col gap-6">
        <AppearanceSettings />
        <LanguageSettings />
        <OpenAiKeySettings />
        <DefaultTagsSettings />
      </div>
    </template>
  </UModal>
</template>
