<script setup lang="ts">
import { MAX_INPUT_LENGTH } from '#core/client'
import { validateItemText, type TextRejection } from '../../composables/useQueue'

// 007 · US1 (FR-004): the Script entry column — a titled panel with a badge, a textarea,
// a character hint, Clear, and "Add to queue". Forks the 005 AddTextPanel: it validates
// with the shared validateItemText and emits `add` with the trimmed text (the page turns
// it into a source:'text' row), refusing a blank entry with a localized reason. Clear
// empties the box and emits `clear`. Ctrl/Cmd+Enter adds without leaving the box.
const emit = defineEmits<{ add: [text: string]; clear: [] }>()
const { t } = useI18n()

const text = ref('')
const error = ref<TextRejection | null>(null)

const errorMessage = computed(() => {
  if (error.value === null) return undefined
  return error.value === 'empty' ? t('generateNext.script.empty') : t('generateNext.script.tooLong')
})

function onAdd() {
  const result = validateItemText(text.value)
  if (!result.ok) {
    error.value = result.reason
    return
  }
  error.value = null
  emit('add', result.text)
  text.value = ''
}

function onClear() {
  text.value = ''
  error.value = null
  emit('clear')
}

// Ctrl+Enter (Win/Linux) / Cmd+Enter (macOS) add; plain Enter still inserts a newline.
function onKeydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    onAdd()
  }
}
</script>

<template>
  <div data-test="script-panel" class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <h2 class="text-sm font-medium">{{ t('generateNext.script.title') }}</h2>
      <UBadge color="primary" variant="subtle" size="sm">{{ t('generateNext.script.badge') }}</UBadge>
    </div>

    <UFormField :error="errorMessage">
      <UTextarea
        v-model="text"
        data-test="add-text-input"
        :rows="6"
        :placeholder="t('generateNext.script.placeholder')"
        :aria-label="t('generateNext.script.title')"
        class="w-full"
        @input="error = null"
        @keydown.enter="onKeydown"
      />
      <template v-if="error" #error>
        <span data-test="add-text-error">{{ errorMessage }}</span>
      </template>
    </UFormField>

    <div class="flex items-center justify-between gap-2">
      <span data-test="script-charcount" class="text-xs text-muted">{{ text.length }} / {{ MAX_INPUT_LENGTH }}</span>
      <div class="flex gap-2">
        <UButton
          data-test="script-clear"
          color="neutral"
          variant="ghost"
          icon="i-lucide-eraser"
          @click="onClear"
        >
          {{ t('generateNext.script.clear') }}
        </UButton>
        <UButton data-test="add-text-submit" icon="i-lucide-plus" @click="onAdd">
          {{ t('generateNext.script.add') }}
        </UButton>
      </div>
    </div>
  </div>
</template>
