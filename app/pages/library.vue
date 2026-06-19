<script setup lang="ts">
import type { BulkCleanFilter, Metadata } from '#core/client'
import type { LibraryItem } from '../composables/useLibrary'

// Library area (US5 + US6): browse the persisted library with server-side
// search / sort / filter / pagination, manage each saved item (replay, download,
// rename + retag via the inline editor, delete), and bulk-clean batches by
// date/voice. The page owns the network — it reloads whenever the query changes
// and carries out save / delete / bulk-clean — while `LibraryTable` owns the
// presentation. Components are resolved via Nuxt's auto-import.
const { items, total, loading, error, query, load, update, remove, bulkClean } = useLibrary()
const { t } = useI18n()

// Which row's inline editor is open; two-way bound into the table so a successful
// save (whose result lands here) can close it.
const editingId = ref<string | null>(null)

onMounted(load)
// Any search / filter / sort / page change replaces the query object → reload.
watch(query, load)

/** Base name (without the immutable extension) the editor edits. */
function baseName(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(0, dot) : filename
}

/**
 * Apply an editor save as a single atomic PATCH: include only the parts that
 * actually changed (rename and/or retag). `useLibrary.update` clears any prior
 * error, patches the list, and sets `error` on failure; the editor stays open on
 * error so the change can be corrected. A no-op save just closes the editor.
 */
async function onSave(item: LibraryItem, patch: { filename: string; metadata: Metadata }) {
  const metadataChanged = JSON.stringify(item.metadata ?? {}) !== JSON.stringify(patch.metadata ?? {})
  const nameChanged = patch.filename !== baseName(item.filename)

  if (!metadataChanged && !nameChanged) {
    editingId.value = null
    return
  }

  const updatePatch: { filename?: string; metadata?: Metadata } = {}
  if (nameChanged) updatePatch.filename = patch.filename
  if (metadataChanged) updatePatch.metadata = patch.metadata

  await update(item.id, updatePatch)
  if (!error.value) editingId.value = null
}

async function onDelete(id: string) {
  await remove(id)
  if (editingId.value === id) editingId.value = null
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

    <LibraryTable
      v-model:query="query"
      v-model:editing-id="editingId"
      :items="items"
      :total="total"
      @save="onSave"
      @delete="onDelete"
      @bulk-clean="onBulkClean"
    />
  </section>
</template>
