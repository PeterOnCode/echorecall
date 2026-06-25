<script setup lang="ts">
// 006 · FR-001: the redesigned Library surface ("waveform tag-editor"), built at
// the PARALLEL route /library-next so the canonical /library keeps working
// untouched until cutover (FR-002, T060). This is the Phase-1 stub — an empty
// two-pane workspace shell that resolves the route; US1–US6 progressively wire the
// filter bar, multi-select file table, tag-editor inspector, waveform footer, and
// status bar into the slots. Components are resolved via Nuxt auto-import.
const { t } = useI18n()
</script>

<template>
  <section class="flex flex-col gap-4" data-test="library-next">
    <h1 class="text-lg font-semibold">{{ t('library.title') }}</h1>

    <DashboardWorkspace storage-key="library-next-workspace">
      <template #list />
      <template #detail />
      <template #footer />
    </DashboardWorkspace>
  </section>
</template>
