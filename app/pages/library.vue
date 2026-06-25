<script setup lang="ts">
import type { Metadata } from '#core/client'
import type { LibraryItem } from '../composables/useLibrary'
import type { TagDraft } from '../composables/useTagDrafts'

// 006 · the redesigned Library surface (FR-001/FR-002) — now the canonical /library
// route (cutover complete: this replaced the 005 LibraryTable/AudioTagsPanel/
// LibrarySearchBar page). A resizable two-pane DashboardWorkspace: the file table
// (left) + the tag-editor inspector (right). The page owns the network via useLibrary
// (extended) and the selection: a row click sets the active recording; the inspector's
// Prev/Next traverse the filtered set ACROSS pages (R-NAV); a show/hide control
// collapses the inspector. It composes the filter bar (US3), waveform footer (US2),
// bulk + Configure Columns (US4), inspector editing (US5), and the status bar (US6).
const {
  items,
  total,
  loading,
  error,
  query,
  load,
  hasPrev,
  hasNext,
  gotoPrev,
  gotoNext,
  removeMany,
  bulkRetag,
  update,
} = useLibrary()
const { libraryColumns, setLibraryColumns, inspectorFields, setInspectorFields } = useViewPreferences()
const { t } = useI18n()

// US5 — staged tag edits (dirty buffer). Commit reuses useLibrary.update; the buffer
// auto-preserves per-recording edits across selection changes (Q4 / FR-019).
const drafts = useTagDrafts({ update })

// The active recording shown in the inspector; null → the inspector's empty state.
const activeId = ref<string | null>(null)
// FR-021 — show/hide the inspector pane (the control lives in the always-visible table).
const showInspector = ref(true)
// US5 — the Configure Visible Fields modal + the waveform handle the inspector's Play
// control drives (FR-022).
const fieldsOpen = ref(false)
const waveformRef = ref<{ play: () => void } | null>(null)

// US4 — multi-select + bulk ops + Configure Columns state.
const selectedIds = ref<Set<string>>(new Set())
const columnsOpen = ref(false)
const bulkOpen = ref(false)
const confirmDeleteOpen = ref(false)
const bulkResult = ref<{ succeeded: number; failed: string[] } | null>(null)
const bulkApplying = ref(false)

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

// US5 — the staged editable view the inspector binds to. Seeded on selection (the
// SAME buffer is returned for an id already in flight, so edits survive a switch);
// `null` resets the inspector to its empty state. Seeded in a watcher (not a computed)
// so seeding never mutates reactive state mid-render.
const activeDraft = ref<TagDraft | null>(null)
watch(
  [activeId, activeItem],
  ([id, item]) => {
    activeDraft.value = id && item ? drafts.draftFor(id, item) : null
  },
  { immediate: true },
)
const activeDirty = computed(() => (activeId.value ? drafts.isDirty(activeId.value) : false))

// US6 — the read-only status-bar projection (data-model §4). Save state reflects ANY
// unsaved draft (drafts may be dirty for several recordings at once); the selection,
// files-loaded count, and audio properties read from the active item + useLibrary.total.
const saveState = computed<'saved' | 'unsaved'>(() =>
  drafts.dirtyCount.value > 0 ? 'unsaved' : 'saved',
)
const dirtyCount = computed(() => drafts.dirtyCount.value)
const activeFilename = computed(() => activeItem.value?.filename ?? null)
const activeAudio = computed(() => activeItem.value?.audioProperties)

// Filter-bar select options. Derived from the loaded page (a reasonable default —
// the chosen value still narrows the WHOLE library via the server-side query).
const genreOptions = computed(() => [
  ...new Set(items.value.map((i) => i.metadata?.genre).filter((g): g is string => !!g)),
].sort())
const languageOptions = computed(() => [
  ...new Set(items.value.flatMap((i) => i.metadata?.languages ?? [])),
].sort())

// Global cross-page bounds (derived from total + page + pageSize by useLibrary).
const canPrev = computed(() => hasPrev(activeId.value))
const canNext = computed(() => hasNext(activeId.value))

async function onPrev() {
  activeId.value = await gotoPrev(activeId.value)
}
async function onNext() {
  activeId.value = await gotoNext(activeId.value)
}

// US5 — explicit Save commits the active recording's staged edits via useLibrary.update
// (FR-019); a successful commit clears the dirty buffer and the patched item reseeds the
// draft from the saved values. A committed edit can change what the active filter/sort
// matches, so reload the query afterwards — the items watcher then drops or re-resolves
// the active selection against the refreshed page (keeping total/page accurate). Play
// drives the footer waveform (FR-022).
async function onSave() {
  if (!activeId.value) return
  const wasDirty = drafts.isDirty(activeId.value)
  const { ok } = await drafts.commit(activeId.value)
  if (ok && wasDirty) await load()
}
function onPlay() {
  waveformRef.value?.play()
}

// --- US4 bulk actions + Configure Columns -------------------------------------
function onBulkDelete() {
  confirmDeleteOpen.value = true
}
async function confirmBulkDelete() {
  confirmDeleteOpen.value = false
  await removeMany([...selectedIds.value])
  selectedIds.value = new Set()
}
function onOpenBulkTagEdit() {
  bulkResult.value = null
  bulkOpen.value = true
}
async function onBulkApply(payload: { field: keyof Metadata; value: string }) {
  bulkApplying.value = true
  bulkResult.value = await bulkRetag([...selectedIds.value], payload.field, payload.value)
  bulkApplying.value = false
}
</script>

<template>
  <section class="flex flex-col gap-4" data-test="library">
    <h1 class="text-lg font-semibold">{{ t('library.title') }}</h1>

    <p v-if="error" role="alert" class="text-error">{{ error }}</p>
    <p v-if="loading && items.length === 0" class="text-muted">{{ $t('common.loading') }}</p>

    <DashboardWorkspace storage-key="library-workspace">
      <template #list>
        <div class="flex flex-col gap-4">
          <LibraryFilterBar
            v-model:query="query"
            :genres="genreOptions"
            :languages="languageOptions"
          />
          <LibraryFileTable
            v-model:query="query"
            v-model:active-id="activeId"
            v-model:selected-ids="selectedIds"
            :items="items"
            :total="total"
            :loading="loading"
            :columns="libraryColumns"
            @toggle-inspector="showInspector = !showInspector"
            @open-columns-dialog="columnsOpen = true"
            @bulk-delete="onBulkDelete"
            @open-bulk-tag-edit="onOpenBulkTagEdit"
          />
        </div>
      </template>
      <template #detail>
        <TagInspector
          v-if="showInspector"
          v-model:draft="activeDraft"
          :item="activeItem"
          :dirty="activeDirty"
          :has-prev="canPrev"
          :has-next="canNext"
          :fields="inspectorFields"
          @prev="onPrev"
          @next="onNext"
          @play="onPlay"
          @save="onSave"
          @open-fields-dialog="fieldsOpen = true"
        />
      </template>
      <template #footer>
        <!-- US2 / FR-007–010: the reused 005 waveform review player (single A–B loop
             + zoom) for the active recording; absent until a row is selected. -->
        <WaveformPlayer
          v-if="activeItem"
          ref="waveformRef"
          :src="activeItem.audioUrl"
          :label="activeItem.filename"
        />
      </template>
    </DashboardWorkspace>

    <!-- US6 / FR-023 — read-only status bar: save state, files loaded, selection,
         UTF-8 charset, and the active recording's real audio properties. -->
    <LibraryStatusBar
      :save-state="saveState"
      :dirty-count="dirtyCount"
      :files-loaded="total"
      :selection="activeFilename"
      :audio="activeAudio"
    />

    <!-- US4 — Configure Columns + bulk tag edit modals + bulk-delete confirmation. -->
    <LibraryColumnsDialog
      v-model:open="columnsOpen"
      :columns="libraryColumns"
      @apply="setLibraryColumns"
    />
    <!-- US5 — Configure Visible Fields modal (toggle + reorder the inspector fields). -->
    <InspectorFieldsDialog
      v-model:open="fieldsOpen"
      :fields="inspectorFields"
      @apply="setInspectorFields"
    />
    <BulkTagEditDialog
      :open="bulkOpen"
      :count="selectedIds.size"
      :result="bulkResult"
      :applying="bulkApplying"
      @apply="onBulkApply"
      @close="bulkOpen = false"
    />
    <ConfirmDialog
      :open="confirmDeleteOpen"
      :title="t('library.bulkActions.confirmTitle')"
      :message="t('library.bulkActions.confirmMessage', { count: selectedIds.size })"
      :confirm-label="t('library.bulkActions.delete')"
      :cancel-label="t('library.editor.cancel')"
      @confirm="confirmBulkDelete"
      @cancel="confirmDeleteOpen = false"
    />
  </section>
</template>
