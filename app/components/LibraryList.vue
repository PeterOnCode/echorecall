<script setup lang="ts">
import type { Generation } from '#core/client'

// `AudioPlayer` and `ConfirmDialog` are resolved via Nuxt's component
// auto-import (same as on the page), so no explicit imports are needed here.
type LibraryItem = Generation & { audioUrl: string }

defineProps<{ generations: LibraryItem[] }>()

// Deletion is destructive and permanent, so the list never deletes on its own:
// it asks for confirmation and, only on confirm, emits `delete` with the id for
// the page to carry out (keeping this component network-free and prop-driven).
const emit = defineEmits<{ delete: [id: string] }>()

// Which entry's player is currently open. Local UI state only: replaying a
// stored clip is pure playback of its saved MP3 (the audio route makes no
// provider call — SC-003), so it needs no server round-trip.
const playingId = ref<string | null>(null)

function replay(id: string) {
  playingId.value = id
}

// `?download=1` tells the audio route to serve the clip as an attachment so the
// browser saves <id>.mp3 instead of navigating to it (FR-014).
function downloadUrl(audioUrl: string): string {
  return `${audioUrl}?download=1`
}

// The id awaiting delete confirmation, or null when no prompt is open.
const pendingDeleteId = ref<string | null>(null)

function askDelete(id: string) {
  pendingDeleteId.value = id
}

function cancelDelete() {
  pendingDeleteId.value = null
}

function confirmDelete() {
  if (pendingDeleteId.value) emit('delete', pendingDeleteId.value)
  pendingDeleteId.value = null
}
</script>

<template>
  <section class="library">
    <h2>Library</h2>

    <p v-if="generations.length === 0" class="empty">No generations yet.</p>

    <ul v-else class="items">
      <li v-for="g in generations" :key="g.id" data-test="library-item" class="item">
        <div class="meta">
          <p class="text">{{ g.text }}</p>
          <p class="sub">{{ g.voiceId }} · {{ new Date(g.createdAt).toLocaleString() }}</p>
        </div>
        <div class="actions">
          <button type="button" data-test="replay" @click="replay(g.id)">Replay</button>
          <a :href="downloadUrl(g.audioUrl)" download data-test="download">Download</a>
          <button type="button" data-test="delete" class="danger" @click="askDelete(g.id)">
            Delete
          </button>
        </div>
        <AudioPlayer v-if="playingId === g.id" :src="g.audioUrl" />
      </li>
    </ul>

    <ConfirmDialog
      :open="pendingDeleteId !== null"
      title="Delete this generation?"
      message="This permanently removes the clip and its audio. This can't be undone."
      confirm-label="Delete"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </section>
</template>

<style scoped>
.library {
  margin-top: 2rem;
}
.empty {
  color: #555;
}
.items {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.item {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: 0.5rem 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid #eee;
}
.item .text {
  margin: 0;
  white-space: pre-wrap;
}
.item .sub {
  margin: 0.25rem 0 0;
  color: #777;
  font-size: 0.85rem;
}
.item .actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.item .actions .danger {
  color: #b60205;
}
.item audio {
  grid-column: 1 / -1;
  width: 100%;
}
</style>
