<script setup lang="ts">
import type { AudioProperties } from '#core/client'

// 006 · US6 (FR-023 / data-model §4) — the read-only Library status bar. A pure
// projection of state already owned by the page: the global save state (any unsaved
// draft) + dirty count, the filtered files-loaded count, the active selection's
// filename (or none), the constant UTF-8 tag charset, and the active recording's real
// audio properties (codec / bitrate / sample rate from R-AUDIOPROPS — left blank where
// the file is unreadable). It owns no network and emits nothing; `role="status"` lets
// assistive tech announce the save-state flip on edit / after Save.
const props = withDefaults(
  defineProps<{
    saveState: 'saved' | 'unsaved'
    dirtyCount: number
    filesLoaded: number
    selection: string | null
    charset?: string
    audio?: AudioProperties
  }>(),
  { charset: 'UTF-8', audio: undefined },
)

const { t } = useI18n()

const saveText = computed(() =>
  props.saveState === 'unsaved'
    ? t('library.status.unsaved', { count: props.dirtyCount })
    : t('library.status.saved'),
)
const filesText = computed(() => t('library.status.files', { count: props.filesLoaded }))
const selectionText = computed(() =>
  props.selection
    ? t('library.status.selection', { name: props.selection })
    : t('library.status.noSelection'),
)

// Codec / bitrate / sample rate are data, not translated (T054). Units are conventional.
const audioText = computed(() => {
  const a = props.audio
  if (!a) return ''
  const details: string[] = []
  if (a.bitrate) details.push(`${a.bitrate} kbps`)
  if (a.sampleRate) details.push(`${a.sampleRate} Hz`)
  const codec = a.codec ?? ''
  if (codec && details.length) return `${codec} (${details.join(', ')})`
  return codec || details.join(', ')
})
</script>

<template>
  <div
    data-test="status-bar"
    role="status"
    class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-default px-3 py-1.5 text-xs text-muted"
  >
    <div class="flex flex-wrap items-center gap-x-2">
      <span data-test="status-save">{{ saveText }}</span>
      <span aria-hidden="true">·</span>
      <span data-test="status-files">{{ filesText }}</span>
      <span aria-hidden="true">·</span>
      <span data-test="status-selection">{{ selectionText }}</span>
    </div>
    <div class="flex flex-wrap items-center gap-x-2">
      <span data-test="status-charset">{{ charset }}</span>
      <span v-if="audioText" aria-hidden="true">·</span>
      <span data-test="status-audio">{{ audioText }}</span>
    </div>
  </div>
</template>
