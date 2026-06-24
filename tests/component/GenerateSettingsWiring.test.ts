import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { mountSuspended, mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineEventHandler } from 'h3'
import GeneratePage from '~/pages/index.vue'
import SettingsModal from '~/components/settings/SettingsModal.vue'

// Integration coverage for the US7 Settings wiring (FR-017, contract §9): the Generate
// toolbar's open-settings action must actually open the shared Settings modal. The
// modal lives in the app header and the page only flips the useState-backed open flag
// (useSettingsModal), so the unit tests for the toolbar (emit fires) and the modal
// (opens on v-model) can both pass even if the page binding is removed or miswired.
// This test exercises the whole chain end to end: render the real Generate page beside
// a SettingsModal bound to the same shared flag, click toolbar-open-settings, and
// assert the modal becomes visible. UModal teleports to document.body.

// AppearanceSettings (inside the modal) reads useColorMode, whose real client plugin
// needs a browser-only helper absent from the vitest Nuxt env — mock it.
const { useColorModeMock } = vi.hoisted(() => ({ useColorModeMock: vi.fn() }))
mockNuxtImport('useColorMode', () => useColorModeMock)

registerEndpoint('/api/voices', () => ({ voices: [{ id: 'alloy', label: 'Alloy' }] }))
registerEndpoint(
  '/api/settings/openai-key',
  defineEventHandler(() => ({ configured: false, source: 'none', secretConfigured: true })),
)
registerEndpoint('/api/settings/defaults', defineEventHandler(() => ({ defaultTags: {} })))

beforeEach(() => {
  useColorModeMock.mockReturnValue({ preference: 'system', value: 'light' })
})
afterEach(() => vi.restoreAllMocks())

// The page and the modal both read the same shared open flag via useSettingsModal()
// (useState), exactly as the app wires them (page sets it; header hosts the modal).
const Host = defineComponent({
  components: { GeneratePage, SettingsModal },
  setup() {
    const { open } = useSettingsModal()
    return { open }
  },
  template: '<div><GeneratePage /><SettingsModal v-model:open="open" /></div>',
})

describe('Generate → Settings modal wiring (US7)', () => {
  it('opens the shared Settings modal when the toolbar open-settings action fires', async () => {
    const wrapper = await mountSuspended(Host)
    await flushPromises() // resolve the page's onMounted loadVoices/defaults

    // Closed to start: nothing teleported.
    expect(document.body.querySelector('[data-test="settings-modal"]')).toBeNull()

    await wrapper.find('[data-test="toolbar-open-settings"]').trigger('click')
    await flushPromises()

    // The page binding flipped the shared flag and the modal rendered.
    expect(document.body.querySelector('[data-test="settings-modal"]')).not.toBeNull()
    wrapper.unmount()
  })
})
