<script setup lang="ts">
import { validateItemText, type TextRejection } from '../../composables/useQueue'

// Ad-hoc text entry (005 · US4 / FR-013): a single text box + Add that appends one
// queued row from typed text (source "Text Entered"). Presentational — it validates
// with the shared validateItemText so an empty/over-cap entry is refused with a
// localized reason and nothing is emitted; the owner (index.vue) turns a valid `add`
// into a queue row via addItem, which tags it source:'text'. Ctrl/Cmd+Enter adds
// without leaving the box. Replaces the interim text-add GenerateForm carried through
// US1–US3.
const emit = defineEmits<{ add: [text: string] }>()
const { t } = useI18n()

const text = ref('')
const error = ref<TextRejection | null>(null)

// Localized rejection message bound to UFormField's `error` prop (not just the slot):
// the prop is what drives the textarea's aria-invalid + aria-describedby association,
// so an assistive-tech user hears why the entry was refused. The slot below keeps the
// stable test hook and renders this same message.
const errorMessage = computed(() => {
  if (error.value === null) return undefined
  return error.value === 'empty' ? t('generate.addText.empty') : t('generate.addText.tooLong')
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
</script>

<template>
  <div data-test="add-text-panel" class="flex flex-col gap-2">
    <UFormField :label="t('generate.addText.label')" :error="errorMessage">
      <div class="flex items-start gap-2">
        <UTextarea
          v-model="text"
          data-test="add-text-input"
          :rows="2"
          :placeholder="t('generate.addText.placeholder')"
          class="w-full"
          @input="error = null"
          @keydown.ctrl.enter.prevent="onAdd"
          @keydown.meta.enter.prevent="onAdd"
        />
        <UButton data-test="add-text-submit" icon="i-lucide-plus" @click="onAdd">
          {{ t('generate.addText.submit') }}
        </UButton>
      </div>
      <template v-if="error" #error>
        <span data-test="add-text-error">{{ errorMessage }}</span>
      </template>
    </UFormField>
  </div>
</template>
