<script setup lang="ts">
import type { LibraryItem } from '../../composables/useLibrary'

// 006 · US1 (FR-005/FR-006/FR-032) — the tag-editor inspector (forks AudioTagsPanel).
// US1 skeleton: a FIXED "Tag Editor (ID3v2.4)" title, a Previous/Next toolbar that
// emits to the page (disabled at the global bounds — R-NAV), a read-only display of
// the active recording's field values, and an empty state when nothing is selected.
// US5 turns the fields editable (bound to useTagDrafts), adds Play Audio + Save + the
// settings gear / Configure Visible Fields dialog, and the 6 extra R-TAGS fields.
const props = defineProps<{ item: LibraryItem | null; hasPrev: boolean; hasNext: boolean }>()
const emit = defineEmits<{ prev: []; next: [] }>()

const { t } = useI18n()

// FR-032: the header is a FIXED title (the tag standard, not a localized phrase).
const INSPECTOR_TITLE = 'Tag Editor (ID3v2.4)'

/** Base name without the immutable extension (the rename target in US5). */
function baseName(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(0, dot) : filename
}

// Read-only field projection for US1 (label + value + data-test). Editing in US5.
const fields = computed(() => {
  const item = props.item
  if (!item) return []
  const m = item.metadata ?? {}
  return [
    { id: 'name', label: t('library.inspector.fields.name'), value: baseName(item.filename) },
    { id: 'title', label: t('library.inspector.fields.title'), value: m.title ?? '' },
    { id: 'artist', label: t('library.inspector.fields.artist'), value: m.artist ?? '' },
    { id: 'album', label: t('library.inspector.fields.album'), value: m.album ?? '' },
    { id: 'genre', label: t('library.inspector.fields.genre'), value: m.genre ?? '' },
    { id: 'comment', label: t('library.inspector.fields.comment'), value: m.comment ?? '' },
    { id: 'date', label: t('library.inspector.fields.date'), value: m.recordedAt ?? '' },
    { id: 'track', label: t('library.inspector.fields.track'), value: m.track ?? '' },
    { id: 'language', label: t('library.inspector.fields.language'), value: (m.languages ?? []).join(', ') },
  ]
})
</script>

<template>
  <section data-test="tag-inspector" :aria-label="INSPECTOR_TITLE" class="flex flex-col gap-3">
    <header class="flex items-center justify-between gap-2">
      <h2 data-test="inspector-title" class="text-base font-semibold">{{ INSPECTOR_TITLE }}</h2>
    </header>

    <div class="flex items-center gap-2">
      <UButton
        data-test="tags-prev"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-chevron-left"
        :disabled="!hasPrev"
        :aria-label="t('library.inspector.prev')"
        @click="emit('prev')"
      >
        {{ t('library.inspector.prev') }}
      </UButton>
      <UButton
        data-test="tags-next"
        color="neutral"
        variant="outline"
        size="sm"
        trailing-icon="i-lucide-chevron-right"
        :disabled="!hasNext"
        :aria-label="t('library.inspector.next')"
        @click="emit('next')"
      >
        {{ t('library.inspector.next') }}
      </UButton>
    </div>

    <dl v-if="item" data-test="inspector-fields" class="flex flex-col gap-2">
      <div v-for="f in fields" :key="f.id" class="flex flex-col gap-0.5">
        <dt class="text-xs text-muted">{{ f.label }}</dt>
        <dd :data-test="`field-${f.id}`" class="text-sm">{{ f.value }}</dd>
      </div>
    </dl>
    <p v-else data-test="tags-empty" class="text-sm text-muted">
      {{ t('library.inspector.empty') }}
    </p>
  </section>
</template>
