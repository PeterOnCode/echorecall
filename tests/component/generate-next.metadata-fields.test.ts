import { describe, it, expect, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import GenerateNextPage from '~/pages/generate-next.vue'

// 007 · Configure Visible Fields — page wiring. The Generate page owns the metadata field
// visibility (useViewPreferences) and passes it to both the MetadataFields form and the
// queue's metadata projection. This test drives the real dialog: opening it, hiding a field,
// and applying removes the field from the form and persists the choice. (That only visible
// fields reach saved rows is covered by the useQueue projection unit test.)

registerEndpoint('/api/voices', () => ({ voices: [{ id: 'alloy', label: 'Alloy' }] }))
registerEndpoint('/api/settings/defaults', () => ({ defaultTags: {} }))
registerEndpoint('/api/settings/generation-defaults', () => ({ generationDefaults: {} }))

const MFKEY = 'echorecall:viewprefs:metadataFields'

function el(testId: string): HTMLElement | null {
  return document.body.querySelector(`[data-test="${testId}"]`)
}

/** Drain the page's onMounted chain (voices → defaults → generation-defaults → resolve). */
async function drainMount() {
  for (let i = 0; i < 6; i++) await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
})

describe('generate-next Configure Visible Fields wiring (007)', () => {
  it('renders the configurable metadata fields and a Configure button by default', async () => {
    const wrapper = await mountSuspended(GenerateNextPage)
    await drainMount()
    expect(wrapper.find('[data-test="metadata-configure-fields"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="meta-artist"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="meta-comment"]').exists()).toBe(true)
    // Title + Track are derived at generation time, so they are never shown in the form.
    expect(wrapper.find('[data-test="meta-title"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="meta-track"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('opens the dialog; hiding a field removes it from the form and persists the choice', async () => {
    const wrapper = await mountSuspended(GenerateNextPage)
    await drainMount()

    await wrapper.find('[data-test="metadata-configure-fields"]').trigger('click')
    await flushPromises()
    expect(el('metadata-fields-dialog')).not.toBeNull()

    el('mfield-toggle-comment')!.click()
    await flushPromises()
    el('metadata-fields-apply')!.click()
    await flushPromises()

    // The comment control is gone from the form; other fields remain.
    expect(wrapper.find('[data-test="meta-comment"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="meta-artist"]').exists()).toBe(true)

    // The applied set persisted per-device with comment hidden.
    const persisted = JSON.parse(localStorage.getItem(MFKEY)!) as { id: string; visible: boolean }[]
    expect(persisted.find((f) => f.id === 'comment')!.visible).toBe(false)
    wrapper.unmount()
  })
})
