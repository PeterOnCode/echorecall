<script setup lang="ts">
import type { MetadataFieldId, MetadataFieldPref } from '../../composables/useViewPreferences'

// 007 · Configure Visible Fields modal for the Generate metadata editor (mirrors
// InspectorFieldsDialog). Shows the 10 toggleable metadata fields, lets the user toggle
// visibility AND reorder (move up/down), enforces a not-all-hidden guard, and commits only
// on Apply (Cancel discards, Reset restores the canonical all-visible order). Edits a LOCAL
// working copy seeded from the committed `fields`; the page persists the applied set via
// useViewPreferences. Only visible fields are shown in the form and saved onto queue rows.
const props = defineProps<{ open: boolean; fields: MetadataFieldPref[] }>()
const emit = defineEmits<{ 'update:open': [boolean]; apply: [MetadataFieldPref[]] }>()
const { t } = useI18n()

// Canonical inventory + order. The dialog is the UI authority for the field set. Each id is
// 1:1 with a Metadata key and reuses the existing `generate.metadata.<id>` label.
const INVENTORY: MetadataFieldId[] = [
  'title',
  'artist',
  'album',
  'genre',
  'track',
  'recordedAt',
  'comment',
  'languages',
  'customText',
  'customUrl',
]

function canonical(): MetadataFieldPref[] {
  return INVENTORY.map((id) => ({ id, visible: true }))
}

/** Seed a working copy from the committed fields; ensure all ids are present. */
function fromFields(fields: MetadataFieldPref[]): MetadataFieldPref[] {
  const known = new Set<string>(INVENTORY)
  const seen = new Set<MetadataFieldId>()
  const result: MetadataFieldPref[] = []
  for (const f of fields) {
    if (known.has(f.id) && !seen.has(f.id)) {
      seen.add(f.id)
      result.push({ id: f.id, visible: f.visible !== false })
    }
  }
  for (const id of INVENTORY) if (!seen.has(id)) result.push({ id, visible: true })
  return result
}

const working = ref<MetadataFieldPref[]>(fromFields(props.fields))
watch(
  () => props.open,
  (open) => {
    if (open) working.value = fromFields(props.fields)
  },
)

const visibleCount = computed(() => working.value.filter((f) => f.visible).length)

function toggle(id: MetadataFieldId, value: boolean) {
  const field = working.value.find((f) => f.id === id)
  if (!field) return
  if (!value && field.visible && visibleCount.value <= 1) return // not-all-hidden
  working.value = working.value.map((f) => (f.id === id ? { ...f, visible: value } : f))
}

function move(id: MetadataFieldId, dir: -1 | 1) {
  const i = working.value.findIndex((f) => f.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= working.value.length) return
  const next = [...working.value]
  const [moved] = next.splice(i, 1)
  next.splice(j, 0, moved!)
  working.value = next
}

function reset() {
  working.value = canonical()
}
function cancel() {
  emit('update:open', false)
}
function apply() {
  emit('apply', working.value.map((f) => ({ ...f })))
  emit('update:open', false)
}
</script>

<template>
  <UModal :open="open" :title="t('generate.metadataFields.title')" @update:open="(v) => emit('update:open', v)">
    <template #content>
      <div data-test="metadata-fields-dialog" class="flex flex-col gap-4 p-4 sm:p-6">
        <h3 class="text-base font-semibold text-highlighted">{{ t('generate.metadataFields.title') }}</h3>

        <ul class="flex flex-col gap-1">
          <li v-for="(field, idx) in working" :key="field.id" class="flex items-center gap-2">
            <span :data-test="`mfield-grip-${field.id}`" class="cursor-grab text-muted" aria-hidden="true">
              <UIcon name="i-lucide-grip-vertical" />
            </span>
            <UCheckbox
              :data-test="`mfield-toggle-${field.id}`"
              :model-value="field.visible"
              :disabled="field.visible && visibleCount <= 1"
              :label="t(`generate.metadata.${field.id}`)"
              class="flex-1"
              @update:model-value="(v) => toggle(field.id, v === true)"
            />
            <UButton
              :data-test="`mfield-move-up-${field.id}`"
              :disabled="idx === 0"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-chevron-up"
              :aria-label="t('generate.metadataFields.moveUp')"
              @click="move(field.id, -1)"
            />
            <UButton
              :data-test="`mfield-move-down-${field.id}`"
              :disabled="idx === working.length - 1"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-chevron-down"
              :aria-label="t('generate.metadataFields.moveDown')"
              @click="move(field.id, 1)"
            />
          </li>
        </ul>

        <div class="flex justify-between gap-2">
          <UButton data-test="metadata-fields-reset" color="neutral" variant="ghost" size="sm" @click="reset">
            {{ t('generate.metadataFields.reset') }}
          </UButton>
          <div class="flex gap-2">
            <UButton data-test="metadata-fields-cancel" color="neutral" variant="ghost" size="sm" @click="cancel">
              {{ t('generate.metadataFields.cancel') }}
            </UButton>
            <UButton data-test="metadata-fields-apply" color="primary" size="sm" @click="apply">
              {{ t('generate.metadataFields.apply') }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
