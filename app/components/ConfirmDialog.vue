<script setup lang="ts">
// Reusable confirmation prompt for destructive actions (e.g. permanent delete,
// FR-015). Purely presentational: the parent owns the `open` state and decides
// what `confirm`/`cancel` do.
//
// Built on `UModal` (004 / US3): the design-system overlay provides the focus
// trap, Escape-to-dismiss, backdrop click, and focus-return that were previously
// hand-rolled, and it themes correctly in dark mode (fixing the old hardcoded-#fff
// panel). The panel teleports to document.body.
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

// UModal emits `update:open(false)` when the user dismisses it (Escape, backdrop
// click). Because `open` is parent-controlled, that only fires on a user dismiss —
// which is a cancel. Confirm/Cancel buttons emit directly.
function onOpenChange(value: boolean) {
  if (!value) emit('cancel')
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :description="message || undefined"
    :dismissible="true"
    @update:open="onOpenChange"
  >
    <template #content>
      <div data-test="confirm-dialog" class="flex flex-col gap-3 p-4 sm:p-6">
        <h3 class="text-base font-semibold text-highlighted">{{ title }}</h3>
        <p v-if="message" class="text-sm text-muted">{{ message }}</p>
        <div class="flex justify-end gap-2">
          <UButton
            data-test="confirm-cancel"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="emit('cancel')"
          >
            {{ cancelLabel }}
          </UButton>
          <UButton data-test="confirm-ok" color="error" size="sm" @click="emit('confirm')">
            {{ confirmLabel }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
