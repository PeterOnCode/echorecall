<script setup lang="ts">
import type { Generation } from '#core/client'

// `AudioPlayer` is resolved via Nuxt's component auto-import (same as on the
// page), so no explicit import is needed here.
type LibraryItem = Generation & { audioUrl: string }

defineProps<{ generations: LibraryItem[] }>()

// Which entry's player is currently open. Local UI state only: replaying a
// stored clip is pure playback of its saved MP3 (the audio route makes no
// provider call — SC-003), so it needs no server round-trip.
const playingId = ref<string | null>(null)

function replay(id: string) {
  playingId.value = id
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
        <button type="button" data-test="replay" @click="replay(g.id)">Replay</button>
        <AudioPlayer v-if="playingId === g.id" :src="g.audioUrl" />
      </li>
    </ul>
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
.item audio {
  grid-column: 1 / -1;
  width: 100%;
}
</style>
