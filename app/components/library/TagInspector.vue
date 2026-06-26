<script setup lang="ts">
import type { Metadata } from '#core/client'
import type { LibraryItem } from '../../composables/useLibrary'
import type { TagDraft } from '../../composables/useTagDrafts'
import type { InspectorFieldId, InspectorFieldPref } from '../../composables/useViewPreferences'

// 006 · US1+US5 (FR-005/FR-006/FR-018/FR-019/FR-020/FR-022/FR-032) — the tag-editor
// inspector (forks AudioTagsPanel + LibraryItemEditor). A FIXED "Tag Editor (ID3v2.4)"
// title + a settings gear (opens Configure Visible Fields); a toolbar of Previous /
// Next / Play Audio / Save; and ALL 15 fields editable — Name (rename base) plus the
// 14 toggleable tag fields, including the 6 R-TAGS extras (Text/Encoded-By/Album
// Artist/Composer/BPM/Rating). Edits mutate the page's staged `draft` IN PLACE so the
// page's useTagDrafts auto-preserves them across selection (Q4); Save emits to the
// page (which commits via useLibrary.update). Field order + visibility come from the
// `fields` prop (useViewPreferences.inspectorFields); Name is always-on (rendered
// first, never in that set). Empty state when nothing is selected (FR-005).
const props = defineProps<{
  item: LibraryItem | null
  /** Whether the active recording has unsaved staged edits (drives the dirty indicator). */
  dirty?: boolean
  hasPrev: boolean
  hasNext: boolean
  /** Ordered, toggleable field visibility from view preferences (Name not included). */
  fields: InspectorFieldPref[]
}>()
// The page's staged editable view for the active recording (null ⇒ nothing selected).
// A two-way model: the inspector edits it IN PLACE so the page's useTagDrafts buffer
// (the same object) stays the single source of truth and auto-preserves across
// selection (Q4). We only mutate nested fields, never reassign — so no event fires,
// the page reads dirty via useTagDrafts, not via a write-back.
const draftModel = defineModel<TagDraft | null>('draft', { default: null })
const emit = defineEmits<{
  prev: []
  next: []
  play: []
  save: []
  'open-fields-dialog': []
}>()

const { t } = useI18n()

// FR-032: the header is a FIXED title (the tag standard, not a localized phrase).
const INSPECTOR_TITLE = 'Tag Editor (ID3v2.4)'

type FieldKind = 'text' | 'textarea' | 'integer' | 'language'
interface FieldDef {
  /** i18n key under `library.inspector.fields` (Text/notes is keyed `notes`). */
  labelKey: string
  kind: FieldKind
  /** Backing Metadata key (absent for `language`, which is multi-value). */
  metaKey?: keyof Metadata
}

// The 14 toggleable fields → their label + editable control + Metadata backing
// (data-model §1). Name is always-on and handled separately (it renames the file).
const FIELD_DEFS: Record<InspectorFieldId, FieldDef> = {
  text: { labelKey: 'notes', kind: 'textarea', metaKey: 'notes' },
  title: { labelKey: 'title', kind: 'text', metaKey: 'title' },
  artist: { labelKey: 'artist', kind: 'text', metaKey: 'artist' },
  album: { labelKey: 'album', kind: 'text', metaKey: 'album' },
  comment: { labelKey: 'comment', kind: 'textarea', metaKey: 'comment' },
  date: { labelKey: 'date', kind: 'text', metaKey: 'recordedAt' },
  track: { labelKey: 'track', kind: 'text', metaKey: 'track' },
  genre: { labelKey: 'genre', kind: 'text', metaKey: 'genre' },
  encodedBy: { labelKey: 'encodedBy', kind: 'text', metaKey: 'encodedBy' },
  language: { labelKey: 'language', kind: 'language' },
  albumArtist: { labelKey: 'albumArtist', kind: 'text', metaKey: 'albumArtist' },
  composer: { labelKey: 'composer', kind: 'text', metaKey: 'composer' },
  bpm: { labelKey: 'bpm', kind: 'integer', metaKey: 'bpm' },
  rating: { labelKey: 'rating', kind: 'integer', metaKey: 'rating' },
}

/** The visible toggleable fields in preference order (Name is rendered separately). */
const visibleFields = computed(() =>
  props.fields.filter((f) => f.visible && FIELD_DEFS[f.id]).map((f) => ({ id: f.id, ...FIELD_DEFS[f.id] })),
)

/** data-test suffix per field (lowercased: encodedBy→encodedby, albumArtist→albumartist). */
function testId(id: string): string {
  return `field-${id.toLowerCase()}`
}

// The immutable extension shown read-only beside the editable Name (rename base).
const ext = computed(() => {
  const filename = props.item?.filename ?? ''
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(dot) : ''
})

function nameValue(): string {
  return draftModel.value?.filenameBase ?? ''
}
function onName(value: unknown): void {
  if (draftModel.value) draftModel.value.filenameBase = String(value ?? '')
}

// --- Field get/set: every edit reassigns draft.metadata immutably so the page's
// reactive dirty check (JSON compare) fires; clearing a field drops the key (FR-023).
function strValue(key?: keyof Metadata): string {
  if (!key || !draftModel.value) return ''
  const value = draftModel.value.metadata[key]
  return value == null ? '' : String(value)
}
function onStr(key: keyof Metadata | undefined, value: unknown): void {
  if (!key || !draftModel.value) return
  const next = String(value ?? '')
  draftModel.value.metadata = { ...draftModel.value.metadata, [key]: next === '' ? undefined : next }
}

function intValue(key?: keyof Metadata): string {
  if (!key || !draftModel.value) return ''
  const value = draftModel.value.metadata[key]
  return typeof value === 'number' ? String(value) : ''
}
function onInt(id: InspectorFieldId, value: unknown): void {
  if (!draftModel.value) return
  const key = id === 'rating' ? 'rating' : 'bpm'
  const n = parseInt(String(value ?? ''), 10)
  const next = Number.isFinite(n) ? (id === 'rating' ? Math.max(0, Math.min(5, n)) : Math.max(0, n)) : undefined
  draftModel.value.metadata = { ...draftModel.value.metadata, [key]: next }
}

function langValue(): string {
  return (draftModel.value?.metadata.languages ?? []).join(', ')
}
function onLang(value: unknown): void {
  if (!draftModel.value) return
  const arr = String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  draftModel.value.metadata = { ...draftModel.value.metadata, languages: arr.length ? arr : undefined }
}
</script>

<template>
  <section data-test="tag-inspector" :aria-label="INSPECTOR_TITLE" class="flex flex-col gap-3">
    <header class="flex items-center justify-between gap-2">
      <h2 data-test="inspector-title" class="text-base font-semibold">{{ INSPECTOR_TITLE }}</h2>
      <UButton
        data-test="inspector-fields-gear"
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-settings"
        :aria-label="t('library.inspector.configureFields')"
        @click="emit('open-fields-dialog')"
      />
    </header>

    <div class="flex items-center gap-2">
      <UButton
        data-test="tags-prev"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-chevron-left"
        :disabled="!hasPrev"
        :aria-label="t('library.inspector.prev')"
        @click="emit('prev')"
      >
        {{ t('library.inspector.prev') }}
      </UButton>
      <UButton
        data-test="tags-next"
        color="neutral"
        variant="outline"
        size="sm"
        trailing-icon="i-lucide-chevron-right"
        :disabled="!hasNext"
        :aria-label="t('library.inspector.next')"
        @click="emit('next')"
      >
        {{ t('library.inspector.next') }}
      </UButton>
      <UButton
        data-test="inspector-play"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-play"
        :disabled="!item"
        :aria-label="t('library.inspector.play')"
        @click="emit('play')"
      >
        {{ t('library.inspector.play') }}
      </UButton>
      <UButton
        data-test="inspector-save"
        color="primary"
        size="sm"
        icon="i-lucide-save"
        class="ml-auto"
        :disabled="!item"
        :aria-label="t('library.inspector.save')"
        @click="emit('save')"
      >
        {{ t('library.inspector.save') }}
      </UButton>
      <UBadge v-if="dirty" data-test="inspector-dirty" color="warning" variant="soft" size="sm">
        {{ t('library.inspector.dirty') }}
      </UBadge>
    </div>

    <div v-if="item && draftModel" data-test="inspector-fields" class="flex flex-col gap-3">
      <!-- Name (always-on, FR-020): the rename base + the immutable extension. -->
      <UFormField :label="t('library.inspector.fields.name')">
        <UInput data-test="field-name" :model-value="nameValue()" class="w-full" @update:model-value="onName">
          <template #trailing>
            <span data-test="filename-ext" class="text-sm text-muted">{{ ext }}</span>
          </template>
        </UInput>
      </UFormField>

      <UFormField v-for="f in visibleFields" :key="f.id" :label="t(`library.inspector.fields.${f.labelKey}`)">
        <UTextarea
          v-if="f.kind === 'textarea'"
          :data-test="testId(f.id)"
          :model-value="strValue(f.metaKey)"
          :rows="2"
          class="w-full"
          @update:model-value="(v) => onStr(f.metaKey, v)"
        />
        <UInput
          v-else-if="f.kind === 'language'"
          :data-test="testId(f.id)"
          :model-value="langValue()"
          class="w-full"
          @update:model-value="onLang"
        />
        <UInput
          v-else-if="f.kind === 'integer'"
          :data-test="testId(f.id)"
          :model-value="intValue(f.metaKey)"
          inputmode="numeric"
          class="w-full"
          @update:model-value="(v) => onInt(f.id, v)"
        />
        <UInput
          v-else
          :data-test="testId(f.id)"
          :model-value="strValue(f.metaKey)"
          class="w-full"
          @update:model-value="(v) => onStr(f.metaKey, v)"
        />
      </UFormField>
    </div>
    <p v-else data-test="tags-empty" class="text-sm text-muted">
      {{ t('library.inspector.empty') }}
    </p>
  </section>
</template>
