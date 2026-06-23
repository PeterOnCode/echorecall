<script setup lang="ts">
import type { Metadata } from '#core/client'
import type { LibraryItem } from '../../composables/useLibrary'

// Library item editor (US5 / FR-030/031): rename a saved file and edit its full
// metadata without re-synthesis, or delete it. Controlled — it emits a `save`
// patch (the new base filename + the whole metadata set) and a `delete`, leaving
// the network calls to the page (useLibrary.rename / updateMetadata / remove).
// The extension is immutable, so only the base name is editable and the
// extension is shown read-only beside it. In the 005 redesign it renders inside the
// always-visible audio-tags detail pane (AudioTagsPanel), so there is no inline
// "cancel": switching to another recording re-seeds the drafts from the new prop
// (see the `watch` below). `MetadataFields` and `ConfirmDialog` are resolved via
// Nuxt's component auto-import.
const props = defineProps<{ item: LibraryItem }>()
const emit = defineEmits<{
  save: [patch: { filename: string; metadata: Metadata }]
  delete: [id: string]
}>()
const { t } = useI18n()

/** Split a stored filename into its editable base and its fixed extension (incl. the dot). */
function splitName(filename: string): { base: string; ext: string } {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? { base: filename.slice(0, dot), ext: filename.slice(dot) } : { base: filename, ext: '' }
}

// Deep clone so editing nested tag fields (languages / customText / customUrl) in
// the draft can never mutate the prop's arrays — cancelling must leave the item
// untouched. Metadata is plain JSON, so a JSON round-trip is a safe deep copy.
function cloneMetadata(metadata: Metadata): Metadata {
  return JSON.parse(JSON.stringify(metadata ?? {})) as Metadata
}

// Local drafts so edits don't mutate the prop; re-seeded whenever the item the
// page hands us changes (e.g. after a save returns the re-slugged filename).
const filenameBase = ref(splitName(props.item.filename).base)
const metadata = ref<Metadata>(cloneMetadata(props.item.metadata))
const ext = computed(() => splitName(props.item.filename).ext)

watch(
  () => props.item,
  (item) => {
    filenameBase.value = splitName(item.filename).base
    metadata.value = cloneMetadata(item.metadata)
  },
)

function save() {
  emit('save', { filename: filenameBase.value, metadata: metadata.value })
}

// Deletion is permanent, so the editor never deletes on its own: it asks for
// confirmation and only emits `delete` once confirmed.
const confirming = ref(false)
function confirmDelete() {
  confirming.value = false
  emit('delete', props.item.id)
}
</script>

<template>
  <div class="flex flex-col gap-3 rounded border border-default bg-elevated p-3" data-test="library-item-editor">
    <UFormField :label="t('library.editor.filename')">
      <UInput v-model="filenameBase" data-test="edit-filename" class="w-full">
        <template #trailing>
          <span data-test="filename-ext" class="text-sm text-muted">{{ ext }}</span>
        </template>
      </UInput>
    </UFormField>

    <MetadataFields v-model="metadata" />

    <div class="flex flex-wrap items-center gap-2">
      <UButton data-test="save-item" color="primary" size="sm" @click="save">
        {{ t('library.editor.save') }}
      </UButton>
      <UButton
        data-test="delete-item"
        color="error"
        variant="outline"
        size="sm"
        class="ml-auto"
        @click="confirming = true"
      >
        {{ t('library.editor.delete') }}
      </UButton>
    </div>

    <ConfirmDialog
      :open="confirming"
      :title="t('library.editor.confirmTitle')"
      :message="t('library.editor.confirmMessage')"
      :confirm-label="t('library.editor.confirmLabel')"
      :cancel-label="t('library.editor.cancel')"
      @confirm="confirmDelete"
      @cancel="confirming = false"
    />
  </div>
</template>
