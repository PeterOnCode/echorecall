import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LibraryTable from '~/components/library/LibraryTable.vue'
import type { LibraryItem } from '~/composables/useLibrary'

// Row actions on each library entry (005 redesign / US5): download is a plain link
// to the audio route with `?download=1` (the server sends it as an attachment). In
// the redesign, playback and tag editing moved out of the row into the waveform /
// audio-tags detail pane, so the table no longer has an inline replay or editor —
// only this download affordance remains. The table is network-free and prop-driven.

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
    metadata: { title: 'Hello' },
    audioUrl: '/api/generations/gen-1/audio',
    ...overrides,
  }
}

const items: LibraryItem[] = [item({ id: '1', audioUrl: '/api/generations/1/audio' })]

function mountTable() {
  return mountSuspended(LibraryTable, { props: { items, total: items.length, query: {} } })
}

describe('LibraryTable row actions', () => {
  it('offers a download link to the entry audio with ?download=1', async () => {
    const wrapper = await mountTable()
    const link = wrapper.findAll('[data-test="download"]')[0]!
    expect(link.attributes('href')).toBe('/api/generations/1/audio?download=1')
    // The `download` attribute hints the browser to save rather than navigate.
    expect(link.attributes('download')).toBeDefined()
  })

  it('no longer renders an inline player or editor in the row', async () => {
    const wrapper = await mountTable()
    expect(wrapper.find('[data-test="replay"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="edit-item"]').exists()).toBe(false)
    expect(wrapper.find('audio').exists()).toBe(false)
    expect(wrapper.find('[data-test="library-item-editor"]').exists()).toBe(false)
  })
})
