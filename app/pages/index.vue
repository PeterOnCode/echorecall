<script setup lang="ts">
// Generate area. The full batch queue / metadata / upload UI lands in US1–US3;
// this keeps the working single-shot generator from 001 inside the new shell.
const { voices, status, error, result, loadVoices, generate } = useGeneration()

onMounted(async () => {
  await loadVoices()
})

async function onSubmit(payload: { text: string; voiceId: string }) {
  try {
    await generate(payload.text, payload.voiceId)
  } catch {
    // Error message is surfaced via the `error` ref passed to the form.
  }
}
</script>

<template>
  <div>
    <GenerateForm :voices="voices" :status="status" :error="error" @submit="onSubmit" />

    <section v-if="result" class="mt-6">
      <AudioPlayer :src="result.audioUrl" />
    </section>
  </div>
</template>
