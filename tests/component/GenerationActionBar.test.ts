import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import GenerationActionBar from '~/components/generate/GenerationActionBar.vue'

// 007 · US1 (T006 / FR-007): the generation action bar — a queue summary + count badge
// and Save queue / Load queue / Upload .txt batch / Generate. Generate is disabled when
// the queue is empty or a run is in flight. Cost total (US5) fills the optional props.
describe('GenerationActionBar', () => {
  it('renders the bar, count badge and four actions', async () => {
    const wrapper = await mountSuspended(GenerationActionBar, { props: { queueCount: 3 } })
    for (const id of ['action-bar', 'queue-count-badge', 'action-save-queue', 'action-load-queue', 'action-upload-txt', 'action-generate']) {
      expect(wrapper.find(`[data-test="${id}"]`).exists(), id).toBe(true)
    }
    expect(wrapper.find('[data-test="queue-count-badge"]').text()).toContain('3')
  })

  it('disables Generate when the queue is empty', async () => {
    const wrapper = await mountSuspended(GenerationActionBar, { props: { queueCount: 0 } })
    expect((wrapper.find('[data-test="action-generate"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('disables Generate while a run is in flight', async () => {
    const wrapper = await mountSuspended(GenerationActionBar, { props: { queueCount: 2, busy: true } })
    expect((wrapper.find('[data-test="action-generate"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('emits its actions on click', async () => {
    const wrapper = await mountSuspended(GenerationActionBar, { props: { queueCount: 2 } })
    await wrapper.find('[data-test="action-save-queue"]').trigger('click')
    await wrapper.find('[data-test="action-load-queue"]').trigger('click')
    await wrapper.find('[data-test="action-upload-txt"]').trigger('click')
    await wrapper.find('[data-test="action-generate"]').trigger('click')
    expect(wrapper.emitted('save-queue')).toBeTruthy()
    expect(wrapper.emitted('load-queue')).toBeTruthy()
    expect(wrapper.emitted('upload-txt')).toBeTruthy()
    expect(wrapper.emitted('generate')).toBeTruthy()
  })

  // US5 (T038 / FR-018/FR-019): the queue total cost + "+N unavailable" note.
  it('shows the queue total cost', async () => {
    const wrapper = await mountSuspended(GenerationActionBar, {
      props: { queueCount: 2, totalUsd: 0.0105 },
    })
    const total = wrapper.find('[data-test="queue-total-cost"]')
    expect(total.exists()).toBe(true)
    expect(total.text()).toMatch(/\d/)
  })

  it('shows a "+N unavailable" note only when some items are unavailable', async () => {
    const none = await mountSuspended(GenerationActionBar, {
      props: { queueCount: 2, unavailableCount: 0 },
    })
    expect(none.find('[data-test="queue-unavailable-note"]').exists()).toBe(false)

    const some = await mountSuspended(GenerationActionBar, {
      props: { queueCount: 3, unavailableCount: 2 },
    })
    const note = some.find('[data-test="queue-unavailable-note"]')
    expect(note.exists()).toBe(true)
    expect(note.text()).toContain('2')
  })

  it('never blocks Generate on the estimate state (only empty/busy disable it)', async () => {
    const wrapper = await mountSuspended(GenerationActionBar, {
      props: { queueCount: 2, totalUsd: 0, unavailableCount: 2 },
    })
    expect((wrapper.find('[data-test="action-generate"]').element as HTMLButtonElement).disabled).toBe(false)
  })
})
