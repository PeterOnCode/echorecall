import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createError, defineEventHandler, getQuery } from 'h3'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import LibraryPage from '~/pages/library.vue'

// 006 · US1 (FR-001/FR-005/FR-021) — the redesigned Library surface at the canonical /library route:
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

// Count list loads so a test can assert the page reloads after a successful save.
let listCalls = 0
registerEndpoint(
  '/api/generations',
  defineEventHandler((event) => {
    listCalls++
    const q = getQuery(event)
    const page = Number(q.page ?? 1)
    const pageSize = Number(q.pageSize ?? 20)
    return { generations: rows, total: rows.length, page, pageSize }
  }),
)
// PATCH target for the first row's inspector Save (returns the updated item);
// DELETE succeeds. Row b's DELETE always fails, so bulk-delete partial-failure
// behaviour can be asserted (b stays selected, its draft is kept).
let deleteCalls: string[] = []
registerEndpoint(
  '/api/generations/a',
  defineEventHandler((event) => {
    if (event.method === 'DELETE') deleteCalls.push('a')
    return { ...rows[0], metadata: { ...rows[0]!.metadata } }
  }),
)
registerEndpoint(
  '/api/generations/b',
  defineEventHandler((event) => {
    if (event.method === 'DELETE') {
      deleteCalls.push('b')
      throw createError({ statusCode: 500, statusMessage: 'delete failed' })
    }
    return { ...rows[1], metadata: { ...rows[1]!.metadata } }
  }),
)

async function mountPage() {
  const wrapper = await mountSuspended(LibraryPage)
  await flushPromises() // resolve onMounted load()
  return wrapper
}

describe('library page (US1)', () => {
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

  it('reloads the query after a successful inspector save so filter/sort stay consistent', async () => {
    // A committed edit can change what the active filter/sort matches; without a reload
    // the row stays visible/misordered and total/page go stale until a later refresh.
    const wrapper = await mountPage()
    await wrapper.findAll('[data-test="library-row"]')[0]!.trigger('click')
    await flushPromises()
    listCalls = 0 // ignore the initial load
    await wrapper.find('[data-test="field-title"]').setValue('Changed Title')
    await wrapper.find('[data-test="inspector-save"]').trigger('click')
    await flushPromises()
    expect(listCalls).toBeGreaterThan(0)
  })

  it('bulk delete keeps failed ids selected and discards deleted recordings’ drafts', async () => {
    const wrapper = await mountPage()
    // Locale-independent baseline: the saved-state label before any edit.
    const savedText = wrapper.find('[data-test="status-save"]').text()

    // Stage an unsaved edit on row a so its draft is dirty (status bar: unsaved).
    await wrapper.findAll('[data-test="library-row"]')[0]!.trigger('click')
    await flushPromises()
    await wrapper.find('[data-test="field-title"]').setValue('Dirty edit')
    expect(wrapper.find('[data-test="status-save"]').text()).not.toBe(savedText)

    // Select both rows and bulk delete: a's DELETE succeeds, b's fails (500).
    deleteCalls = []
    await wrapper.find('[data-test="select-all"]').trigger('click')
    await wrapper.find('[data-test="bulk-delete"]').trigger('click')
    await flushPromises()
    // The confirm dialog teleports to <body>, outside the wrapper's subtree.
    expect(document.body.querySelector('[data-test="confirm-dialog"]')?.textContent).toContain('2')
    ;(document.body.querySelector('[data-test="confirm-ok"]') as HTMLElement).click()
    // The two DELETEs run sequentially (each its own macrotask round), so poll
    // rather than assume a single flushPromises settles the whole run.
    await vi.waitFor(() => expect(deleteCalls).toEqual(['a', 'b']))
    await flushPromises()

    // The failed id stays selected for retry (bulk-delete stays enabled)…
    expect(wrapper.find('[data-test="bulk-delete"]').attributes('disabled')).toBeUndefined()
    // …and the deleted recording's dirty draft is discarded, so no phantom
    // "unsaved" state survives a deletion (its edits can never be committed).
    expect(wrapper.find('[data-test="status-save"]').text()).toBe(savedText)
  })
})
