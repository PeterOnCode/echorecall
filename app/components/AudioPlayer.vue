<script setup lang="ts">
// `label` gives the native audio element an accessible name so screen readers
// announce what the clip is (e.g. which library entry) rather than a generic
// "audio" control.
withDefaults(defineProps<{ src: string; label?: string }>(), {
  label: 'Generated speech audio',
})

// Deleting or bulk-cleaning a currently-playing item unmounts this player. Pause
// explicitly on teardown so audio stops at once, rather than relying on the
// removed element being garbage-collected (T107). Missing-file tolerance is
// handled by the consumer: the native `error` event falls through to the
// listener on <AudioPlayer> (e.g. LibraryTable's `@error="markUnavailable(id)"`).
const audio = ref<HTMLAudioElement | null>(null)
onBeforeUnmount(() => audio.value?.pause())
</script>

<template>
  <audio ref="audio" controls :src="src" :aria-label="label" />
</template>
