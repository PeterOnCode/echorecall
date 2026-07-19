import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MetadataFieldsDialog from '~/components/generate/MetadataFieldsDialog.vue'
import type { MetadataFieldId, MetadataFieldPref } from '~/composables/useViewPreferences'

// 007 · Configure Visible Fields modal for the Generate metadata editor (mirrors the
// inspector dialog): one toggle + move up/down per field, a not-all-hidden guard, commit
// only on Apply (Cancel/close discards), and Reset → the canonical all-visible order. The
// dialog edits a LOCAL working copy; the page persists the applied set. UModal teleports its
// panel to document.body, so the controls are queried there.

// 007 · `title` and `track` are derived at generation time, so they are not part of the
// Configure Visible Fields dialog inventory.
const IDS: MetadataFieldId[] = [
  'artist',
  'album',
  'genre',
  'recordedAt',
  'comment',
  'languages',
  'customText',
  'customUrl',
]

function allVisible(): MetadataFieldPref[] {
  return IDS.map((id) => ({ id, visible: true }))
}

function el(testId: string): HTMLElement | null {
  return document.body.querySelector(`[data-test="${testId}"]`)
}

describe('MetadataFieldsDialog', () => {
  it('renders a toggle + move controls for every metadata field', async () => {
    const wrapper = await mountSuspended(MetadataFieldsDialog, {
      props: { open: true, fields: allVisible() },
    })
    await flushPromises()
    expect(el('metadata-fields-dialog')).not.toBeNull()
    for (const id of IDS) {
      expect(el(`mfield-toggle-${id}`), id).not.toBeNull()
      expect(el(`mfield-move-up-${id}`), id).not.toBeNull()
      expect(el(`mfield-move-down-${id}`), id).not.toBeNull()
    }
    // Title + Track are derived, not configurable — no toggle for them.
    expect(el('mfield-toggle-title')).toBeNull()
    expect(el('mfield-toggle-track')).toBeNull()
    wrapper.unmount()
  })

  it('commits only on Apply, emitting the working set with a hidden field', async () => {
    const wrapper = await mountSuspended(MetadataFieldsDialog, {
      props: { open: true, fields: allVisible() },
    })
    await flushPromises()

    el('mfield-toggle-comment')!.click()
    await flushPromises()
    // Nothing committed until Apply.
    expect(wrapper.emitted('apply')).toBeFalsy()

    el('metadata-fields-apply')!.click()
    await flushPromises()

    const payload = wrapper.emitted('apply')!.at(-1)![0] as MetadataFieldPref[]
    expect(payload.find((f) => f.id === 'comment')!.visible).toBe(false)
    expect(payload.filter((f) => f.id !== 'comment').every((f) => f.visible)).toBe(true)
    wrapper.unmount()
  })

  it('disables the last visible toggle so fields can never all be hidden', async () => {
    const onlyArtist = IDS.map((id) => ({ id, visible: id === 'artist' }))
    const wrapper = await mountSuspended(MetadataFieldsDialog, {
      props: { open: true, fields: onlyArtist },
    })
    await flushPromises()

    expect((el('mfield-toggle-artist') as HTMLButtonElement).disabled).toBe(true)
    expect((el('mfield-toggle-album') as HTMLButtonElement).disabled).toBe(false)
    wrapper.unmount()
  })

  it('reorders fields (move down) and Apply emits the new order', async () => {
    const wrapper = await mountSuspended(MetadataFieldsDialog, {
      props: { open: true, fields: allVisible() },
    })
    await flushPromises()

    el('mfield-move-down-artist')!.click() // artist ↓ swaps with album
    await flushPromises()
    el('metadata-fields-apply')!.click()
    await flushPromises()

    const payload = wrapper.emitted('apply')!.at(-1)![0] as MetadataFieldPref[]
    expect(payload.map((f) => f.id).slice(0, 2)).toEqual(['album', 'artist'])
    wrapper.unmount()
  })

  it('Reset restores the canonical all-visible order', async () => {
    const scrambled: MetadataFieldPref[] = [
      { id: 'comment', visible: false },
      ...IDS.filter((id) => id !== 'comment').map((id) => ({ id, visible: true })),
    ]
    const wrapper = await mountSuspended(MetadataFieldsDialog, {
      props: { open: true, fields: scrambled },
    })
    await flushPromises()

    el('metadata-fields-reset')!.click()
    await flushPromises()
    el('metadata-fields-apply')!.click()
    await flushPromises()

    const payload = wrapper.emitted('apply')!.at(-1)![0] as MetadataFieldPref[]
    expect(payload.map((f) => f.id)).toEqual(IDS)
    expect(payload.every((f) => f.visible)).toBe(true)
    wrapper.unmount()
  })

  it('Cancel closes without committing', async () => {
    const wrapper = await mountSuspended(MetadataFieldsDialog, {
      props: { open: true, fields: allVisible() },
    })
    await flushPromises()

    el('mfield-toggle-album')!.click()
    await flushPromises()
    el('metadata-fields-cancel')!.click()
    await flushPromises()

    expect(wrapper.emitted('apply')).toBeFalsy()
    expect(wrapper.emitted('update:open')!.at(-1)![0]).toBe(false)
    wrapper.unmount()
  })
})
