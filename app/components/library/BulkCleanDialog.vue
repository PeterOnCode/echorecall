<script setup lang="ts">
import { VOICES, type BulkCleanFilter } from '#core/client'
import { CalendarDate } from '@internationalized/date'

// Bulk-clean confirmation (US6 / FR-037): pick a date range and/or a voice, then
// confirm to permanently remove every matching saved item and its audio. The
// action is destructive, so Confirm stays disabled until at least one filter is
// set, and the parent only deletes on the emitted `confirm`. Controlled via the
// `open` prop; local filter state is re-seeded each time it opens.
//
// Built on `UModal` (004 / US3): the design-system overlay supplies the focus
// trap, Escape-to-dismiss, backdrop click, and focus return — and themes correctly
// in dark mode (fixing the old hardcoded white panel). The voice filter is a
// `USelectMenu` and the date range is a single range picker (UPopover + UCalendar).
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ confirm: [filter: BulkCleanFilter]; cancel: [] }>()
const { t, locale } = useI18n()

// Voice filter via USelectMenu. reka-ui's Combobox reserves the empty string for
// its own cleared state, so "any voice" uses a non-empty sentinel mapped back to
// `undefined` (no filter) on confirm.
const ALL = '__all__'
// Computed so the translated "any voice" label tracks runtime locale changes.
const voiceItems = computed(() => [
  { id: ALL, label: t('library.bulkClean.anyVoice') },
  ...VOICES.map((v) => ({ id: v.id, label: v.label })),
])
const voiceId = ref(ALL)

// Date range picker (FR-010/011). The single range selection maps to the same
// inclusive local-day bounds the two native date inputs produced: start -> `from`
// at local midnight, end -> `to` at local end-of-day, both as UTC instants (so
// filtering lines up with the calendar days the user sees, not UTC). The picked
// bounds are stored as the final ISO instants; `range` is a computed view that
// converts to/from the calendar's `CalendarDate` values (reka-ui's RangeCalendar
// models bounds as DateValue | undefined, not null) — mirrors LibrarySearchBar.
type DateRange = { start: CalendarDate | undefined; end: CalendarDate | undefined }
const fromIso = ref<string | undefined>(undefined)
const toIso = ref<string | undefined>(undefined)

function isoToCalendarDate(iso?: string): CalendarDate | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
}
function startIso(d: CalendarDate): string {
  return new Date(d.year, d.month - 1, d.day, 0, 0, 0, 0).toISOString()
}
function endIso(d: CalendarDate): string {
  return new Date(d.year, d.month - 1, d.day, 23, 59, 59, 999).toISOString()
}

const range = computed<DateRange | undefined>({
  get: () => {
    const start = isoToCalendarDate(fromIso.value)
    const end = isoToCalendarDate(toIso.value)
    return start || end ? { start, end } : undefined
  },
  set: (value) => {
    fromIso.value = value?.start ? startIso(value.start) : undefined
    toIso.value = value?.end ? endIso(value.end) : undefined
  },
})

function clearRange() {
  range.value = undefined
}

const rangeLabel = computed(() => {
  if (!fromIso.value && !toIso.value) return t('library.filters.anyDate')
  // Format in the active locale so the label matches the selected language.
  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(locale.value) : '…')
  return `${fmt(fromIso.value)} – ${fmt(toIso.value)}`
})

// Re-seed local filter state every time the dialog opens, so a previous, abandoned
// selection never leaks into a new bulk-clean.
watch(
  () => props.open,
  (open) => {
    if (!open) return
    voiceId.value = ALL
    fromIso.value = undefined
    toIso.value = undefined
  },
)

const hasFilter = computed(() => Boolean(voiceId.value !== ALL || fromIso.value || toIso.value))

function confirm() {
  if (!hasFilter.value) return
  emit('confirm', {
    voiceId: voiceId.value !== ALL ? voiceId.value : undefined,
    from: fromIso.value,
    to: toIso.value,
  })
}

// UModal emits `update:open(false)` only when the user dismisses it (Escape,
// backdrop click). Because `open` is parent-controlled, that is always a cancel.
function onOpenChange(value: boolean) {
  if (!value) emit('cancel')
}
</script>

<template>
  <UModal
    :open="open"
    :title="t('library.bulkClean.title')"
    :dismissible="true"
    @update:open="onOpenChange"
  >
    <template #content>
      <div data-test="bulk-clean-dialog" class="flex flex-col gap-3 p-4 sm:p-6">
        <h3 class="text-base font-semibold text-highlighted">{{ t('library.bulkClean.title') }}</h3>
        <p class="text-sm text-muted">{{ t('library.bulkClean.description') }}</p>

        <UFormField :label="t('library.bulkClean.voice')">
          <USelectMenu
            v-model="voiceId"
            data-test="bulk-voice"
            value-key="id"
            label-key="label"
            :items="voiceItems"
          />
        </UFormField>

        <UFormField :label="t('library.filters.dateRange')">
          <UPopover>
            <UButton
              data-test="bulk-range"
              color="neutral"
              variant="outline"
              icon="i-lucide-calendar"
            >
              {{ rangeLabel }}
            </UButton>
            <template #content>
              <div class="flex flex-col gap-2 p-2">
                <UCalendar v-model="range" range :number-of-months="2" />
                <div class="flex justify-end">
                  <UButton
                    data-test="bulk-range-clear"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    @click="clearRange"
                  >
                    {{ t('library.filters.clearDates') }}
                  </UButton>
                </div>
              </div>
            </template>
          </UPopover>
        </UFormField>

        <p v-if="!hasFilter" class="text-xs text-muted">{{ t('library.bulkClean.needFilter') }}</p>

        <div class="flex justify-end gap-2">
          <UButton
            data-test="bulk-cancel"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="emit('cancel')"
          >
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
    </template>
  </UModal>
</template>
