import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import QueuePanel from '~/components/generate/QueuePanel.vue'
import type { QueueItem } from '~/composables/useQueue'

// 007 · US1 (T007 / FR-018 host): the compact pending-queue list — each row shows a text
// preview + status + remove; an empty queue shows a placeholder. Replaces the 005
// two-pane QueueList. Per-item cost (US5) renders into queue-row-cost later.
function item(clientId: string, text: string, status: QueueItem['status'] = 'queued'): QueueItem {
  return { clientId, text, voiceId: 'alloy', model: 'gpt-4o-mini-tts', format: 'mp3', metadata: {}, status, source: 'text' }
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
})
