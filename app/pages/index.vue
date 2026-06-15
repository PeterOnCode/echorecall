<script setup lang="ts">
const { voices, status, error, result, loadVoices, generate } = useGeneration()
const {
  items: library,
  loading: libraryLoading,
  error: libraryError,
  load: loadLibrary,
  remove: removeLibraryItem,
} = useLibrary()

onMounted(async () => {
  await Promise.all([loadVoices(), loadLibrary()])
})

async function onSubmit(payload: { text: string; voiceId: string }) {
  try {
    await generate(payload.text, payload.voiceId)
    // A successful generation is auto-saved server-side; refresh so it appears
    // in the library immediately. On error nothing is persisted, so skip.
    await loadLibrary()
  } catch {
    // Error message is surfaced via the `error` ref passed to the form.
  }
}
</script>

<template>
  <main class="page">
    <h1>EchoRecall</h1>
    <p class="tagline">Turn text into speech.</p>

    <GenerateForm :voices="voices" :status="status" :error="error" @submit="onSubmit" />

    <section v-if="result" class="result">
      <h2>Result</h2>
      <AudioPlayer :src="result.audioUrl" />
    </section>

    <p v-if="libraryError" role="alert" class="library-error">{{ libraryError }}</p>
    <p v-else-if="libraryLoading && library.length === 0" class="library-loading">
      Loading library…
    </p>
    <LibraryList v-else :generations="library" @delete="removeLibraryItem" />
  </main>
</template>

<style scoped>
.page {
  max-width: 48rem;
  margin: 2rem auto;
  padding: 0 1rem;
  font-family: system-ui, sans-serif;
}
.tagline {
  color: #555;
}
.result {
  margin-top: 1.5rem;
}
.library-loading {
  margin-top: 2rem;
  color: #555;
}
.library-error {
  margin-top: 2rem;
  color: #b60205;
}
</style>
