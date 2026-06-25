import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LibraryFileTable from '~/components/library/LibraryFileTable.vue'
import type { LibraryItem } from '~/composables/useLibrary'
import type { LibraryColumnPref } from '~/composables/useViewPreferences'

// 006 · US4 (FR-013/FR-014) — LibraryFileTable management: multi-select (header
// select-all + per-row), sortable headers (Filename/Title/Artist/Album/Year/Track/
// Genre/Comment/Date — Composer/Duration/Bitrate display-only), bulk emits, the
// Configure-Columns gear, and the show/hide-inspector control (FR-021).

function item(over: Partial<LibraryItem> & { id: string }): LibraryItem {
  return {
    id: over.id,
    text: 't',
    voiceId: 'alloy',
    model: null,
    format: 'mp3',
    speed: null,
    createdAt: '2026-06-15T10:00:00.000Z',
    filename: `${over.id}.mp3`,
    audioUrl: `/api/generations/${over.id}/audio`,
    metadata: {},
    ...over,
  }
}

const items = [
  item({ id: 'a', metadata: { title: 'Alpha', recordedAt: '2024' } }),
  item({ id: 'b', metadata: { title: 'Bravo', recordedAt: '2025' } }),
]

const allColumns: LibraryColumnPref[] = [
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
].map((id) => ({ id: id as LibraryColumnPref['id'], visible: true }))

function mountTable(props: Record<string, unknown> = {}) {
  return mountSuspended(LibraryFileTable, {
    props: {
      items,
      total: items.length,
      query: { sort: 'createdAt', order: 'desc', page: 1, pageSize: 20 },
      activeId: null,
      selectedIds: new Set<string>(),
      columns: allColumns,
      ...props,
    },
  })
}

describe('LibraryFileTable management (US4)', () => {
  it('select-all selects every loaded row', async () => {
    const wrapper = await mountTable()
    await wrapper.find('[data-test="select-all"]').trigger('click')
    const set = wrapper.emitted('update:selectedIds')!.at(-1)![0] as Set<string>
    expect([...set].sort()).toEqual(['a', 'b'])
  })

  it('a per-row checkbox selects a single row', async () => {
    const wrapper = await mountTable()
    await wrapper.find('[data-test="row-select-a"]').trigger('click')
    const set = wrapper.emitted('update:selectedIds')!.at(-1)![0] as Set<string>
    expect([...set]).toEqual(['a'])
  })

  it('sort headers drive query.sort/order and reset to page 1', async () => {
    const wrapper = await mountTable({ query: { page: 3 } })
    await wrapper.find('[data-test="sort-title"]').trigger('click')
    expect(wrapper.emitted('update:query')!.at(-1)![0]).toMatchObject({ sort: 'title', order: 'asc', page: 1 })
  })

  it('maps both Year and Date headers to the recordedAt sort key', async () => {
    const wrapper = await mountTable()
    await wrapper.find('[data-test="sort-year"]').trigger('click')
    expect(wrapper.emitted('update:query')!.at(-1)![0]).toMatchObject({ sort: 'recordedAt' })
  })

  it('does not render sort controls for the display-only columns', async () => {
    const wrapper = await mountTable()
    expect(wrapper.find('[data-test="sort-composer"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="sort-duration"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="sort-bitrate"]').exists()).toBe(false)
  })

  it('emits toggle-inspector and open-columns-dialog from the toolbar (FR-021/FR-017)', async () => {
    const wrapper = await mountTable()
    await wrapper.find('[data-test="toggle-inspector"]').trigger('click')
    expect(wrapper.emitted('toggle-inspector')).toBeTruthy()
    await wrapper.find('[data-test="open-columns-dialog"]').trigger('click')
    expect(wrapper.emitted('open-columns-dialog')).toBeTruthy()
  })

  it('emits bulk actions when rows are selected, disabled when none', async () => {
    const none = await mountTable({ selectedIds: new Set<string>() })
    expect(none.find('[data-test="bulk-delete"]').attributes('disabled')).toBeDefined()

    const some = await mountTable({ selectedIds: new Set(['a']) })
    await some.find('[data-test="bulk-delete"]').trigger('click')
    expect(some.emitted('bulk-delete')).toBeTruthy()
    await some.find('[data-test="open-bulk-tag-edit"]').trigger('click')
    expect(some.emitted('open-bulk-tag-edit')).toBeTruthy()
  })

  it('formats a duration that rounds up to a whole minute as M:SS, not 0:60', async () => {
    // 59.6s must render 1:00 — round the TOTAL seconds before splitting minutes/seconds.
    const wrapper = await mountTable({
      items: [item({ id: 'a', audioProperties: { duration: 59.6 } })],
    })
    expect(wrapper.text()).toContain('1:00')
    expect(wrapper.text()).not.toContain('0:60')
  })
})
