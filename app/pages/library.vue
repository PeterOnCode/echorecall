<script setup lang="ts">
import type { Metadata } from '#core/client'
import type { LibraryItem } from '../composables/useLibrary'

// Library area (US5): list the persisted library and manage each saved item —
// replay, download, rename + retag via the inline editor, or delete (confirmed
// inside the editor). Search / sort / filter / bulk-clean arrive in US6.
// `LibraryItemEditor` and `AudioPlayer` are resolved via Nuxt's auto-import.
const { items, loading, error, load, update, remove } = useLibrary()
const { t } = useI18n()

// One editor open at a time; replaying is local-only playback via `audioUrl`.
const editingId = ref<string | null>(null)
const playingId = ref<string | null>(null)

onMounted(load)

/** Base name (without the immutable extension) the editor edits. */
function baseName(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(0, dot) : filename
}

function downloadUrl(audioUrl: string): string {
  return `${audioUrl}?download=1`
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
</script>

<template>
  <section class="flex flex-col gap-4">
    <h1 class="text-lg font-semibold">{{ t('library.title') }}</h1>

    <p v-if="error" role="alert" class="text-error">{{ error }}</p>
    <p v-if="loading && items.length === 0" class="text-muted">{{ $t('common.loading') }}</p>
    <p v-else-if="items.length === 0" data-test="library-empty" class="text-muted">
      {{ t('library.empty') }}
    </p>

    <ul v-else class="flex flex-col gap-3">
      <li
        v-for="g in items"
        :key="g.id"
        data-test="library-item"
        class="flex flex-col gap-2 rounded border p-3"
      >
        <div class="flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium">{{ g.filename }}</p>
            <p class="truncate text-sm text-muted">{{ g.text }}</p>
            <p class="text-xs text-muted">
              {{ g.voiceId }} · {{ new Date(g.createdAt).toLocaleString() }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <UButton
              data-test="replay"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-play"
              :aria-label="t('library.item.replay')"
              @click="playingId = playingId === g.id ? null : g.id"
            />
            <UButton
              data-test="download"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-download"
              :href="downloadUrl(g.audioUrl)"
              external
              download
              :aria-label="t('library.item.download')"
            />
            <UButton
              data-test="edit-item"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-pencil"
              :aria-expanded="editingId === g.id"
              :aria-label="t('library.item.edit')"
              @click="editingId = editingId === g.id ? null : g.id"
            />
          </div>
        </div>

        <AudioPlayer v-if="playingId === g.id" :src="g.audioUrl" :label="g.filename" />

        <LibraryItemEditor
          v-if="editingId === g.id"
          :item="g"
          @save="(patch) => onSave(g, patch)"
          @delete="onDelete"
          @cancel="editingId = null"
        />
      </li>
    </ul>
  </section>
</template>
