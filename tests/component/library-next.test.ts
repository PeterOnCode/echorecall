import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { defineEventHandler, getQuery } from 'h3'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import LibraryNext from '~/pages/library-next.vue'

// 006 · US1 (FR-001/FR-005/FR-021) — the redesigned Library surface at /library-next:
// a resizable two-pane DashboardWorkspace (file table left, tag-editor inspector
// right). Selecting a row loads its tags into the inspector; with nothing selected
// the inspector shows its empty state; the show/hide-inspector control collapses and
// restores the inspector pane. The list endpoint is mocked at the HTTP boundary so
// this drives the real useLibrary + view-prefs composables.

const rows = [
  {
    id: 'a',
    text: 'Alpha source',
    voiceId: 'alloy',
    model: null,
    format: 'mp3',
    speed: null,
    createdAt: '2026-06-15T10:00:00.000Z',
    filename: 'alpha.mp3',
    audioUrl: '/api/generations/a/audio',
    metadata: { title: 'Alpha', artist: 'Zoe' },
  },
  {
    id: 'b',
    text: 'Bravo source',
    voiceId: 'echo',
    model: null,
    format: 'wav',
    speed: null,
    createdAt: '2026-06-16T10:00:00.000Z',
    filename: 'bravo.wav',
    audioUrl: '/api/generations/b/audio',
    metadata: { title: 'Bravo', artist: 'Yann' },
  },
]

registerEndpoint(
  '/api/generations',
  defineEventHandler((event) => {
    const q = getQuery(event)
    const page = Number(q.page ?? 1)
    const pageSize = Number(q.pageSize ?? 20)
    return { generations: rows, total: rows.length, page, pageSize }
  }),
)

async function mountPage() {
  const wrapper = await mountSuspended(LibraryNext)
  await flushPromises() // resolve onMounted load()
  return wrapper
}

describe('library-next page (US1)', () => {
  it('renders the two-pane workspace with the file table and inspector', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('[data-test="dashboard-workspace"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="library-file-table"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="tag-inspector"]').exists()).toBe(true)
  })

  it('shows the inspector empty state when nothing is selected (FR-005)', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('[data-test="tags-empty"]').exists()).toBe(true)
  })

  it('loads the clicked recording into the inspector', async () => {
    const wrapper = await mountPage()
    await wrapper.findAll('[data-test="library-row"]')[0]!.trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-test="tags-empty"]').exists()).toBe(false)
    // US5 — the inspector fields are now editable inputs bound to the staged draft.
    expect((wrapper.find('[data-test="field-title"]').element as HTMLInputElement).value).toContain('Alpha')
  })

  it('collapses and restores the inspector via the show/hide control (FR-021)', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('[data-test="tag-inspector"]').exists()).toBe(true)

    await wrapper.find('[data-test="toggle-inspector"]').trigger('click')
    expect(wrapper.find('[data-test="tag-inspector"]').exists()).toBe(false)

    // The control lives in the always-visible table, so it can restore the pane.
    await wrapper.find('[data-test="toggle-inspector"]').trigger('click')
    expect(wrapper.find('[data-test="tag-inspector"]').exists()).toBe(true)
  })
})
