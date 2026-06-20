import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BulkCleanDialog from '~/components/library/BulkCleanDialog.vue'

// Accessibility coverage for the custom bulk-clean modal (T105). Beyond its
// existing semantics (role="dialog"/aria-modal/aria-labelledby), it must be
// keyboard-dismissible (Esc) and move focus into itself when opened so screen
// readers announce it and the Esc keydown is caught regardless of active control.

describe('BulkCleanDialog — keyboard & focus a11y', () => {
  it('emits cancel when Escape is pressed', async () => {
    const wrapper = await mountSuspended(BulkCleanDialog, { props: { open: true } })
    await wrapper.find('[role="dialog"]').trigger('keydown.esc')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('moves focus into the dialog when it opens', async () => {
    const wrapper = await mountSuspended(BulkCleanDialog, {
      props: { open: false },
      attachTo: document.body,
    })
    await wrapper.setProps({ open: true })
    await nextTick() // the open watcher focuses the dialog on the next tick

    expect(document.activeElement).toBe(wrapper.find('[role="dialog"]').element)
    wrapper.unmount()
  })
})
