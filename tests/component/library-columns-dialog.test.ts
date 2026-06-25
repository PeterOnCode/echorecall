import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LibraryColumnsDialog from '~/components/library/LibraryColumnsDialog.vue'
import type { LibraryColumnPref } from '~/composables/useViewPreferences'

// 006 · US4 (FR-017/FR-031) — Configure Columns modal: the full toggleable inventory
// (Title/Artist/Album/Year/Track/Genre/Comment/Date/Composer/Duration/Bitrate),
// toggle + reorder, Filename always-on (not listed), a not-all-hidden guard, and a
// Reset / Cancel / Apply footer. UModal teleports to document.body.

const INVENTORY = [
  'title',
  'artist',
  'album',
  'year',
  'track',
  'genre',
  'comment',
  'date',
  'composer',
  'duration',
  'bitrate',
]

function cols(over: Partial<Record<string, boolean>> = {}): LibraryColumnPref[] {
  return INVENTORY.map((id) => ({ id: id as LibraryColumnPref['id'], visible: over[id] ?? true }))
}

function el(testId: string): HTMLElement | null {
  return document.body.querySelector(`[data-test="${testId}"]`)
}

function mountDialog(columns: LibraryColumnPref[] = cols()) {
  return mountSuspended(LibraryColumnsDialog, { props: { open: true, columns } })
}

describe('LibraryColumnsDialog (US4)', () => {
  it('renders a toggle for every inventory column; Filename is not listed', async () => {
    const wrapper = await mountDialog()
    await flushPromises()
    expect(el('columns-dialog')).not.toBeNull()
    for (const id of INVENTORY) expect(el(`column-toggle-${id}`), id).not.toBeNull()
    expect(el('column-toggle-name')).toBeNull()
    wrapper.unmount()
  })

  it('applies the working set (toggled visibility) on Apply', async () => {
    const wrapper = await mountDialog()
    await flushPromises()
    el('column-toggle-genre')!.click()
    await flushPromises()
    el('columns-apply')!.click()
    await flushPromises()
    const applied = wrapper.emitted('apply')!.at(-1)![0] as LibraryColumnPref[]
    expect(applied.find((c) => c.id === 'genre')!.visible).toBe(false)
    wrapper.unmount()
  })

  it('reorders a column via move-up and applies the new order', async () => {
    const wrapper = await mountDialog()
    await flushPromises()
    // 'artist' is second; move it up → first.
    el('column-move-up-artist')!.click()
    await flushPromises()
    el('columns-apply')!.click()
    await flushPromises()
    const applied = wrapper.emitted('apply')!.at(-1)![0] as LibraryColumnPref[]
    expect(applied[0]!.id).toBe('artist')
    wrapper.unmount()
  })

  it('disables the last visible toggle (not-all-hidden guard)', async () => {
    const wrapper = await mountDialog(cols(Object.fromEntries(INVENTORY.map((id) => [id, id === 'title']))))
    await flushPromises()
    expect((el('column-toggle-title') as HTMLButtonElement).disabled).toBe(true)
    expect((el('column-toggle-genre') as HTMLButtonElement).disabled).toBe(false)
    wrapper.unmount()
  })

  it('Cancel closes without applying', async () => {
    const wrapper = await mountDialog()
    await flushPromises()
    el('column-toggle-genre')!.click()
    el('columns-cancel')!.click()
    await flushPromises()
    expect(wrapper.emitted('apply')).toBeFalsy()
    expect(wrapper.emitted('update:open')!.at(-1)![0]).toBe(false)
    wrapper.unmount()
  })

  it('Reset restores the all-visible canonical order', async () => {
    const wrapper = await mountDialog(cols({ genre: false }))
    await flushPromises()
    el('columns-reset')!.click()
    await flushPromises()
    el('columns-apply')!.click()
    await flushPromises()
    const applied = wrapper.emitted('apply')!.at(-1)![0] as LibraryColumnPref[]
    expect(applied.map((c) => c.id)).toEqual(INVENTORY)
    expect(applied.every((c) => c.visible)).toBe(true)
    wrapper.unmount()
  })
})
