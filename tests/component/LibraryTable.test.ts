import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LibraryTable from '~/components/library/LibraryTable.vue'
import type { LibraryItem } from '~/composables/useLibrary'
import type { LibraryQuery } from '#core/client'

// Component coverage for US5 (005 redesign / FR-014): LibraryTable is the Library
// *list pane* — a controlled, server-driven discovery table (the search bar sits
// above it, sort headers + pagination drive `query`, never client-sort). Selecting
// a row emits `selected-id` so the page loads that recording into the audio-tags
// detail pane; the old inline `#expanded` region (inline player + inline editor) is
// gone — playback and tag editing now live in the detail pane / waveform. The table
// never touches the network: it is driven purely by `items`, `total`, `query`.

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

const items: LibraryItem[] = [
  item({ id: 'a', filename: 'apple.mp3', metadata: { title: 'Apple' } }),
  item({ id: 'b', filename: 'banana.wav', voiceId: 'echo', format: 'wav', metadata: { title: 'Banana' } }),
]

function mountTable(query: LibraryQuery = {}, total = items.length, props: Record<string, unknown> = {}) {
  return mountSuspended(LibraryTable, { props: { items, total, query, ...props } })
}

/** The latest `update:query` payload emitted by the table. */
function lastQuery(wrapper: Awaited<ReturnType<typeof mountTable>>): LibraryQuery {
  const events = wrapper.emitted('update:query') as LibraryQuery[][] | undefined
  return events!.at(-1)![0]
}

describe('LibraryTable', () => {
  it('renders one row per item', async () => {
    const wrapper = await mountTable()
    expect(wrapper.findAll('[data-test="library-row"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('apple.mp3')
    expect(wrapper.text()).toContain('banana.wav')
  })

  it('shows an empty-state message and no rows when nothing matches', async () => {
    const wrapper = await mountSuspended(LibraryTable, { props: { items: [], total: 0, query: {} } })
    expect(wrapper.find('[data-test="library-row"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="library-empty"]').exists()).toBe(true)
  })

  it('a sortable header sets the sort column and toggles the order on repeat (server-driven)', async () => {
    const wrapper = await mountTable()
    await wrapper.find('[data-test="sort-title"]').trigger('click')
    expect(lastQuery(wrapper)).toMatchObject({ sort: 'title', order: 'asc', page: 1 })

    // The parent applies the new query; clicking the same column flips the order.
    await wrapper.setProps({ query: { sort: 'title', order: 'asc' } })
    await wrapper.find('[data-test="sort-title"]').trigger('click')
    expect(lastQuery(wrapper)).toMatchObject({ sort: 'title', order: 'desc' })
  })

  it('pagination drives the query and disables the controls at the bounds', async () => {
    // total 3 over pageSize 2 ⇒ two pages; page 1 ⇒ prev disabled.
    const wrapper = await mountTable({ page: 1, pageSize: 2 }, 3)
    expect(wrapper.find('[data-test="page-prev"]').attributes('disabled')).toBeDefined()

    await wrapper.find('[data-test="page-next"]').trigger('click')
    expect(lastQuery(wrapper).page).toBe(2)

    // On the last page, next is disabled.
    await wrapper.setProps({ query: { page: 2, pageSize: 2 } })
    expect(wrapper.find('[data-test="page-next"]').attributes('disabled')).toBeDefined()
  })

  it('selecting a row emits selected-id and marks the active row', async () => {
    const wrapper = await mountTable()
    const rows = wrapper.findAll('[data-test="library-row"]')
    await rows[1]!.trigger('click')

    const emitted = wrapper.emitted('update:selectedId') as (string | null)[][] | undefined
    expect(emitted!.at(-1)![0]).toBe('b')

    // Once the parent applies the selection, the active row reflects it.
    await wrapper.setProps({ selectedId: 'b' })
    expect(wrapper.findAll('[data-test="library-row"]')[1]!.attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('[data-test="library-row"]')[0]!.attributes('aria-pressed')).toBe('false')
  })

  it('no longer renders an inline player or inline editor (selection drives the detail pane)', async () => {
    const wrapper = await mountTable()
    await wrapper.findAll('[data-test="library-row"]')[0]!.trigger('click')
    await flushPromises()

    expect(wrapper.find('audio').exists()).toBe(false)
    expect(wrapper.find('[data-test="library-item-editor"]').exists()).toBe(false)
  })
})
