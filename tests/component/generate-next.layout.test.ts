import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import GenerateNextPage from '~/pages/generate-next.vue'

// The page loads voices + default tags on mount (best-effort); mock both so the
// layout assertions run against a clean, deterministic render.
registerEndpoint('/api/voices', () => ({ voices: [{ id: 'alloy', label: 'Alloy' }] }))
registerEndpoint('/api/settings/defaults', () => ({ defaultTags: {} }))

// 007 · Foundational (T002 / FR-003): the redesigned Generate surface is a single
// vertically-scrolling page with five stacked regions in order — page intro, the
// three-column editor (Script / Generation settings / Metadata), the action bar, the
// embedded Library-style workspace, and the status bar — NOT the 005 resizable
// two-pane dashboard. This test pins the region skeleton the user stories fill.
describe('generate-next page layout (007)', () => {
  const REGIONS = ['gen-page-intro', 'gen-editor', 'gen-action-bar-region', 'gen-embed', 'gen-status-bar']

  it('renders the five stacked regions in order under a single scrolling root', async () => {
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

  it('lays the editor out as three columns (Script / Generation settings / Metadata)', async () => {
    const wrapper = await mountSuspended(GenerateNextPage)
    for (const col of ['gen-col-script', 'gen-col-settings', 'gen-col-metadata']) {
      expect(wrapper.find(`[data-test="${col}"]`).exists()).toBe(true)
    }
  })
})
