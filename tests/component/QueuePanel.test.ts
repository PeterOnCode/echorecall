import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import QueuePanel from '~/components/generate/QueuePanel.vue'
import type { QueueCost, QueueItem } from '~/composables/useQueue'
import type { CostEstimate } from '#core/client'

// 007 · US1 (T007 / FR-018 host): the compact pending-queue list — each row shows a text
// preview + status + remove; an empty queue shows a placeholder. Replaces the 005
// two-pane QueueList. US5 (T038): a per-item cost renders into queue-row-cost — a dollar
// amount for estimable models, an "unavailable" label for the token-priced model.
function item(clientId: string, text: string, status: QueueItem['status'] = 'queued'): QueueItem {
  return { clientId, text, voiceId: 'alloy', model: 'gpt-4o-mini-tts', format: 'mp3', metadata: {}, status, source: 'text' }
}

function cost(entries: Record<string, CostEstimate>): QueueCost {
  const perItem = new Map<string, CostEstimate>(Object.entries(entries))
  let totalUsd = 0
  let unavailableCount = 0
  for (const est of perItem.values()) {
    if (est === 'unavailable') unavailableCount++
    else totalUsd += est.amountUsd
  }
  return { perItem, totalUsd, unavailableCount }
}

describe('QueuePanel', () => {
  it('renders one row per queued item with a status', async () => {
    const items = [item('a', 'first'), item('b', 'second', 'done')]
    const wrapper = await mountSuspended(QueuePanel, { props: { items } })
    expect(wrapper.find('[data-test="queue-panel"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-test="queue-row"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-test="queue-row-status"]')).toHaveLength(2)
  })

  it('shows an empty state when there are no items', async () => {
    const wrapper = await mountSuspended(QueuePanel, { props: { items: [] } })
    expect(wrapper.find('[data-test="queue-empty"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-test="queue-row"]')).toHaveLength(0)
  })

  it('emits remove with the row clientId', async () => {
    const wrapper = await mountSuspended(QueuePanel, { props: { items: [item('a', 'first')] } })
    await wrapper.find('[data-test="remove-item"]').trigger('click')
    expect(wrapper.emitted('remove')?.at(-1)?.[0]).toBe('a')
  })

  it('renders a per-item cost: a dollar amount for estimable models', async () => {
    const items = [item('a', 'hello')]
    const wrapper = await mountSuspended(QueuePanel, {
      props: { items, cost: cost({ a: { amountUsd: 0.0075 } }) },
    })
    const rowCost = wrapper.find('[data-test="queue-row-cost"]')
    expect(rowCost.exists()).toBe(true)
    expect(rowCost.text()).toMatch(/\d/) // a formatted amount, not empty
  })

  it('renders an "unavailable" label for the token-priced model', async () => {
    const items = [item('a', 'hello')]
    const wrapper = await mountSuspended(QueuePanel, {
      props: { items, cost: cost({ a: 'unavailable' }) },
    })
    const rowCost = wrapper.find('[data-test="queue-row-cost"]')
    expect(rowCost.exists()).toBe(true)
    expect(rowCost.text().toLowerCase()).not.toMatch(/\$?0/) // not a dollar figure
    expect(rowCost.text().length).toBeGreaterThan(0)
  })
})

// Selection + bulk actions: a per-row checkbox drives selection, a select-all toggles
// them together, "Delete selected" acts on the checked rows (disabled with none checked),
// and "Clear queue" empties the whole queue. State is owned by the page (useQueue's
// checkedIds); the panel is controlled via `selectedIds` and emits the intents.
describe('QueuePanel selection + bulk actions', () => {
  const items = [item('a', 'first'), item('b', 'second'), item('c', 'third')]

  it('renders a checkbox per row plus a select-all', async () => {
    const wrapper = await mountSuspended(QueuePanel, { props: { items } })
    expect(wrapper.find('[data-test="queue-select-all"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-test="queue-row-checkbox"]')).toHaveLength(3)
  })

  it('emits toggle with the row clientId when a row checkbox is clicked', async () => {
    const wrapper = await mountSuspended(QueuePanel, { props: { items } })
    await wrapper.findAll('[data-test="queue-row-checkbox"]')[1]!.trigger('click')
    expect(wrapper.emitted('toggle')?.at(-1)?.[0]).toBe('b')
  })

  it('emits toggle-all from the select-all checkbox', async () => {
    const wrapper = await mountSuspended(QueuePanel, { props: { items } })
    await wrapper.find('[data-test="queue-select-all"]').trigger('click')
    expect(wrapper.emitted('toggle-all')).toBeTruthy()
  })

  it('reflects selectedIds on the row checkboxes', async () => {
    const wrapper = await mountSuspended(QueuePanel, {
      props: { items, selectedIds: new Set(['b']) },
    })
    const boxes = wrapper.findAll('[data-test="queue-row-checkbox"]')
    expect(boxes[0]!.attributes('aria-checked')).toBe('false')
    expect(boxes[1]!.attributes('aria-checked')).toBe('true')
  })

  it('disables Delete selected when nothing is selected, enables it otherwise', async () => {
    const none = await mountSuspended(QueuePanel, { props: { items } })
    expect((none.find('[data-test="queue-delete-selected"]').element as HTMLButtonElement).disabled).toBe(true)

    const some = await mountSuspended(QueuePanel, { props: { items, selectedIds: new Set(['a', 'c']) } })
    const del = some.find('[data-test="queue-delete-selected"]')
    expect((del.element as HTMLButtonElement).disabled).toBe(false)
    expect(del.text()).toContain('2') // count of selected
    await del.trigger('click')
    expect(some.emitted('delete-selected')).toBeTruthy()
  })

  it('emits clear from the Clear queue button', async () => {
    const wrapper = await mountSuspended(QueuePanel, { props: { items } })
    await wrapper.find('[data-test="queue-clear"]').trigger('click')
    expect(wrapper.emitted('clear')).toBeTruthy()
  })

  it('shows no bulk toolbar when the queue is empty', async () => {
    const wrapper = await mountSuspended(QueuePanel, { props: { items: [] } })
    expect(wrapper.find('[data-test="queue-select-all"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="queue-clear"]').exists()).toBe(false)
  })
})
