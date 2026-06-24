import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import QueueList from '~/components/generate/QueueList.vue'
import type { QueueColumnId } from '~/composables/useViewPreferences'
import type { QueueItem } from '~/composables/useQueue'

function allColumns(): Record<QueueColumnId, boolean> {
  return { source: true, voice: true, format: true, recordedAt: true, language: true, status: true }
}

// Component coverage for the 005 redesign list pane (US1 / FR-001/003): the queue
// renders as a selectable table — one row per item — and clicking a row sets the
// active id (v-model:active-id) so the detail pane loads that item. The previous
// inline per-row editor moves to the detail pane (QueueItemEditor); editing is
// covered there. Here we assert rows render, selection drives `active-id`, and the
// empty queue shows its placeholder instead of a table.

function item(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    clientId: 'c1',
    text: 'Hello',
    voiceId: 'alloy',
    model: 'tts-1',
    format: 'mp3',
    metadata: {},
    status: 'queued',
    source: 'text',
    ...overrides,
  }
}

describe('QueueList (list pane)', () => {
  it('renders one row per queue item in a table', async () => {
    const wrapper = await mountSuspended(QueueList, {
      props: { items: [item({ clientId: 'a', text: 'Alpha' }), item({ clientId: 'b', text: 'Bravo' })] },
    })

    expect(wrapper.find('[data-test="queue-table"]').exists()).toBe(true)
    const rows = wrapper.findAll('[data-test="queue-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Alpha')
    expect(rows[1]!.text()).toContain('Bravo')
  })

  it('shows the empty placeholder (and no table) when there are no items', async () => {
    const wrapper = await mountSuspended(QueueList, { props: { items: [] } })

    expect(wrapper.find('[data-test="queue-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="queue-table"]').exists()).toBe(false)
  })

  it('clicking a row sets the active id so the detail pane can load it', async () => {
    const wrapper = await mountSuspended(QueueList, {
      props: {
        items: [item({ clientId: 'a', text: 'Alpha' }), item({ clientId: 'b', text: 'Bravo' })],
        activeId: null,
      },
    })

    await wrapper.findAll('[data-test="queue-row"]')[1]!.trigger('click')

    const emitted = wrapper.emitted('update:activeId')
    expect(emitted).toBeTruthy()
    expect(emitted!.at(-1)![0]).toBe('b')
  })

  it('marks the active row as pressed for assistive technology', async () => {
    const wrapper = await mountSuspended(QueueList, {
      props: { items: [item({ clientId: 'a' }), item({ clientId: 'b' })], activeId: 'a' },
    })

    // The row is a toggle button, so it exposes its active state via aria-pressed
    // (aria-selected is not a valid state for role="button").
    const rows = wrapper.findAll('[data-test="queue-row"]')
    expect(rows[0]!.attributes('aria-pressed')).toBe('true')
    expect(rows[1]!.attributes('aria-pressed')).toBe('false')
  })

  it('shows each row’s live generation status', async () => {
    const wrapper = await mountSuspended(QueueList, {
      props: { items: [item({ clientId: 'a', status: 'done' }), item({ clientId: 'b', status: 'failed' })] },
    })

    const statuses = wrapper.findAll('[data-test="item-status"]').map((s) => s.text())
    expect(statuses[0]).toMatch(/done/i)
    expect(statuses[1]).toMatch(/fail/i)
  })
})

describe('QueueList (curation – US3)', () => {
  it('emits the search term as the user types (v-model:search)', async () => {
    const wrapper = await mountSuspended(QueueList, {
      props: { items: [item()], visibleColumns: allColumns() },
    })
    await wrapper.find('[data-test="queue-search"]').setValue('hello')
    const emitted = wrapper.emitted('update:search')
    expect(emitted).toBeTruthy()
    expect(emitted!.at(-1)![0]).toBe('hello')
  })

  it('shows the source as the filename for uploads and a label for typed text', async () => {
    const wrapper = await mountSuspended(QueueList, {
      props: {
        items: [
          item({ clientId: 'u', source: 'upload', sourceName: 'notes.txt' }),
          item({ clientId: 't', source: 'text' }),
        ],
        visibleColumns: allColumns(),
      },
    })
    const sources = wrapper.findAll('[data-test="queue-row-source"]')
    expect(sources[0]!.text()).toContain('notes.txt')
    expect(sources[1]!.text()).not.toContain('notes.txt')
    expect(sources[1]!.text().trim().length).toBeGreaterThan(0)
  })

  it('row and header checkboxes drive checked-ids', async () => {
    const wrapper = await mountSuspended(QueueList, {
      props: {
        items: [item({ clientId: 'a' }), item({ clientId: 'b' })],
        checkedIds: new Set<string>(),
        visibleColumns: allColumns(),
      },
    })

    await wrapper.findAll('[data-test="queue-row-checkbox"]')[0]!.trigger('click')
    let emitted = wrapper.emitted('update:checkedIds')
    expect(emitted).toBeTruthy()
    expect([...(emitted!.at(-1)![0] as Set<string>)]).toEqual(['a'])

    await wrapper.find('[data-test="queue-select-all"]').trigger('click')
    emitted = wrapper.emitted('update:checkedIds')
    expect([...(emitted!.at(-1)![0] as Set<string>)].sort()).toEqual(['a', 'b'])
  })

  it('exposes the selection checkboxes to assistive tech (FR-020)', async () => {
    // FR-020: the leading select column is keyboard/AT-operable — the header
    // select-all and each row toggle render as role="checkbox" with a non-empty
    // accessible name, so a screen reader announces what each checkbox controls.
    const wrapper = await mountSuspended(QueueList, {
      props: {
        items: [item({ clientId: 'a' }), item({ clientId: 'b' })],
        checkedIds: new Set<string>(),
        visibleColumns: allColumns(),
      },
    })

    const selectAll = wrapper.find('[data-test="queue-select-all"]').element
    expect(selectAll.getAttribute('role')).toBe('checkbox')
    expect((selectAll.getAttribute('aria-label') ?? '').length).toBeGreaterThan(0)

    const rowBox = wrapper.find('[data-test="queue-row-checkbox"]').element
    expect(rowBox.getAttribute('role')).toBe('checkbox')
    expect((rowBox.getAttribute('aria-label') ?? '').length).toBeGreaterThan(0)
  })

  it('requests the column dialog from the columns button', async () => {
    const wrapper = await mountSuspended(QueueList, {
      props: { items: [item()], visibleColumns: allColumns() },
    })
    await wrapper.find('[data-test="queue-columns-button"]').trigger('click')
    expect(wrapper.emitted('open-columns')).toBeTruthy()
  })

  it('deletes the checked rows only after confirmation', async () => {
    const wrapper = await mountSuspended(QueueList, {
      props: {
        items: [item({ clientId: 'a' }), item({ clientId: 'b' })],
        checkedIds: new Set<string>(['a']),
        visibleColumns: allColumns(),
      },
    })

    await wrapper.find('[data-test="queue-delete-selected"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('delete-selected')).toBeFalsy() // not until confirmed

    // ConfirmDialog teleports to document.body.
    ;(document.body.querySelector('[data-test="confirm-ok"]') as HTMLElement).click()
    await flushPromises()
    expect(wrapper.emitted('delete-selected')).toBeTruthy()
    wrapper.unmount()
  })

  it('omits a column when visibleColumns turns it off', async () => {
    const wrapper = await mountSuspended(QueueList, {
      props: { items: [item()], visibleColumns: { ...allColumns(), voice: false } },
    })
    expect(wrapper.find('[data-test="queue-col-voice"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="queue-col-status"]').exists()).toBe(true)
  })
})
