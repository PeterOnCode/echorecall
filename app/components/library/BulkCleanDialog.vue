<script setup lang="ts">
import { VOICES, type BulkCleanFilter } from '#core/client'

// Bulk-clean confirmation (US6 / FR-037): pick a date range and/or a voice, then
// confirm to permanently remove every matching saved item and its audio. The
// action is destructive, so Confirm stays disabled until at least one filter is
// set, and the parent only deletes on the emitted `confirm`. Controlled via the
// `open` prop; local filter state is re-seeded each time it opens.
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ confirm: [filter: BulkCleanFilter]; cancel: [] }>()
const { t } = useI18n()

const voiceId = ref('')
const fromDate = ref('')
const toDate = ref('')

watch(
  () => props.open,
  (open) => {
    if (open) {
      voiceId.value = ''
      fromDate.value = ''
      toDate.value = ''
    }
  },
)

const hasFilter = computed(() => Boolean(voiceId.value || fromDate.value || toDate.value))

function confirm() {
  if (!hasFilter.value) return
  // Treat the picked days as the user's local calendar days (not UTC) and convert
  // their inclusive bounds to UTC instants, matching how the search filter works.
  emit('confirm', {
    voiceId: voiceId.value || undefined,
    from: fromDate.value ? new Date(`${fromDate.value}T00:00:00`).toISOString() : undefined,
    to: toDate.value ? new Date(`${toDate.value}T23:59:59.999`).toISOString() : undefined,
  })
}
</script>

<template>
  <div v-if="open" class="backdrop" data-test="bulk-clean-dialog" @click.self="emit('cancel')">
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="bulk-clean-title">
      <h3 id="bulk-clean-title" class="text-base font-semibold">{{ t('library.bulkClean.title') }}</h3>
      <p class="text-sm text-muted">{{ t('library.bulkClean.description') }}</p>

      <div class="flex flex-col gap-3">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium">{{ t('library.bulkClean.voice') }}</span>
          <select v-model="voiceId" data-test="bulk-voice" class="rounded border px-2 py-1">
            <option value="">{{ t('library.bulkClean.anyVoice') }}</option>
            <option v-for="v in VOICES" :key="v.id" :value="v.id">{{ v.label }}</option>
          </select>
        </label>
        <div class="flex gap-3">
          <label class="flex flex-1 flex-col gap-1 text-sm">
            <span class="font-medium">{{ t('library.bulkClean.from') }}</span>
            <input
              v-model="fromDate"
              :max="toDate || undefined"
              data-test="bulk-from"
              type="date"
              class="rounded border px-2 py-1"
            >
          </label>
          <label class="flex flex-1 flex-col gap-1 text-sm">
            <span class="font-medium">{{ t('library.bulkClean.to') }}</span>
            <input
              v-model="toDate"
              :min="fromDate || undefined"
              data-test="bulk-to"
              type="date"
              class="rounded border px-2 py-1"
            >
          </label>
        </div>
      </div>

      <p v-if="!hasFilter" class="text-xs text-muted">{{ t('library.bulkClean.needFilter') }}</p>

      <div class="flex justify-end gap-2">
        <UButton data-test="bulk-cancel" color="neutral" variant="ghost" size="sm" @click="emit('cancel')">
          {{ t('library.bulkClean.cancel') }}
        </UButton>
        <UButton
          data-test="bulk-confirm"
          color="error"
          size="sm"
          :disabled="!hasFilter"
          @click="confirm"
        >
          {{ t('library.bulkClean.confirm') }}
        </UButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  z-index: 10;
}
.dialog {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: var(--ui-bg, #fff);
  border-radius: 0.5rem;
  padding: 1.25rem 1.5rem;
  max-width: 28rem;
  width: calc(100% - 2rem);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}
</style>
