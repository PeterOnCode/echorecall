import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LibraryTable from '~/components/library/LibraryTable.vue'
import type { LibraryItem } from '~/composables/useLibrary'
import type { LibraryQuery } from '#core/client'

// Component coverage for US6 (FR-034-036, FR-010): LibraryTable is the controlled
// discovery surface, now built on UTable. Sort headers are server-driven (they
// drive `query`, never client-sort); replay/edit open a single per-row #expanded
// region (mutually exclusive); pagination disables at the bounds. Voice/format/
// date-range filtering lives in LibrarySearchBar (covered by its own spec). The
// table never touches the network: it is driven purely by `items`, `total`, `query`.

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

  it('replay opens an AudioPlayer in the expanded row; edit swaps it for the editor (mutually exclusive)', async () => {
    const wrapper = await mountTable()
    expect(wrapper.find('audio').exists()).toBe(false)

    // Replay the first row → player appears in the expanded region.
    await wrapper.findAll('[data-test="replay"]')[0]!.trigger('click')
    await flushPromises()
    expect(wrapper.find('audio').exists()).toBe(true)
    expect(wrapper.find('[data-test="library-item-editor"]').exists()).toBe(false)

    // Edit the same row → editor replaces the player (one mode per row).
    await wrapper.findAll('[data-test="edit-item"]')[0]!.trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="library-item-editor"]').exists()).toBe(true)
    expect(wrapper.find('audio').exists()).toBe(false)
  })

  it('a row whose audio fails to load shows unavailable and disables replay', async () => {
    const wrapper = await mountTable()
    await wrapper.findAll('[data-test="replay"]')[0]!.trigger('click')
    await flushPromises()

    // The AudioPlayer reports a load error → the row is marked unavailable.
    await wrapper.find('audio').trigger('error')
    await flushPromises()

    expect(wrapper.find('[data-test="row-unavailable"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-test="replay"]')[0]!.attributes('disabled')).toBeDefined()
  })
})
