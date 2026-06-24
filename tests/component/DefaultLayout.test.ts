import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import DefaultLayout from '~/layouts/default.vue'

// Component coverage for US7 (FR-017, contract §9 IA change): the standalone Settings
// tab/page is removed — the layout's primary navigation is now Generate + Library only.
// Settings is reached through the modal (header gear / Generate toolbar), not a route.

// The layout renders AppHeader, which reads useColorMode (a browser-only helper absent
// from the vitest env) and useAppVersion — mock both with plain stand-ins.
const { useColorModeMock } = vi.hoisted(() => ({ useColorModeMock: vi.fn() }))
mockNuxtImport('useColorMode', () => useColorModeMock)
const { useAppVersionMock } = vi.hoisted(() => ({ useAppVersionMock: vi.fn() }))
mockNuxtImport('useAppVersion', () => useAppVersionMock)

beforeEach(() => {
  useColorModeMock.mockReturnValue({ preference: 'system', value: 'light' })
  useAppVersionMock.mockReturnValue('1.0.0')
})
afterEach(() => vi.restoreAllMocks())

describe('Default layout navigation (US7)', () => {
  it('shows only Generate and Library tabs — no Settings tab', async () => {
    const wrapper = await mountSuspended(DefaultLayout, {
      slots: { default: () => 'page content' },
    })

    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs).toHaveLength(2)

    // Hungarian is the app's deterministic default locale.
    const labels = tabs.map((tab) => tab.text())
    expect(labels).toContain('Létrehozás') // common.tabs.generate (hu)
    expect(labels).toContain('Könyvtár') //   common.tabs.library (hu)
    expect(labels.join(' ')).not.toContain('Beállítások') // no Settings tab
  })
})
