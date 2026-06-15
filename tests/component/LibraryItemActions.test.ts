import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LibraryList from '~/components/LibraryList.vue'

// Manage actions on each library entry (US3): download a stored clip and delete
// it permanently behind a confirmation prompt (FR-014, FR-015). Download is a
// plain link to the audio route with `?download=1` (the server sends it as an
// attachment), so it needs no network logic here. Delete is destructive, so the
// list never deletes on its own — it asks via ConfirmDialog and, only on
// confirm, emits `delete` with the id for the page to carry out. Cancelling is a
// no-op. The component stays network-free and prop-driven.

type LibraryItem = {
  id: string
  text: string
  voiceId: string
  createdAt: string
  audioUrl: string
}

const items: LibraryItem[] = [
  {
    id: '1',
    text: 'First clip',
    voiceId: 'alloy',
    createdAt: '2026-06-15T11:00:00.000Z',
    audioUrl: '/api/generations/1/audio',
  },
  {
    id: '2',
    text: 'Second clip',
    voiceId: 'echo',
    createdAt: '2026-06-15T10:00:00.000Z',
    audioUrl: '/api/generations/2/audio',
  },
]

describe('LibraryList manage actions', () => {
  it('offers a download link to the entry audio with ?download=1', async () => {
    const wrapper = await mountSuspended(LibraryList, { props: { generations: items } })

    const link = wrapper.findAll('[data-test="download"]')[0]!
    expect(link.attributes('href')).toBe('/api/generations/1/audio?download=1')
    // The `download` attribute hints the browser to save rather than navigate.
    expect(link.attributes('download')).toBeDefined()
  })

  it('asks for confirmation before deleting and emits delete only on confirm', async () => {
    const wrapper = await mountSuspended(LibraryList, { props: { generations: items } })
    expect(wrapper.find('[data-test="confirm-dialog"]').exists()).toBe(false)

    await wrapper.findAll('[data-test="delete"]')[0]!.trigger('click')

    // Dialog opens; nothing deleted yet.
    expect(wrapper.find('[data-test="confirm-dialog"]').exists()).toBe(true)
    expect(wrapper.emitted('delete')).toBeFalsy()

    await wrapper.find('[data-test="confirm-ok"]').trigger('click')

    expect(wrapper.emitted('delete')![0]).toEqual(['1'])
    expect(wrapper.find('[data-test="confirm-dialog"]').exists()).toBe(false)
  })

  it('cancels without emitting delete', async () => {
    const wrapper = await mountSuspended(LibraryList, { props: { generations: items } })

    await wrapper.findAll('[data-test="delete"]')[0]!.trigger('click')
    await wrapper.find('[data-test="confirm-cancel"]').trigger('click')

    expect(wrapper.emitted('delete')).toBeFalsy()
    expect(wrapper.find('[data-test="confirm-dialog"]').exists()).toBe(false)
  })
})
