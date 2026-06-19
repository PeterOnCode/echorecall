import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { defineComponent, nextTick, reactive } from 'vue'
import { useNuxtApp, useI18n } from '#imports'
import SettingsPage from '~/pages/settings.vue'

// Component coverage for US7 (FR-038/FR-039 + acceptance scenario 3): the
// Settings page exposes an appearance selector (light/dark/system, backed by
// @nuxtjs/color-mode, default system) and a language selector (en/hu, default
// Hungarian). Selecting an option updates the UI immediately and persists the
// choice (color-mode via its own storage; locale via the `locale` cookie). The
// app's deterministic default locale is Hungarian. Domain data (generated text,
// tag values, filenames) is never run through i18n, so it renders verbatim in
// any language.

// @nuxtjs/color-mode's real client plugin reaches for a browser-only helper that
// doesn't exist in the vitest Nuxt environment, so we mock the composable with a
// reactive stand-in. The component drives this exactly as it would the real one.
const { useColorModeMock } = vi.hoisted(() => ({ useColorModeMock: vi.fn() }))
mockNuxtImport('useColorMode', () => useColorModeMock)
const colorMode = reactive({ preference: 'system', value: 'light' })

// Appearance/language are global app state in the Nuxt test runtime, so reset to
// the defaults before and after every test to keep them order-independent.
async function resetPreferences(): Promise<void> {
  colorMode.preference = 'system'
  colorMode.value = 'light'
  useColorModeMock.mockReturnValue(colorMode)
  await useNuxtApp().$i18n.setLocale('hu')
  document.cookie = 'locale=; path=/; max-age=0'
  await nextTick()
}

// Switching to a locale dynamically imports its JSON catalog. Under full-suite
// load that import can resolve slower than a tight poll, so warm the `en`
// catalog once up front; thereafter switches are just a reactive locale change.
beforeAll(async () => {
  const i18n = useNuxtApp().$i18n
  await i18n.setLocale('en')
  await i18n.setLocale('hu')
})

beforeEach(resetPreferences)
afterEach(resetPreferences)

// The locale change + re-render lands a tick or two after the click; poll
// (bounded, with a real delay) until the expected text appears.
async function waitForText(
  wrapper: { text: () => string },
  needle: string,
  tries = 50,
): Promise<void> {
  for (let i = 0; i < tries; i++) {
    await flushPromises()
    await nextTick()
    if (wrapper.text().includes(needle)) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

describe('Settings — appearance & language (US7)', () => {
  it('defaults to the Hungarian locale and the system theme', async () => {
    const wrapper = await mountSuspended(SettingsPage)

    // Hungarian chrome is shown by default (FR-039 default Hungarian).
    expect(wrapper.text()).toContain('Megjelenés') // settings.appearance.title (hu)
    expect(wrapper.text()).toContain('Nyelv') //       settings.language.title (hu)

    // The matching options are marked as the current selection.
    expect(wrapper.find('[data-test="lang-hu"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-test="lang-en"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('[data-test="theme-system"]').attributes('aria-pressed')).toBe('true')
  })

  it('switches the interface language to English and persists it to a cookie', async () => {
    const wrapper = await mountSuspended(SettingsPage)

    await wrapper.find('[data-test="lang-en"]').trigger('click')
    await waitForText(wrapper, 'Appearance')

    // The UI re-renders in English…
    expect(wrapper.text()).toContain('Appearance') // settings.appearance.title (en)
    expect(wrapper.text()).toContain('Language') //   settings.language.title (en)
    expect(wrapper.text()).not.toContain('Megjelenés')

    // …the selection moves to English…
    expect(wrapper.find('[data-test="lang-en"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-test="lang-hu"]').attributes('aria-pressed')).toBe('false')

    // …and the choice is persisted for the next visit.
    expect(document.cookie).toContain('locale=en')
  })

  it('switches the color theme to dark and reflects the selection', async () => {
    const wrapper = await mountSuspended(SettingsPage)

    await wrapper.find('[data-test="theme-dark"]').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-test="theme-dark"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-test="theme-system"]').attributes('aria-pressed')).toBe('false')
    // The component writes the choice to color-mode's preference (which the
    // module itself persists across reloads).
    expect(colorMode.preference).toBe('dark')
  })

  it('never translates domain data (text / tags / filenames) when the language changes', async () => {
    // A probe rendering chrome (a translated label) alongside domain data
    // (a voice id, a filename, an ISO language tag) passed straight through.
    const Probe = defineComponent({
      setup() {
        const { t, setLocale } = useI18n()
        return { t, setLocale }
      },
      template: `<div>
        <span data-test="chrome">{{ t('common.tabs.settings') }}</span>
        <span data-test="domain">alloy · my_clip.mp3 · eng</span>
      </div>`,
    })

    const wrapper = await mountSuspended(Probe)
    const domainBefore = wrapper.find('[data-test="domain"]').text()
    expect(wrapper.find('[data-test="chrome"]').text()).toBe('Beállítások') // hu chrome

    await (wrapper.vm as unknown as { setLocale: (l: string) => Promise<void> }).setLocale('en')
    await flushPromises()
    await nextTick()

    // Chrome is translated; the domain data is byte-for-byte unchanged.
    expect(wrapper.find('[data-test="chrome"]').text()).toBe('Settings')
    expect(wrapper.find('[data-test="domain"]').text()).toBe(domainBefore)
    expect(wrapper.find('[data-test="domain"]').text()).toBe('alloy · my_clip.mp3 · eng')
  })
})
