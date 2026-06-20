import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useRuntimeConfig } from '#imports'
import AppHeader from '~/components/common/AppHeader.vue'

// Component coverage for US9 (FR-046): the header shows the running version near
// the brand from the single authoritative source (runtimeConfig.public.appVersion,
// surfaced via useAppVersion), omits it gracefully when it cannot be determined,
// and performs no remote version check.

// AppHeader renders <UColorModeButton>, whose real client plugin reaches for a
// browser-only color-mode helper that doesn't exist in the vitest Nuxt env, so we
// mock the composable with a plain stand-in (matches the US7 Settings test).
const { useColorModeMock } = vi.hoisted(() => ({ useColorModeMock: vi.fn() }))
mockNuxtImport('useColorMode', () => useColorModeMock)

// Drive the displayed version through the composable that wraps
// runtimeConfig.public.appVersion, so we can exercise both present and absent.
const { useAppVersionMock } = vi.hoisted(() => ({ useAppVersionMock: vi.fn() }))
mockNuxtImport('useAppVersion', () => useAppVersionMock)

// Any request whose target looks like a remote version/release lookup would
// violate FR-046 ("performs no remote version check"). Icon/font requests from
// the UI chrome are unrelated and intentionally not matched here.
const REMOTE_VERSION_CHECK = /version|release|github|npm|registry|update/i
function assertNoRemoteVersionCheck(spy: ReturnType<typeof vi.spyOn>): void {
  for (const call of spy.mock.calls) {
    // fetch accepts string | URL | Request; a Request stringifies to
    // "[object Request]", so read its url to keep the guard meaningful.
    const input = call[0]
    const url = input instanceof Request ? input.url : String(input)
    expect(url).not.toMatch(REMOTE_VERSION_CHECK)
  }
}

beforeEach(() => {
  useColorModeMock.mockReturnValue({ preference: 'system', value: 'light' })
})
afterEach(() => vi.restoreAllMocks())

describe('AppHeader — running version (US9)', () => {
  it('renders the running version near the brand with no remote check', async () => {
    useAppVersionMock.mockReturnValue('1.2.3')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const wrapper = await mountSuspended(AppHeader)

    expect(wrapper.text()).toContain('EchoRecall')
    expect(wrapper.find('[data-test="app-version"]').text()).toBe('v1.2.3')
    assertNoRemoteVersionCheck(fetchSpy)
  })

  it('omits the version (and still loads) when it cannot be determined', async () => {
    useAppVersionMock.mockReturnValue(null)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const wrapper = await mountSuspended(AppHeader)

    // The brand still renders; the version chip is simply absent (graceful).
    expect(wrapper.text()).toContain('EchoRecall')
    expect(wrapper.find('[data-test="app-version"]').exists()).toBe(false)
    assertNoRemoteVersionCheck(fetchSpy)
  })

  it('sources the version from runtimeConfig.public.appVersion (single source of truth)', () => {
    // The composable reads this value; nuxt.config wires it from package.json, so
    // a release `bumpp` updates the header with no further edit (FR-046/FR-047).
    expect(useRuntimeConfig().public.appVersion).toMatch(/^\d+\.\d+\.\d+/)
  })
})
