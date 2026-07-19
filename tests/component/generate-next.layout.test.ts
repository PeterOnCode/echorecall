import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import GenerateNextPage from '~/pages/generate.vue'

// The page loads voices + default tags on mount (best-effort); mock both so the
// layout assertions run against a clean, deterministic render.
registerEndpoint('/api/voices', () => ({ voices: [{ id: 'alloy', label: 'Alloy' }] }))
registerEndpoint('/api/settings/defaults', () => ({ defaultTags: {} }))

// 007 · Foundational (T002 / FR-003): the redesigned Generate surface is a single
// vertically-scrolling page with its regions stacked in order — page intro, the
// two-column editor (Script / Generation settings) with Metadata on its own full-width
// row below, and the action bar + pending-queue — NOT the 005 resizable two-pane
// dashboard. The embedded Library workspace was removed at the user's request (Library
// lives on /library), so the page is now a focused queue builder. This test pins the
// region skeleton.
describe('generate-next page layout (007)', () => {
  const REGIONS = ['gen-page-intro', 'gen-editor', 'gen-action-bar-region']

  it('renders the stacked regions in order under a single scrolling root', async () => {
    const wrapper = await mountSuspended(GenerateNextPage)

    expect(wrapper.find('[data-test="generate-next"]').exists()).toBe(true)
    for (const region of REGIONS) {
      expect(wrapper.find(`[data-test="${region}"]`).exists()).toBe(true)
    }

    const html = wrapper.get('[data-test="generate-next"]').html()
    const positions = REGIONS.map((r) => html.indexOf(`data-test="${r}"`))
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1])
    }
  })

  it('lays the editor out as two columns (Script / Generation settings) with Metadata on its own row', async () => {
    const wrapper = await mountSuspended(GenerateNextPage)
    for (const col of ['gen-col-script', 'gen-col-settings', 'gen-col-metadata']) {
      expect(wrapper.find(`[data-test="${col}"]`).exists()).toBe(true)
    }
    // Top row is a two-column grid; Metadata spans both columns so it wraps to the next row.
    expect(wrapper.get('[data-test="gen-editor"]').classes()).toContain('lg:grid-cols-2')
    expect(wrapper.get('[data-test="gen-col-metadata"]').classes()).toContain('lg:col-span-2')
  })
})
