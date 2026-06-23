import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AudioTagsPanel from '~/components/library/AudioTagsPanel.vue'
import type { LibraryItem } from '~/composables/useLibrary'

// Component coverage for US5 (005 redesign / FR-014/FR-015): AudioTagsPanel is the
// Library *detail pane*. It embeds the existing LibraryItemEditor for the selected
// recording (reused, not duplicated) and adds prev/next navigation that moves the
// active recording without returning to the table — disabled at the bounds. With
// nothing selected it shows an empty state instead of the editor. Save/delete from
// the embedded editor are re-emitted to the page (which owns the network).

// The confirm-delete prompt is a UModal teleported to document.body, so its hooks
// are queried there, not inside the panel's own subtree.
function confirmOverlay(test: string): HTMLElement | null {
  return document.body.querySelector(`[data-test="${test}"]`)
}

function item(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: 'gen-1',
    text: 'Hello world',
    voiceId: 'alloy',
    model: 'gpt-4o-mini-tts',
    format: 'mp3',
    speed: 1,
    createdAt: '2026-06-18T08:00:00.000Z',
    filename: 'hello.mp3',
    metadata: { title: 'Hello', artist: 'Me' },
    audioUrl: '/api/generations/gen-1/audio',
    ...overrides,
  }
}

function mountPanel(props: Record<string, unknown> = {}) {
  return mountSuspended(AudioTagsPanel, {
    props: { item: item(), hasPrev: false, hasNext: false, ...props },
  })
}

describe('AudioTagsPanel', () => {
  it('loads the selected item tags into the embedded editor', async () => {
    const wrapper = await mountPanel()
    expect(wrapper.find('[data-test="library-item-editor"]').exists()).toBe(true)
    expect((wrapper.find('[data-test="meta-title"]').element as HTMLInputElement).value).toBe('Hello')
    expect((wrapper.find('[data-test="meta-artist"]').element as HTMLInputElement).value).toBe('Me')
  })

  it('shows the empty state and no editor when nothing is selected', async () => {
    const wrapper = await mountPanel({ item: null })
    expect(wrapper.find('[data-test="tags-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="library-item-editor"]').exists()).toBe(false)
  })

  it('prev/next emit navigation events and disable at the bounds', async () => {
    // At the first recording: prev disabled, next enabled.
    const wrapper = await mountPanel({ hasPrev: false, hasNext: true })
    expect(wrapper.find('[data-test="tags-prev"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-test="tags-next"]').attributes('disabled')).toBeUndefined()

    await wrapper.find('[data-test="tags-next"]').trigger('click')
    expect(wrapper.emitted('next')).toBeTruthy()

    // At the last recording: next disabled, prev enabled.
    await wrapper.setProps({ hasPrev: true, hasNext: false })
    expect(wrapper.find('[data-test="tags-next"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-test="tags-prev"]').attributes('disabled')).toBeUndefined()

    await wrapper.find('[data-test="tags-prev"]').trigger('click')
    expect(wrapper.emitted('prev')).toBeTruthy()
  })

  it('re-emits the embedded editor save with the edited filename + metadata', async () => {
    const wrapper = await mountPanel()
    await wrapper.find('[data-test="edit-filename"]').setValue('Renamed')
    await wrapper.find('[data-test="meta-title"]').setValue('New Title')
    await wrapper.find('[data-test="save-item"]').trigger('click')

    const saved = wrapper.emitted('save')?.at(-1)?.[0] as { filename: string; metadata: { title?: string } }
    expect(saved.filename).toBe('Renamed')
    expect(saved.metadata.title).toBe('New Title')
  })

  it('re-emits delete with the item id once the confirmation is accepted', async () => {
    const wrapper = await mountPanel()
    await wrapper.find('[data-test="delete-item"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('delete')).toBeFalsy()

    ;(confirmOverlay('confirm-ok') as HTMLElement).click()
    expect(wrapper.emitted('delete')?.at(-1)?.[0]).toBe('gen-1')
    wrapper.unmount()
  })
})
