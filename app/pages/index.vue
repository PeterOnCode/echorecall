<script setup lang="ts">
const { voices, status, error, result, loadVoices, generate } = useGeneration()

onMounted(loadVoices)

async function onSubmit(payload: { text: string; voiceId: string }) {
  try {
    await generate(payload.text, payload.voiceId)
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
</style>
