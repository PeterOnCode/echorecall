import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LibraryTable from '~/components/library/LibraryTable.vue'
import type { LibraryItem } from '~/composables/useLibrary'
import type { LibraryQuery } from '#core/client'

// Component coverage for US6 (FR-034–036): LibraryTable is the controlled
// discovery surface — a search/filter bar, sortable column headers, and
// pagination that all drive a single `query` (v-model:query, props down / events
// up; the page owns the network call). It renders an empty-state message when no
// rows match. It never touches the network: it is driven purely by `items`,
// `total`, and `query`.

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

  it('search input drives the query', async () => {
    const wrapper = await mountTable()
    await wrapper.find('[data-test="library-search"]').setValue('banana')
    expect(lastQuery(wrapper).q).toBe('banana')
  })

  it('voice filter drives the query', async () => {
    const wrapper = await mountTable()
    await wrapper.find('[data-test="filter-voice"]').setValue('echo')
    expect(lastQuery(wrapper).voiceId).toBe('echo')
  })

  it('format filter drives the query', async () => {
    const wrapper = await mountTable()
    await wrapper.find('[data-test="filter-format"]').setValue('wav')
    expect(lastQuery(wrapper).format).toBe('wav')
  })

  it('a sortable header sets the sort column and toggles the order on repeat', async () => {
    const wrapper = await mountTable()
    await wrapper.find('[data-test="sort-title"]').trigger('click')
    expect(lastQuery(wrapper)).toMatchObject({ sort: 'title', order: 'asc' })

    // The parent applies the new query; clicking the same column flips the order.
    await wrapper.setProps({ query: { sort: 'title', order: 'asc' } })
    await wrapper.find('[data-test="sort-title"]').trigger('click')
    expect(lastQuery(wrapper)).toMatchObject({ sort: 'title', order: 'desc' })
  })

  it('pagination drives the query and resets to page 1 on a search change', async () => {
    // total 3 over pageSize 2 ⇒ two pages.
    const wrapper = await mountTable({ page: 1, pageSize: 2 }, 3)
    await wrapper.find('[data-test="page-next"]').trigger('click')
    expect(lastQuery(wrapper).page).toBe(2)

    await wrapper.setProps({ query: { page: 2, pageSize: 2 } })
    await wrapper.find('[data-test="library-search"]').setValue('apple')
    // Changing the search returns to the first page so results aren't hidden.
    expect(lastQuery(wrapper)).toMatchObject({ q: 'apple', page: 1 })
  })
})
