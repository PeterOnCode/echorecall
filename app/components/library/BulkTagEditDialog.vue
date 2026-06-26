<script setup lang="ts">
// 006 · US4 (FR-016) — Bulk tag edit modal. Pick ONE editable tag field (the standard
// scalar fields + the string R-TAGS extras; filename / multi-value / numeric fields
// excluded for clean overwrite semantics) and a value to apply across the selection.
// Emits `apply { field, value }`; the page runs useLibrary.bulkRetag and feeds the
// succeeded/failed `result` back for the summary.

/** Editable bulk fields — each is a scalar Metadata key (overwrite-safe). */
type BulkField =
  | 'title'
  | 'artist'
  | 'album'
  | 'comment'
  | 'recordedAt'
  | 'track'
  | 'genre'
  | 'albumArtist'
  | 'composer'
  | 'encodedBy'
  | 'notes'

const props = defineProps<{
  open: boolean
  count: number
  result?: { succeeded: number; failed: string[] } | null
  applying?: boolean
}>()
const emit = defineEmits<{ apply: [{ field: BulkField; value: string }]; close: [] }>()
const { t } = useI18n()

const FIELDS: BulkField[] = [
  'title',
  'artist',
  'album',
  'comment',
  'recordedAt',
  'track',
  'genre',
  'albumArtist',
  'composer',
  'encodedBy',
  'notes',
]
// recordedAt is labelled "Date"; the rest map 1:1 to an inspector field label.
const fieldItems = computed(() =>
  FIELDS.map((f) => ({ id: f, label: t(`library.inspector.fields.${f === 'recordedAt' ? 'date' : f}`) })),
)

const field = ref<BulkField>('genre')
const value = ref('')

watch(
  () => props.open,
  (open) => {
    if (open) {
      field.value = 'genre'
      value.value = ''
    }
  },
)

function apply() {
  emit('apply', { field: field.value, value: value.value })
}
</script>

<template>
  <UModal :open="open" :title="t('library.bulkTagEdit.title')" @update:open="(v) => { if (!v) emit('close') }">
    <template #content>
      <div data-test="bulk-tag-edit-dialog" class="flex flex-col gap-4 p-4 sm:p-6">
        <h3 class="text-base font-semibold text-highlighted">{{ t('library.bulkTagEdit.title') }}</h3>
        <p class="text-sm text-muted">{{ t('library.bulkTagEdit.count', { count }) }}</p>

        <UFormField :label="t('library.bulkTagEdit.field')">
          <USelectMenu
            v-model="field"
            data-test="bulk-field"
            value-key="id"
            label-key="label"
            :items="fieldItems"
          />
        </UFormField>
        <UFormField :label="t('library.bulkTagEdit.value')">
          <UInput v-model="value" data-test="bulk-value" class="w-full" />
        </UFormField>

        <p v-if="result" data-test="bulk-result" role="status" class="text-sm">
          {{ t('library.bulkTagEdit.result', { succeeded: result.succeeded, failed: result.failed.length }) }}
        </p>

        <div class="flex justify-end gap-2">
          <UButton data-test="bulk-cancel" color="neutral" variant="ghost" size="sm" @click="emit('close')">
            {{ t('library.bulkTagEdit.cancel') }}
          </UButton>
          <UButton data-test="bulk-apply" color="primary" size="sm" :loading="applying" @click="apply">
            {{ t('library.bulkTagEdit.apply') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
