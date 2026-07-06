import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import GenerateNextPage from '~/pages/generate.vue'

// 007 · US1 (T008 / FR-004/FR-007): page-level wiring for the redesigned Generate editor.
// The Script column's Add appends a queue row and the action bar's count badge tracks the
// queue; Clear leaves the queue untouched. (Runs in the Nuxt component env — the repo's
// tests/integration/** is node-only, so a page-mount test lives here.)
registerEndpoint('/api/voices', () => ({
  voices: [
    { id: 'alloy', label: 'Alloy' },
    { id: 'echo', label: 'Echo' },
  ],
}))
registerEndpoint('/api/settings/defaults', () => ({ defaultTags: {} }))

async function mountPage() {
  const wrapper = await mountSuspended(GenerateNextPage)
  await flushPromises() // resolve onMounted loadVoices() + defaults fetch
  return wrapper
}

describe('generate-next editor wiring (US1)', () => {
  it('adds a queued row from the script panel and tracks the count badge', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('[data-test="queue-count-badge"]').text()).toContain('0')

    await wrapper.find('[data-test="add-text-input"]').setValue('hello world')
    await wrapper.find('[data-test="add-text-submit"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-test="queue-row"]')).toHaveLength(1)
    expect(wrapper.find('[data-test="queue-count-badge"]').text()).toContain('1')
  })

  it('Clear empties the script box without touching the queue', async () => {
    const wrapper = await mountPage()
    const box = wrapper.find('[data-test="add-text-input"]')
    await box.setValue('hello world')
    await wrapper.find('[data-test="add-text-submit"]').trigger('click')
    await flushPromises()

    await box.setValue('draft to discard')
    await wrapper.find('[data-test="script-clear"]').trigger('click')

    expect((box.element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.findAll('[data-test="queue-row"]')).toHaveLength(1)
  })
})
