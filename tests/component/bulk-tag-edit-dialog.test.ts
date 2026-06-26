import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BulkTagEditDialog from '~/components/library/BulkTagEditDialog.vue'

// 006 · US4 (FR-016) — Bulk tag edit modal: pick ONE editable tag field (incl. the
// extra R-TAGS fields; filename excluded) + a value, apply across the selection, and
// show a succeeded/failed result summary. UModal teleports to document.body.

function el(testId: string): HTMLElement | null {
  return document.body.querySelector(`[data-test="${testId}"]`)
}

function setField(wrapper: VueWrapper, value: string) {
  wrapper.findAllComponents({ name: 'USelectMenu' })[0]!.vm.$emit('update:modelValue', value)
}
function setValue(wrapper: VueWrapper, value: string) {
  wrapper.findAllComponents({ name: 'UInput' })[0]!.vm.$emit('update:modelValue', value)
}

describe('BulkTagEditDialog (US4)', () => {
  it('emits apply with the chosen field + value', async () => {
    const wrapper = await mountSuspended(BulkTagEditDialog, { props: { open: true, count: 3 } })
    await flushPromises()
    setField(wrapper, 'albumArtist')
    setValue(wrapper, 'The Band')
    await flushPromises()
    el('bulk-apply')!.click()
    await flushPromises()
    expect(wrapper.emitted('apply')!.at(-1)![0]).toEqual({ field: 'albumArtist', value: 'The Band' })
    wrapper.unmount()
  })

  it('offers an extra (R-TAGS) field such as Composer alongside the standard ones', async () => {
    const wrapper = await mountSuspended(BulkTagEditDialog, { props: { open: true, count: 2 } })
    await flushPromises()
    setField(wrapper, 'composer')
    setValue(wrapper, 'J.S. Bach')
    await flushPromises()
    el('bulk-apply')!.click()
    await flushPromises()
    expect(wrapper.emitted('apply')!.at(-1)![0]).toEqual({ field: 'composer', value: 'J.S. Bach' })
    wrapper.unmount()
  })

  it('shows the succeeded/failed result summary (FR-016)', async () => {
    const wrapper = await mountSuspended(BulkTagEditDialog, {
      props: { open: true, count: 3, result: { succeeded: 2, failed: ['z'] } },
    })
    await flushPromises()
    const summary = el('bulk-result')
    expect(summary).not.toBeNull()
    expect(summary!.textContent).toContain('2')
    wrapper.unmount()
  })

  it('cancel closes the dialog', async () => {
    const wrapper = await mountSuspended(BulkTagEditDialog, { props: { open: true, count: 1 } })
    await flushPromises()
    el('bulk-cancel')!.click()
    await flushPromises()
    expect(wrapper.emitted('close')).toBeTruthy()
    wrapper.unmount()
  })
})
