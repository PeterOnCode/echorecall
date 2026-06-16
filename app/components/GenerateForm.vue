<script setup lang="ts">
import { MAX_INPUT_LENGTH, type Voice } from '#core/client'

const props = defineProps<{
  voices: Voice[]
  status: 'idle' | 'submitting' | 'success' | 'error'
  error: string | null
}>()

const emit = defineEmits<{ submit: [payload: { text: string; voiceId: string }] }>()

const text = ref('')
const voiceId = ref('')

// Default to the first voice once the catalog loads.
watchEffect(() => {
  if (!voiceId.value && props.voices.length > 0) {
    voiceId.value = props.voices[0]!.id
  }
})

const remaining = computed(() => MAX_INPUT_LENGTH - text.value.length)
const tooLong = computed(() => text.value.length > MAX_INPUT_LENGTH)
const isEmpty = computed(() => text.value.trim().length === 0)
const submitting = computed(() => props.status === 'submitting')
const canSubmit = computed(
  () => !submitting.value && !isEmpty.value && !tooLong.value && voiceId.value !== '',
)

function onSubmit() {
  if (!canSubmit.value) return
  // Input is intentionally NOT cleared, so it survives an error.
  emit('submit', { text: text.value, voiceId: voiceId.value })
}
</script>

<template>
  <form class="generate-form" @submit.prevent="onSubmit">
    <label for="text">Text</label>
    <textarea
      id="text"
      v-model="text"
      rows="6"
      :maxlength="MAX_INPUT_LENGTH"
      :aria-invalid="error ? 'true' : undefined"
      aria-describedby="text-counter"
      placeholder="Enter text to convert to speech…"
    />
    <p id="text-counter" class="counter" :class="{ warn: tooLong }">
      {{ remaining }} characters remaining
    </p>

    <label for="voice">Voice</label>
    <select id="voice" v-model="voiceId">
      <option v-for="v in voices" :key="v.id" :value="v.id">{{ v.label }}</option>
    </select>

    <button type="submit" :disabled="!canSubmit" :aria-busy="submitting">
      {{ submitting ? 'Generating…' : 'Generate' }}
    </button>

    <p v-if="error" role="alert" class="error">{{ error }}</p>
  </form>
</template>

<style scoped>
.generate-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 40rem;
}
.counter.warn {
  color: #b60205;
}
.error {
  color: #b60205;
}
</style>
