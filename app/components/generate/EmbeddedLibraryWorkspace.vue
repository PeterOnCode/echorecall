<script setup lang="ts">
import type { Metadata } from '#core/client'
import type { LibraryItem } from '../../composables/useLibrary'
import type { TagDraft } from '../../composables/useTagDrafts'

// 007 · US2 (FR-008/FR-009/G-EMBED): the fully-functional 006 Library workspace embedded on
// the Generate page — filter bar, file table (multi-select + Configure Columns), Tag Editor
// inspector (+ Configure Visible Fields + show/hide), bulk delete/edit, and the status bar —
// over the SAME useLibrary data as the Library tab. Reuses the 006 leaf components (this is
// the 2nd use, below the constitution's 3-use extraction threshold, so it duplicates the
// wiring rather than abstracting a shared workspace yet). The 006 waveform player is
// deliberately OMITTED (Library-only, per the no-player clarification); the inspector's Play
// does a lightweight audio playback. Exposes reload() so the page can refresh after a
// generation run (FR-010).
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

const drafts = useTagDrafts({ update })

const activeId = ref<string | null>(null)
const showInspector = ref(true)
const fieldsOpen = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const columnsOpen = ref(false)
const bulkOpen = ref(false)
const confirmDeleteOpen = ref(false)
const bulkResult = ref<{ succeeded: number; failed: string[] } | null>(null)
const bulkApplying = ref(false)

onMounted(load)
watch(query, load)
watch(items, (list) => {
  if (activeId.value && !list.some((i) => i.id === activeId.value)) activeId.value = null
})

const activeItem = computed<LibraryItem | null>(
  () => items.value.find((i) => i.id === activeId.value) ?? null,
)

const activeDraft = ref<TagDraft | null>(null)
watch(
  [activeId, activeItem],
  ([id, item]) => {
    activeDraft.value = id && item ? drafts.draftFor(id, item) : null
  },
  { immediate: true },
)
const activeDirty = computed(() => (activeId.value ? drafts.isDirty(activeId.value) : false))

const saveState = computed<'saved' | 'unsaved'>(() => (drafts.dirtyCount.value > 0 ? 'unsaved' : 'saved'))
const dirtyCount = computed(() => drafts.dirtyCount.value)
const activeFilename = computed(() => activeItem.value?.filename ?? null)
const activeAudio = computed(() => activeItem.value?.audioProperties)

const genreOptions = computed(() =>
  [...new Set(items.value.map((i) => i.metadata?.genre).filter((g): g is string => !!g))].sort(),
)
const languageOptions = computed(() =>
  [...new Set(items.value.flatMap((i) => i.metadata?.languages ?? []))].sort(),
)

const canPrev = computed(() => hasPrev(activeId.value))
const canNext = computed(() => hasNext(activeId.value))

async function onPrev() {
  activeId.value = await gotoPrev(activeId.value)
}
async function onNext() {
  activeId.value = await gotoNext(activeId.value)
}

async function onSave() {
  if (!activeId.value) return
  const wasDirty = drafts.isDirty(activeId.value)
  const { ok } = await drafts.commit(activeId.value)
  if (ok && wasDirty) await load()
}

// No waveform player in the embed (FR-008): Play does a lightweight audio playback of the
// active recording's audioUrl (not the loop/zoom waveform, which stays on the Library tab).
let audioEl: HTMLAudioElement | null = null
function onPlay() {
  const src = activeItem.value?.audioUrl
  if (!src) return
  audioEl?.pause()
  audioEl = new Audio(src)
  audioEl.play().catch(() => {})
}

function onBulkDelete() {
  confirmDeleteOpen.value = true
}
async function confirmBulkDelete() {
  confirmDeleteOpen.value = false
  const { succeeded, failed } = await removeMany([...selectedIds.value])
  for (const id of succeeded) drafts.discard(id)
  selectedIds.value = new Set(failed)
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

// FR-010 — the page calls this after a generation run so new recordings appear here.
defineExpose({ reload: load })
</script>

<template>
  <div class="flex flex-col gap-4" data-test="embedded-library">
    <p v-if="error" role="alert" class="text-error">{{ error }}</p>
    <p v-if="loading && items.length === 0" class="text-muted">{{ $t('common.loading') }}</p>

    <DashboardWorkspace storage-key="generate-embed-workspace" :detail-collapsed="!showInspector">
      <template #list>
        <div class="flex flex-col gap-4">
          <LibraryFilterBar v-model:query="query" :genres="genreOptions" :languages="languageOptions" />
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
    </DashboardWorkspace>

    <LibraryStatusBar
      :save-state="saveState"
      :dirty-count="dirtyCount"
      :files-loaded="total"
      :selection="activeFilename"
      :audio="activeAudio"
    />

    <LibraryColumnsDialog v-model:open="columnsOpen" :columns="libraryColumns" @apply="setLibraryColumns" />
    <InspectorFieldsDialog v-model:open="fieldsOpen" :fields="inspectorFields" @apply="setInspectorFields" />
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
  </div>
</template>
