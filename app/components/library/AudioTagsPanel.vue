<script setup lang="ts">
import type { Metadata } from '#core/client'
import type { LibraryItem } from '../../composables/useLibrary'

// The Library detail pane (005 redesign / US5 · FR-014/FR-015): the audio-tags
// panel for the selected recording. It embeds the existing LibraryItemEditor
// (reused, not duplicated) for the rename + retag + delete form, and adds prev/next
// navigation so the user can move through the loaded results without returning to
// the table — disabled at the bounds (the page owns the index math and selection).
// With nothing selected it shows an empty placeholder instead of the editor. Save
// and delete from the embedded editor are re-emitted to the page, which owns the
// network calls (useLibrary.update / remove).
defineProps<{ item: LibraryItem | null; hasPrev: boolean; hasNext: boolean }>()
const emit = defineEmits<{
  prev: []
  next: []
  save: [patch: { filename: string; metadata: Metadata }]
  delete: [id: string]
}>()

const { t } = useI18n()
</script>

<template>
  <section
    data-test="audio-tags-panel"
    :aria-label="t('library.tags.region')"
    class="flex flex-col gap-3"
  >
    <div class="flex items-center justify-end gap-2">
      <UButton
        data-test="tags-prev"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-chevron-left"
        :disabled="!hasPrev"
        :aria-label="t('library.tags.prev')"
        @click="emit('prev')"
      >
        {{ t('library.tags.prev') }}
      </UButton>
      <UButton
        data-test="tags-next"
        color="neutral"
        variant="outline"
        size="sm"
        trailing-icon="i-lucide-chevron-right"
        :disabled="!hasNext"
        :aria-label="t('library.tags.next')"
        @click="emit('next')"
      >
        {{ t('library.tags.next') }}
      </UButton>
    </div>

    <LibraryItemEditor
      v-if="item"
      :item="item"
      @save="(patch) => emit('save', patch)"
      @delete="(id) => emit('delete', id)"
    />
    <p v-else data-test="tags-empty" class="text-sm text-muted">
      {{ t('library.tags.empty') }}
    </p>
  </section>
</template>
