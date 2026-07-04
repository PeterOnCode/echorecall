<script setup lang="ts">
// 007 · Parallel Generate route (FR-001). The redesigned Generate surface is a single
// vertically-scrolling page — page intro → three-column editor (Script / Generation
// settings / Metadata) → generation action bar → embedded 006 Library workspace (no
// waveform player) → status bar — replacing the 005 two-pane QueueList + metadata
// editor. Built here at `/generate-next` so the current `/` keeps working untouched;
// cut over and delete the old page/components once proven (FR-002).
//
// This is the Foundational layout skeleton (T003): the region containers the user
// stories fill. Composable wiring and the real controls arrive with US1+. Accent is
// the app's `indigo` primary (FR-021).
const { t } = useI18n()
</script>

<template>
  <div data-test="generate-next" class="flex flex-col gap-6">
    <!-- Page intro -->
    <section data-test="gen-page-intro" class="flex flex-col gap-1">
      <h1 class="text-xl font-semibold">{{ t('generateNext.intro.title') }}</h1>
      <p class="text-sm text-muted">{{ t('generateNext.intro.subtitle') }}</p>
    </section>

    <!-- Three-column generation editor (no resizable split — FR-003) -->
    <section data-test="gen-editor" class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div data-test="gen-col-script" class="flex flex-col gap-2">
        <!-- US1: ScriptEntryPanel -->
      </div>
      <div data-test="gen-col-settings" class="flex flex-col gap-2">
        <!-- US1/US3: GenerationSettingsPanel -->
      </div>
      <div data-test="gen-col-metadata" class="flex flex-col gap-2">
        <!-- US1: MetadataFields -->
      </div>
    </section>

    <!-- Generation action bar -->
    <section data-test="gen-action-bar-region">
      <!-- US1: GenerationActionBar + QueuePanel -->
    </section>

    <!-- Embedded Library-style workspace (reuse 006 components, no waveform player) -->
    <section data-test="gen-embed">
      <!-- US2: LibraryFilterBar + LibraryFileTable + TagInspector + LibraryStatusBar -->
    </section>

    <!-- Status bar -->
    <section data-test="gen-status-bar">
      <!-- US1/US2: generation status bar -->
    </section>
  </div>
</template>
