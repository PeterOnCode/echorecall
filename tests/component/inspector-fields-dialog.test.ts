import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import InspectorFieldsDialog from '~/components/library/InspectorFieldsDialog.vue'
import type { InspectorFieldPref } from '~/composables/useViewPreferences'

// 006 · US5 (FR-020/FR-031) — Configure Visible Fields modal: the 14 toggleable inspector
// fields (Name is always-on, NOT listed), toggle + reorder, a not-all-hidden guard, and a
// Reset / Cancel / Apply footer. Mirrors LibraryColumnsDialog. UModal teleports to body.

const INVENTORY = [
  'text',
  'title',
  'artist',
  'album',
  'comment',
  'date',
  'track',
  'genre',
  'encodedBy',
  'language',
  'albumArtist',
  'composer',
  'bpm',
  'rating',
]

function fields(over: Partial<Record<string, boolean>> = {}): InspectorFieldPref[] {
  return INVENTORY.map((id) => ({ id: id as InspectorFieldPref['id'], visible: over[id] ?? true }))
}

function el(testId: string): HTMLElement | null {
  return document.body.querySelector(`[data-test="${testId}"]`)
}

function mountDialog(value: InspectorFieldPref[] = fields()) {
  return mountSuspended(InspectorFieldsDialog, { props: { open: true, fields: value } })
}

describe('InspectorFieldsDialog (US5)', () => {
  it('renders a toggle for every inspector field; Name is not listed', async () => {
    const wrapper = await mountDialog()
    await flushPromises()
    expect(el('inspector-fields-dialog')).not.toBeNull()
    for (const id of INVENTORY) expect(el(`field-toggle-${id}`), id).not.toBeNull()
    expect(el('field-toggle-name')).toBeNull()
    wrapper.unmount()
  })

  it('applies the working set (toggled visibility) on Apply', async () => {
    const wrapper = await mountDialog()
    await flushPromises()
    el('field-toggle-bpm')!.click()
    await flushPromises()
    el('inspector-fields-apply')!.click()
    await flushPromises()
    const applied = wrapper.emitted('apply')!.at(-1)![0] as InspectorFieldPref[]
    expect(applied.find((f) => f.id === 'bpm')!.visible).toBe(false)
    wrapper.unmount()
  })

  it('reorders a field via move-up and applies the new order', async () => {
    const wrapper = await mountDialog()
    await flushPromises()
    // 'title' is second; move it up → first.
    el('field-move-up-title')!.click()
    await flushPromises()
    el('inspector-fields-apply')!.click()
    await flushPromises()
    const applied = wrapper.emitted('apply')!.at(-1)![0] as InspectorFieldPref[]
    expect(applied[0]!.id).toBe('title')
    wrapper.unmount()
  })

  it('disables the last visible toggle (not-all-hidden guard)', async () => {
    const wrapper = await mountDialog(fields(Object.fromEntries(INVENTORY.map((id) => [id, id === 'title']))))
    await flushPromises()
    expect((el('field-toggle-title') as HTMLButtonElement).disabled).toBe(true)
    expect((el('field-toggle-bpm') as HTMLButtonElement).disabled).toBe(false)
    wrapper.unmount()
  })

  it('Cancel closes without applying', async () => {
    const wrapper = await mountDialog()
    await flushPromises()
    el('field-toggle-bpm')!.click()
    el('inspector-fields-cancel')!.click()
    await flushPromises()
    expect(wrapper.emitted('apply')).toBeFalsy()
    expect(wrapper.emitted('update:open')!.at(-1)![0]).toBe(false)
    wrapper.unmount()
  })

  it('Reset restores the all-visible canonical order', async () => {
    const wrapper = await mountDialog(fields({ bpm: false }))
    await flushPromises()
    el('inspector-fields-reset')!.click()
    await flushPromises()
    el('inspector-fields-apply')!.click()
    await flushPromises()
    const applied = wrapper.emitted('apply')!.at(-1)![0] as InspectorFieldPref[]
    expect(applied.map((f) => f.id)).toEqual(INVENTORY)
    expect(applied.every((f) => f.visible)).toBe(true)
    wrapper.unmount()
  })
})
