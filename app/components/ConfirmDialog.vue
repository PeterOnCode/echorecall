<script setup lang="ts">
// Reusable confirmation prompt for destructive actions (e.g. permanent delete,
// FR-015). Purely presentational: the parent owns the `open` state and decides
// what `confirm`/`cancel` do. Richer focus/keyboard handling is layered on in the
// accessibility pass.
withDefaults(
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
</script>

<template>
  <div
    v-if="open"
    class="backdrop"
    data-test="confirm-dialog"
    @click.self="emit('cancel')"
  >
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <h3 id="confirm-dialog-title" class="title">{{ title }}</h3>
      <p v-if="message" class="message">{{ message }}</p>
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
