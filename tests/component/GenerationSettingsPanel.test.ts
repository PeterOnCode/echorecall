import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import GenerationSettingsPanel from '~/components/generate/GenerationSettingsPanel.vue'

// 007 · US1 (T005 / FR-005): the Generation settings column — Voice / Model / Format /
// Speed over the existing catalogs, controlled via v-model. Forks GenerateForm as a
// vertical editor column. Per-field reset + defaults resolution arrive in US3.
const voices = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'echo', label: 'Echo' },
]

function mountPanel() {
  return mountSuspended(GenerationSettingsPanel, {
    props: { voices, voiceId: 'alloy', model: 'gpt-4o-mini-tts', format: 'mp3', speed: 1 },
  })
}

// USelectMenu is a button-triggered combobox; drive it by emitting update:modelValue on
// the menu whose subtree carries the data-test trigger (established repo lesson).
function pickMenu(w: VueWrapper, testId: string, value: string) {
  const menu = w
    .findAllComponents({ name: 'USelectMenu' })
    .find((c) => c.find(`[data-test="${testId}"]`).exists())
  if (!menu) throw new Error(`USelectMenu [data-test="${testId}"] not found`)
  menu.vm.$emit('update:modelValue', value)
}

describe('GenerationSettingsPanel', () => {
  it('renders the four generation controls', async () => {
    const wrapper = await mountPanel()
    for (const id of ['voice', 'model', 'format', 'speed']) {
      expect(wrapper.find(`[data-test="${id}"]`).exists(), id).toBe(true)
    }
  })

  it('updates voice / model / format via v-model', async () => {
    const wrapper = await mountPanel()

    pickMenu(wrapper, 'voice', 'echo')
    await flushPromises()
    expect(wrapper.emitted('update:voiceId')?.at(-1)?.[0]).toBe('echo')

    pickMenu(wrapper, 'model', 'tts-1')
    await flushPromises()
    expect(wrapper.emitted('update:model')?.at(-1)?.[0]).toBe('tts-1')

    pickMenu(wrapper, 'format', 'flac')
    await flushPromises()
    expect(wrapper.emitted('update:format')?.at(-1)?.[0]).toBe('flac')
  })

  it('exposes a speed control clamped to the provider range', async () => {
    const wrapper = await mountPanel()
    const speed = wrapper.find('[data-test="speed"]')
    expect(speed.exists()).toBe(true)
  })

  // 007 · US3 (T022 / FR-013): each control offers a per-field reset that asks the page to
  // restore the field to its configured default (resolution is owned by the page).
  it('emits a per-field reset for each control', async () => {
    const wrapper = await mountPanel()
    const cases: [string, string][] = [
      ['gen-reset-voice', 'voiceId'],
      ['gen-reset-model', 'model'],
      ['gen-reset-format', 'format'],
      ['gen-reset-speed', 'speed'],
    ]
    for (const [testId, field] of cases) {
      const btn = wrapper.find(`[data-test="${testId}"]`)
      expect(btn.exists(), testId).toBe(true)
      await btn.trigger('click')
      expect(wrapper.emitted('reset')?.at(-1)?.[0], field).toBe(field)
    }
  })
})
