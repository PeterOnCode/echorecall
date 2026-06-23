<script setup lang="ts">
// Centralized action toolbar for the Generate workspace (005 · US2 / FR-004/005/
// 005a, contract §2). Pure presentation built on UDashboardToolbar: every action
// is a UButton that emits a discrete event the page wires to the queue/file
// composables. Prev/next disable at the selection boundaries; generate disables
// when there is nothing to run or a run is in flight, and advertises the checked
// selection in its accessible title (FR-005a). Icon-only buttons carry an
// aria-label so the toolbar stays keyboard- and AT-operable (FR-020).
const props = defineProps<{
  hasPrev: boolean
  hasNext: boolean
  canGenerate: boolean
  generating: boolean
  checkedCount: number
}>()
const emit = defineEmits<{
  upload: []
  prev: []
  next: []
  generate: []
  'save-queue': []
  'open-queue': []
  'open-settings': []
}>()
const { t } = useI18n()

// Generate acts on the checked rows when any are checked, else the whole queue;
// surface that on the control's accessible title (FR-005a).
const generateTitle = computed(() =>
  props.checkedCount > 0
    ? t('generate.toolbar.generateSelected', { count: props.checkedCount })
    : t('generate.toolbar.generate'),
)
</script>

<template>
  <UDashboardToolbar data-test="generate-toolbar">
    <template #left>
      <UButton
        data-test="toolbar-upload"
        color="neutral"
        variant="outline"
        icon="i-lucide-upload"
        :label="t('generate.toolbar.upload')"
        :disabled="generating"
        @click="emit('upload')"
      />
      <UButton
        data-test="toolbar-prev"
        color="neutral"
        variant="ghost"
        icon="i-lucide-chevron-left"
        :aria-label="t('generate.toolbar.prev')"
        :title="t('generate.toolbar.prev')"
        :disabled="!hasPrev"
        @click="emit('prev')"
      />
      <UButton
        data-test="toolbar-next"
        color="neutral"
        variant="ghost"
        icon="i-lucide-chevron-right"
        :aria-label="t('generate.toolbar.next')"
        :title="t('generate.toolbar.next')"
        :disabled="!hasNext"
        @click="emit('next')"
      />
      <UButton
        data-test="toolbar-generate"
        icon="i-lucide-mic"
        :label="t('generate.toolbar.generate')"
        :title="generateTitle"
        :disabled="!canGenerate || generating"
        :loading="generating"
        @click="emit('generate')"
      />
    </template>

    <template #right>
      <UButton
        data-test="toolbar-save-queue"
        color="neutral"
        variant="outline"
        icon="i-lucide-save"
        :aria-label="t('generate.toolbar.saveQueue')"
        :title="t('generate.toolbar.saveQueue')"
        @click="emit('save-queue')"
      />
      <UButton
        data-test="toolbar-open-queue"
        color="neutral"
        variant="outline"
        icon="i-lucide-folder-open"
        :aria-label="t('generate.toolbar.openQueue')"
        :title="t('generate.toolbar.openQueue')"
        :disabled="generating"
        @click="emit('open-queue')"
      />
      <UButton
        data-test="toolbar-open-settings"
        color="neutral"
        variant="ghost"
        icon="i-lucide-settings"
        :aria-label="t('generate.toolbar.settings')"
        :title="t('generate.toolbar.settings')"
        @click="emit('open-settings')"
      />
    </template>
  </UDashboardToolbar>
</template>
