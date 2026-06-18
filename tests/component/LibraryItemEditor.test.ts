import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LibraryItemEditor from '~/components/library/LibraryItemEditor.vue'
import type { LibraryItem } from '~/composables/useLibrary'

// Component coverage for US5 (FR-030/031): the library item editor shows the
// current filename (base editable, extension fixed) plus the full metadata set,
// emits a `save` patch with the edited filename + metadata, and never deletes on
// its own — Delete opens a confirmation and only emits `delete` once confirmed.
// The component is controlled (props down, events up); the page owns the network
// calls (useLibrary.rename / updateMetadata / remove).

function baseItem(overrides: Partial<LibraryItem> = {}): LibraryItem {
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

function mountEditor(item: LibraryItem = baseItem()) {
  return mountSuspended(LibraryItemEditor, { props: { item } })
}

describe('LibraryItemEditor', () => {
  it('shows the current filename (base editable, extension fixed) and metadata', async () => {
    const wrapper = await mountEditor()

    expect((wrapper.find('[data-test="edit-filename"]').element as HTMLInputElement).value).toBe('hello')
    // The extension is shown but not part of the editable field.
    expect(wrapper.find('[data-test="filename-ext"]').text()).toContain('mp3')
    expect(wrapper.find('[data-test="edit-filename"]').exists()).toBe(true)
    // Full metadata editor is present and pre-filled.
    expect((wrapper.find('[data-test="meta-title"]').element as HTMLInputElement).value).toBe('Hello')
    expect((wrapper.find('[data-test="meta-artist"]').element as HTMLInputElement).value).toBe('Me')
  })

  it('emits a save patch with the edited filename and metadata', async () => {
    const wrapper = await mountEditor()

    await wrapper.find('[data-test="edit-filename"]').setValue('A New Name')
    await wrapper.find('[data-test="meta-title"]').setValue('New Title')
    await wrapper.find('[data-test="save-item"]').trigger('click')

    const saved = wrapper.emitted('save')?.at(-1)?.[0] as { filename: string; metadata: { title?: string } }
    expect(saved.filename).toBe('A New Name')
    expect(saved.metadata.title).toBe('New Title')
  })

  it('requires confirmation before emitting delete', async () => {
    const wrapper = await mountEditor()

    await wrapper.find('[data-test="delete-item"]').trigger('click')
    // The confirmation prompt is shown; nothing deleted yet.
    expect(wrapper.find('[data-test="confirm-dialog"]').exists()).toBe(true)
    expect(wrapper.emitted('delete')).toBeFalsy()

    await wrapper.find('[data-test="confirm-ok"]').trigger('click')
    expect(wrapper.emitted('delete')?.at(-1)?.[0]).toBe('gen-1')
  })

  it('cancelling the confirmation does not delete', async () => {
    const wrapper = await mountEditor()

    await wrapper.find('[data-test="delete-item"]').trigger('click')
    await wrapper.find('[data-test="confirm-cancel"]').trigger('click')

    expect(wrapper.emitted('delete')).toBeFalsy()
    expect(wrapper.find('[data-test="confirm-dialog"]').exists()).toBe(false)
  })
})
