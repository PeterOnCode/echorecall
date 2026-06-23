import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import QueueList from '~/components/generate/QueueList.vue'
import type { QueueItem } from '~/composables/useQueue'

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
