<script setup lang="ts">
import type { LibraryItem } from '../composables/useLibrary'

// 006 · US1 (FR-001/FR-005/FR-006/FR-021) — the redesigned Library surface at the
// PARALLEL route /library-next (canonical /library untouched until cutover, FR-002).
// A resizable two-pane DashboardWorkspace: the file table (left) + the tag-editor
// inspector (right). The page owns the network via useLibrary (extended) and the
// selection: a row click sets the active recording; the inspector's Prev/Next
// traverse the filtered set ACROSS pages (R-NAV); a show/hide control collapses the
// inspector. The filter bar (US3), waveform footer (US2), bulk + Configure Columns
// (US4), inspector editing (US5), and status bar (US6) layer on next.
const { items, total, loading, error, query, load, hasPrev, hasNext, gotoPrev, gotoNext } = useLibrary()
const { t } = useI18n()

// The active recording shown in the inspector; null → the inspector's empty state.
const activeId = ref<string | null>(null)
// FR-021 — show/hide the inspector pane (the control lives in the always-visible table).
const showInspector = ref(true)

onMounted(load)
// Any filter / sort / page change replaces the query object → reload. Cross-page
// Prev/Next also bump query.page and load via useLibrary; the redundant reload this
// watcher triggers on that boundary is harmless (same page, same data).
watch(query, load)

// Keep the selection valid: a reload (sort / page / filter) can drop the active
// recording from the loaded page, in which case the inspector returns to empty.
watch(items, (list) => {
  if (activeId.value && !list.some((i) => i.id === activeId.value)) {
    activeId.value = null
  }
})

const activeItem = computed<LibraryItem | null>(
  () => items.value.find((i) => i.id === activeId.value) ?? null,
)

// Global cross-page bounds (derived from total + page + pageSize by useLibrary).
const canPrev = computed(() => hasPrev(activeId.value))
const canNext = computed(() => hasNext(activeId.value))

async function onPrev() {
  activeId.value = await gotoPrev(activeId.value)
}
async function onNext() {
  activeId.value = await gotoNext(activeId.value)
}
</script>

<template>
  <section class="flex flex-col gap-4" data-test="library-next">
    <h1 class="text-lg font-semibold">{{ t('library.title') }}</h1>

    <p v-if="error" role="alert" class="text-error">{{ error }}</p>
    <p v-if="loading && items.length === 0" class="text-muted">{{ $t('common.loading') }}</p>

    <DashboardWorkspace storage-key="library-next-workspace">
      <template #list>
        <LibraryFileTable
          v-model:query="query"
          v-model:active-id="activeId"
          :items="items"
          :total="total"
          :loading="loading"
          @toggle-inspector="showInspector = !showInspector"
        />
      </template>
      <template #detail>
        <TagInspector
          v-if="showInspector"
          :item="activeItem"
          :has-prev="canPrev"
          :has-next="canNext"
          @prev="onPrev"
          @next="onNext"
        />
      </template>
    </DashboardWorkspace>
  </section>
</template>
