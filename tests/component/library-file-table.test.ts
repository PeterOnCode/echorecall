import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LibraryFileTable from '~/components/library/LibraryFileTable.vue'
import type { LibraryItem } from '~/composables/useLibrary'

// 006 · US1 (FR-005/FR-013) — the redesigned Library file table (forks LibraryTable).
// US1 scope: render the base columns (Filename always-on + Title/Artist/Album/Year/
// Track/Genre), select a row on click (v-model:active-id) with a highlight, and a
// show/hide-inspector control. Multi-select / sort headers / Configure Columns / bulk
// arrive in US4; this asserts only the US1 selection + always-on filename contract.

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
  item({ id: 'a', filename: 'aaa.mp3', metadata: { title: 'Alpha', artist: 'Zoe' } }),
  item({ id: 'b', filename: 'bbb.mp3', metadata: { title: 'Bravo', artist: 'Yann' } }),
]

function mountTable(props: Record<string, unknown> = {}) {
  return mountSuspended(LibraryFileTable, {
    props: {
      items,
      total: items.length,
      query: { sort: 'createdAt', order: 'desc', page: 1, pageSize: 20 },
      activeId: null,
      ...props,
    },
  })
}

describe('LibraryFileTable (US1)', () => {
  it('always shows the filename for every row', async () => {
    const wrapper = await mountTable()
    expect(wrapper.text()).toContain('aaa.mp3')
    expect(wrapper.text()).toContain('bbb.mp3')
  })

  it('selects a row on click → updates active-id', async () => {
    const wrapper = await mountTable()
    await wrapper.findAll('[data-test="library-row"]')[0]!.trigger('click')
    expect(wrapper.emitted('update:activeId')?.at(-1)?.[0]).toBe('a')
  })

  it('highlights the active row (aria-pressed)', async () => {
    const wrapper = await mountTable({ activeId: 'a' })
    const rows = wrapper.findAll('[data-test="library-row"]')
    expect(rows[0]!.attributes('aria-pressed')).toBe('true')
    expect(rows[1]!.attributes('aria-pressed')).toBe('false')
  })

  it('emits toggle-inspector from the show/hide control (FR-021)', async () => {
    const wrapper = await mountTable()
    await wrapper.find('[data-test="toggle-inspector"]').trigger('click')
    expect(wrapper.emitted('toggle-inspector')).toBeTruthy()
  })
})
