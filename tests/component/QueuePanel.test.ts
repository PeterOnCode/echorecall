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
