<script setup lang="ts">
import type { LibraryColumnId, LibraryColumnPref } from '../../composables/useViewPreferences'

// 006 · US4 (FR-017/FR-031) — Configure Columns modal. Shows the full toggleable
// inventory (Filename is always-on and NOT listed), lets the user toggle visibility
// AND reorder (move up/down; the grip is a future drag affordance), enforces a
// not-all-hidden guard, and commits only on Apply (Cancel discards, Reset restores
// the canonical all-visible order). Edits a LOCAL working copy seeded from the
// committed `columns`; the page persists the applied set via useViewPreferences.
const props = defineProps<{ open: boolean; columns: LibraryColumnPref[] }>()
const emit = defineEmits<{ 'update:open': [boolean]; apply: [LibraryColumnPref[]] }>()
const { t } = useI18n()

// Canonical inventory + order. The dialog is the UI authority for the column set.
const INVENTORY: LibraryColumnId[] = [
  'title',
  'artist',
  'album',
  'year',
  'track',
  'genre',
  'comment',
  'date',
  'composer',
  'duration',
  'bitrate',
]

function canonical(): LibraryColumnPref[] {
  return INVENTORY.map((id) => ({ id, visible: true }))
}

/** Seed a working copy from the committed columns; ensure all ids are present. */
function fromColumns(cols: LibraryColumnPref[]): LibraryColumnPref[] {
  const known = new Set<string>(INVENTORY)
  const seen = new Set<LibraryColumnId>()
  const result: LibraryColumnPref[] = []
  for (const c of cols) {
    if (known.has(c.id) && !seen.has(c.id)) {
      seen.add(c.id)
      result.push({ id: c.id, visible: c.visible !== false })
    }
  }
  for (const id of INVENTORY) if (!seen.has(id)) result.push({ id, visible: true })
  return result
}

const working = ref<LibraryColumnPref[]>(fromColumns(props.columns))
watch(
  () => props.open,
  (open) => {
    if (open) working.value = fromColumns(props.columns)
  },
)

const visibleCount = computed(() => working.value.filter((c) => c.visible).length)

function toggle(id: LibraryColumnId, value: boolean) {
  const col = working.value.find((c) => c.id === id)
  if (!col) return
  if (!value && col.visible && visibleCount.value <= 1) return // not-all-hidden
  working.value = working.value.map((c) => (c.id === id ? { ...c, visible: value } : c))
}

function move(id: LibraryColumnId, dir: -1 | 1) {
  const i = working.value.findIndex((c) => c.id === id)
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
  emit('apply', working.value.map((c) => ({ ...c })))
  emit('update:open', false)
}
</script>

<template>
  <UModal :open="open" :title="t('library.columnsDialog.title')" @update:open="(v) => emit('update:open', v)">
    <template #content>
      <div data-test="columns-dialog" class="flex flex-col gap-4 p-4 sm:p-6">
        <h3 class="text-base font-semibold text-highlighted">{{ t('library.columnsDialog.title') }}</h3>

        <ul class="flex flex-col gap-1">
          <li v-for="(col, idx) in working" :key="col.id" class="flex items-center gap-2">
            <span :data-test="`column-grip-${col.id}`" class="cursor-grab text-muted" aria-hidden="true">
              <UIcon name="i-lucide-grip-vertical" />
            </span>
            <UCheckbox
              :data-test="`column-toggle-${col.id}`"
              :model-value="col.visible"
              :disabled="col.visible && visibleCount <= 1"
              :label="t(`library.columns.${col.id}`)"
              class="flex-1"
              @update:model-value="(v) => toggle(col.id, v === true)"
            />
            <UButton
              :data-test="`column-move-up-${col.id}`"
              :disabled="idx === 0"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-chevron-up"
              :aria-label="t('library.columnsDialog.moveUp')"
              @click="move(col.id, -1)"
            />
            <UButton
              :data-test="`column-move-down-${col.id}`"
              :disabled="idx === working.length - 1"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-chevron-down"
              :aria-label="t('library.columnsDialog.moveDown')"
              @click="move(col.id, 1)"
            />
          </li>
        </ul>

        <div class="flex justify-between gap-2">
          <UButton data-test="columns-reset" color="neutral" variant="ghost" size="sm" @click="reset">
            {{ t('library.columnsDialog.reset') }}
          </UButton>
          <div class="flex gap-2">
            <UButton data-test="columns-cancel" color="neutral" variant="ghost" size="sm" @click="cancel">
              {{ t('library.columnsDialog.cancel') }}
            </UButton>
            <UButton data-test="columns-apply" color="primary" size="sm" @click="apply">
              {{ t('library.columnsDialog.apply') }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
