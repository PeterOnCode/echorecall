<script setup lang="ts">
import type { BulkCleanFilter, Metadata } from '#core/client'
import type { LibraryItem } from '../composables/useLibrary'

// Library area (005 redesign / US5): a resizable two-pane workspace — the results
// table (left) and the audio-tags panel (right) for the selected recording. The
// page owns the network via useLibrary (unchanged): it reloads whenever the query
// changes and carries out save / delete / bulk-clean. Selection and prev/next
// navigation (within the loaded page of results) live here and drive the detail
// pane; LibraryTable and AudioTagsPanel are pure presentation. The panel renders
// persistently and shows its own empty state when nothing is selected (FR-003), so
// prev/next stay available (FR-015) without bouncing back to the table. Components
// are resolved via Nuxt's auto-import.
const { items, total, loading, error, query, load, update, remove, bulkClean } = useLibrary()
const { t } = useI18n()

// The active recording shown in the detail pane; null → the panel shows its empty
// state. Driven by row clicks and the panel's prev/next.
const selectedId = ref<string | null>(null)

onMounted(load)
// Any search / filter / sort / page change replaces the query object → reload.
watch(query, load)

// Keep the selection valid: a reload (search / sort / page / delete) can drop the
// active recording from the loaded page, in which case the panel returns to empty.
watch(items, (list) => {
  if (selectedId.value && !list.some((i) => i.id === selectedId.value)) {
    selectedId.value = null
  }
})

const selectedItem = computed<LibraryItem | null>(
  () => items.value.find((i) => i.id === selectedId.value) ?? null,
)

// prev/next navigate within the current page of results (no implicit page fetch in
// this release — documented in the data model), so they disable at the bounds.
const activeIndex = computed(() => items.value.findIndex((i) => i.id === selectedId.value))
const hasPrev = computed(() => activeIndex.value > 0)
const hasNext = computed(() => activeIndex.value >= 0 && activeIndex.value < items.value.length - 1)

function selectPrev() {
  if (hasPrev.value) selectedId.value = items.value[activeIndex.value - 1]!.id
}
function selectNext() {
  if (hasNext.value) selectedId.value = items.value[activeIndex.value + 1]!.id
}

/** Base name (without the immutable extension) the editor edits. */
function baseName(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(0, dot) : filename
}

/**
 * Apply a panel save as a single atomic PATCH against the selected item: include
 * only the parts that actually changed (rename and/or retag). A no-op save does
 * nothing. On success re-run the current query — a rename/retag can change what the
 * active search/sort matches — and the items watcher drops the selection if the
 * edited row falls out of the loaded page.
 */
async function onSave(patch: { filename: string; metadata: Metadata }) {
  const item = selectedItem.value
  if (!item) return

  const metadataChanged = JSON.stringify(item.metadata ?? {}) !== JSON.stringify(patch.metadata ?? {})
  const nameChanged = patch.filename !== baseName(item.filename)
  if (!metadataChanged && !nameChanged) return

  const updatePatch: { filename?: string; metadata?: Metadata } = {}
  if (nameChanged) updatePatch.filename = patch.filename
  if (metadataChanged) updatePatch.metadata = patch.metadata

  await update(item.id, updatePatch)
  if (!error.value) await load()
}

async function onDelete(id: string) {
  // Resolve a neighbour by position so the user keeps a selection after the delete +
  // reload; the items watcher falls back to empty when no row remains.
  const index = items.value.findIndex((i) => i.id === id)
  await remove(id)
  if (!error.value) {
    const next = items.value[Math.min(index, items.value.length - 1)]
    selectedId.value = next?.id ?? null
  }
}

async function onBulkClean(filter: BulkCleanFilter) {
  await bulkClean(filter)
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold">{{ t('library.title') }}</h1>

    <p v-if="error" role="alert" class="text-error">{{ error }}</p>
    <p v-if="loading && items.length === 0" class="text-muted">{{ $t('common.loading') }}</p>

    <DashboardWorkspace storage-key="library-workspace">
      <template #list>
        <LibraryTable
          v-model:query="query"
          v-model:selected-id="selectedId"
          :items="items"
          :total="total"
          @bulk-clean="onBulkClean"
        />
      </template>
      <template #detail>
        <AudioTagsPanel
          :item="selectedItem"
          :has-prev="hasPrev"
          :has-next="hasNext"
          @prev="selectPrev"
          @next="selectNext"
          @save="onSave"
          @delete="onDelete"
        />
      </template>
      <template #footer>
        <!-- US6 / FR-016: a bottom waveform review player (zoom + loop regions) for
             the selected recording; absent until a row is chosen. -->
        <WaveformPlayer
          v-if="selectedItem"
          :src="selectedItem.audioUrl"
          :label="selectedItem.filename"
        />
      </template>
    </DashboardWorkspace>
  </section>
</template>
