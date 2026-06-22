import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reactive, nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import ConfirmDialog from '~/components/ConfirmDialog.vue'

// Migration coverage for the confirmation overlay (004 / US3, FR-003/004/008): the
// bespoke `.backdrop`/`.dialog` modal (with its hardcoded `#fff` panel and hand-rolled
// focus trap) collapses onto `UModal`. UModal teleports to document.body, so the panel
// is queried there — and it supplies the focus trap, Escape-to-dismiss, and focus-return
// that were previously hand-coded. The public contract (props in, confirm/cancel out,
// the confirm-dialog/confirm-cancel/confirm-ok hooks) stays identical. (SC-002, SC-004)

// UColorMode's real client plugin reaches for a browser-only helper absent in the
// vitest Nuxt env; a reactive stand-in lets us also render the dark variant.
const colorMode = reactive({ preference: 'system', value: 'light' })
mockNuxtImport('useColorMode', () => () => colorMode)

beforeEach(() => {
  colorMode.preference = 'system'
  colorMode.value = 'light'
})
afterEach(() => vi.restoreAllMocks())

/** The teleported dialog panel, or null when the modal is closed. */
function panel(): HTMLElement | null {
  return document.body.querySelector('[data-test="confirm-dialog"]')
}

describe('ConfirmDialog (UModal)', () => {
  it('teleports the dialog panel to document.body only while open', async () => {
    const wrapper = await mountSuspended(ConfirmDialog, { props: { open: false } })
    // The panel is teleported out of the component subtree, so it is never in the
    // wrapper's own DOM — the regression gate queries document.body instead.
    expect(wrapper.find('[data-test="confirm-dialog"]').exists()).toBe(false)
    expect(panel()).toBeNull()

    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(panel()).not.toBeNull()

    await wrapper.setProps({ open: false })
    await flushPromises()
    expect(panel()).toBeNull()
    wrapper.unmount()
  })

  it('preserves the confirm-dialog/confirm-cancel/confirm-ok hooks and labels', async () => {
    const wrapper = await mountSuspended(ConfirmDialog, {
      props: {
        open: true,
        title: 'Delete it?',
        message: 'This cannot be undone.',
        confirmLabel: 'Delete',
        cancelLabel: 'Keep',
      },
    })
    await flushPromises()

    const p = panel()!
    expect(p).not.toBeNull()
    expect(p.textContent).toContain('Delete it?')
    expect(p.textContent).toContain('This cannot be undone.')
    expect(document.body.querySelector('[data-test="confirm-cancel"]')?.textContent).toContain('Keep')
    expect(document.body.querySelector('[data-test="confirm-ok"]')?.textContent).toContain('Delete')
    wrapper.unmount()
  })

  it('emits confirm/cancel from the footer buttons', async () => {
    const wrapper = await mountSuspended(ConfirmDialog, { props: { open: true } })
    await flushPromises()

    ;(document.body.querySelector('[data-test="confirm-cancel"]') as HTMLElement).click()
    expect(wrapper.emitted('cancel')).toBeTruthy()

    ;(document.body.querySelector('[data-test="confirm-ok"]') as HTMLElement).click()
    expect(wrapper.emitted('confirm')).toBeTruthy()
    wrapper.unmount()
  })

  it('emits cancel when Escape is pressed (UModal dismiss)', async () => {
    const wrapper = await mountSuspended(ConfirmDialog, { props: { open: true } })
    await flushPromises()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()

    expect(wrapper.emitted('cancel')).toBeTruthy()
    wrapper.unmount()
  })

  it('moves focus into the dialog on open', async () => {
    const wrapper = await mountSuspended(ConfirmDialog, {
      props: { open: false },
      attachTo: document.body,
    })
    await wrapper.setProps({ open: true })
    await flushPromises()
    await nextTick()

    const p = panel()!
    expect(p).not.toBeNull()
    expect(p.contains(document.activeElement)).toBe(true)
    wrapper.unmount()
  })

  it('returns focus to the element that was focused before it opened', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const wrapper = await mountSuspended(ConfirmDialog, {
      props: { open: false },
      attachTo: document.body,
    })
    await wrapper.setProps({ open: true })
    await flushPromises()
    await nextTick()
    expect(document.activeElement).not.toBe(trigger)

    await wrapper.setProps({ open: false })
    await flushPromises()
    await nextTick()
    expect(document.activeElement).toBe(trigger)

    wrapper.unmount()
    trigger.remove()
  })

  it('renders via the design-system overlay with no bespoke hardcoded panel in dark mode', async () => {
    colorMode.preference = 'dark'
    colorMode.value = 'dark'
    const wrapper = await mountSuspended(ConfirmDialog, { props: { open: true } })
    await flushPromises()

    // The dark-mode defect was a hardcoded-#fff `.dialog` inside a `.backdrop`. The
    // migrated overlay uses the themed design-system panel, so neither class exists.
    expect(document.querySelector('.backdrop')).toBeNull()
    expect(document.querySelector('.dialog')).toBeNull()
    expect(panel()).not.toBeNull()
    wrapper.unmount()
  })
})
