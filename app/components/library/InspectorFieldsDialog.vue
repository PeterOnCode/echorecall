<script setup lang="ts">
import type { InspectorFieldId, InspectorFieldPref } from '../../composables/useViewPreferences'

// 006 · US5 (FR-020/FR-031) — Configure Visible Fields modal (mirrors
// LibraryColumnsDialog). Shows the 14 toggleable inspector fields (Name is always-on
// and NOT listed), lets the user toggle visibility AND reorder (move up/down; the grip
// is a future drag affordance), enforces a not-all-hidden guard, and commits only on
// Apply (Cancel discards, Reset restores the canonical all-visible order). Edits a
// LOCAL working copy seeded from the committed `fields`; the page persists the applied
// set via useViewPreferences.
const props = defineProps<{ open: boolean; fields: InspectorFieldPref[] }>()
const emit = defineEmits<{ 'update:open': [boolean]; apply: [InspectorFieldPref[]] }>()
const { t } = useI18n()

// Canonical inventory + order. The dialog is the UI authority for the field set.
const INVENTORY: InspectorFieldId[] = [
  'text',
  'title',
  'artist',
  'album',
  'comment',
  'date',
  'track',
  'genre',
  'encodedBy',
  'language',
  'albumArtist',
  'composer',
  'bpm',
  'rating',
]

// Text/notes is keyed `notes` under library.inspector.fields; the rest map 1:1.
function labelKey(id: InspectorFieldId): string {
  return id === 'text' ? 'notes' : id
}

function canonical(): InspectorFieldPref[] {
  return INVENTORY.map((id) => ({ id, visible: true }))
}

/** Seed a working copy from the committed fields; ensure all ids are present. */
function fromFields(fields: InspectorFieldPref[]): InspectorFieldPref[] {
  const known = new Set<string>(INVENTORY)
  const seen = new Set<InspectorFieldId>()
  const result: InspectorFieldPref[] = []
  for (const f of fields) {
    if (known.has(f.id) && !seen.has(f.id)) {
      seen.add(f.id)
      result.push({ id: f.id, visible: f.visible !== false })
    }
  }
  for (const id of INVENTORY) if (!seen.has(id)) result.push({ id, visible: true })
  return result
}

const working = ref<InspectorFieldPref[]>(fromFields(props.fields))
watch(
  () => props.open,
  (open) => {
    if (open) working.value = fromFields(props.fields)
  },
)

const visibleCount = computed(() => working.value.filter((f) => f.visible).length)

function toggle(id: InspectorFieldId, value: boolean) {
  const field = working.value.find((f) => f.id === id)
  if (!field) return
  if (!value && field.visible && visibleCount.value <= 1) return // not-all-hidden
  working.value = working.value.map((f) => (f.id === id ? { ...f, visible: value } : f))
}

function move(id: InspectorFieldId, dir: -1 | 1) {
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
  <UModal :open="open" :title="t('library.inspectorFields.title')" @update:open="(v) => emit('update:open', v)">
    <template #content>
      <div data-test="inspector-fields-dialog" class="flex flex-col gap-4 p-4 sm:p-6">
        <h3 class="text-base font-semibold text-highlighted">{{ t('library.inspectorFields.title') }}</h3>

        <ul class="flex flex-col gap-1">
          <li v-for="(field, idx) in working" :key="field.id" class="flex items-center gap-2">
            <span :data-test="`field-grip-${field.id}`" class="cursor-grab text-muted" aria-hidden="true">
              <UIcon name="i-lucide-grip-vertical" />
            </span>
            <UCheckbox
              :data-test="`field-toggle-${field.id}`"
              :model-value="field.visible"
              :disabled="field.visible && visibleCount <= 1"
              :label="t(`library.inspector.fields.${labelKey(field.id)}`)"
              class="flex-1"
              @update:model-value="(v) => toggle(field.id, v === true)"
            />
            <UButton
              :data-test="`field-move-up-${field.id}`"
              :disabled="idx === 0"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-chevron-up"
              :aria-label="t('library.inspectorFields.moveUp')"
              @click="move(field.id, -1)"
            />
            <UButton
              :data-test="`field-move-down-${field.id}`"
              :disabled="idx === working.length - 1"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-chevron-down"
              :aria-label="t('library.inspectorFields.moveDown')"
              @click="move(field.id, 1)"
            />
          </li>
        </ul>

        <div class="flex justify-between gap-2">
          <UButton data-test="inspector-fields-reset" color="neutral" variant="ghost" size="sm" @click="reset">
            {{ t('library.inspectorFields.reset') }}
          </UButton>
          <div class="flex gap-2">
            <UButton data-test="inspector-fields-cancel" color="neutral" variant="ghost" size="sm" @click="cancel">
              {{ t('library.inspectorFields.cancel') }}
            </UButton>
            <UButton data-test="inspector-fields-apply" color="primary" size="sm" @click="apply">
              {{ t('library.inspectorFields.apply') }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
