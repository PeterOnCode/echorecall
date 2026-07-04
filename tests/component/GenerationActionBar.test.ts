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
})
