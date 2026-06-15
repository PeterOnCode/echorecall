import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LibraryList from '~/components/LibraryList.vue'

// LibraryList renders the persisted library (newest-first ordering is the
// server's job) and lets the user replay a stored clip in place. Replay reuses
// AudioPlayer over the entry's `audioUrl`, which serves the saved MP3 with no
// provider call (SC-003) — so this component never touches the network and is
// driven purely by its `generations` prop.

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

describe('LibraryList', () => {
  it('shows an empty-state message and no player when there are no generations', async () => {
    const wrapper = await mountSuspended(LibraryList, { props: { generations: [] } })

    expect(wrapper.text()).toMatch(/no generations/i)
    expect(wrapper.find('audio').exists()).toBe(false)
  })

  it('renders one entry per generation', async () => {
    const wrapper = await mountSuspended(LibraryList, { props: { generations: items } })

    expect(wrapper.findAll('[data-test="library-item"]')).toHaveLength(items.length)
    expect(wrapper.text()).toContain('First clip')
    expect(wrapper.text()).toContain('Second clip')
  })

  it('replays an entry by rendering an AudioPlayer for its audioUrl', async () => {
    const wrapper = await mountSuspended(LibraryList, { props: { generations: items } })

    expect(wrapper.find('audio').exists()).toBe(false)

    await wrapper.findAll('[data-test="replay"]')[0]!.trigger('click')

    const audio = wrapper.find('audio')
    expect(audio.exists()).toBe(true)
    expect(audio.attributes('src')).toBe('/api/generations/1/audio')
  })
})
