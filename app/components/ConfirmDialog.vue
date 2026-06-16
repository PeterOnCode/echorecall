<script setup lang="ts">
// Reusable confirmation prompt for destructive actions (e.g. permanent delete,
// FR-015). Purely presentational: the parent owns the `open` state and decides
// what `confirm`/`cancel` do.
//
// Accessibility: it's a modal dialog (role="dialog" aria-modal), so when it
// opens we move focus into it (the least-destructive Cancel button), trap Tab
// focus inside it, let Escape cancel, and restore focus to whatever was focused
// before it opened when it closes.
const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
  }>(),
  {
    title: 'Are you sure?',
    message: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
  },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const dialog = ref<HTMLElement | null>(null)
// The element focused before the dialog opened, so focus can return there on close.
let previouslyFocused: HTMLElement | null = null

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function focusable(): HTMLElement[] {
  return dialog.value ? Array.from(dialog.value.querySelectorAll<HTMLElement>(FOCUSABLE)) : []
}

watch(
  () => props.open,
  async (open) => {
    if (typeof document === 'undefined') return
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement | null
      await nextTick()
      focusable()[0]?.focus()
    } else if (previouslyFocused) {
      previouslyFocused.focus()
      previouslyFocused = null
    }
  },
)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('cancel')
    return
  }
  if (e.key !== 'Tab') return

  const items = focusable()
  if (items.length === 0) return
  const first = items[0]!
  const last = items[items.length - 1]!
  const index = items.indexOf(document.activeElement as HTMLElement)

  // Wrap focus so Tab/Shift+Tab never leave the open dialog.
  if (e.shiftKey && index <= 0) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (index === -1 || index === items.length - 1)) {
    e.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <div
    v-if="open"
    class="backdrop"
    data-test="confirm-dialog"
    @click.self="emit('cancel')"
    @keydown="onKeydown"
  >
    <div
      ref="dialog"
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      :aria-describedby="message ? 'confirm-dialog-message' : undefined"
    >
      <h3 id="confirm-dialog-title" class="title">{{ title }}</h3>
      <p v-if="message" id="confirm-dialog-message" class="message">{{ message }}</p>
      <div class="actions">
        <button type="button" data-test="confirm-cancel" @click="emit('cancel')">
          {{ cancelLabel }}
        </button>
        <button type="button" data-test="confirm-ok" class="danger" @click="emit('confirm')">
          {{ confirmLabel }}
        </button>
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
  background: #fff;
  border-radius: 0.5rem;
  padding: 1.25rem 1.5rem;
  max-width: 24rem;
  width: calc(100% - 2rem);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}
.title {
  margin: 0 0 0.5rem;
}
.message {
  margin: 0 0 1rem;
  color: #555;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
.danger {
  color: #b60205;
}
</style>
