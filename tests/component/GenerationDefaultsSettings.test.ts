import { describe, it, expect, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { defineEventHandler, readBody } from 'h3'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import GenerationDefaultsSettings from '~/components/settings/GenerationDefaultsSettings.vue'

// 007 · US3 (T021 / G-DEFAULTS, FR-011): the Settings section for the configurable
// Voice/Model/Format generation defaults, alongside Default Tags. Loads the saved set,
// saves (replace), clears, and resets a single field. Drives the real
// /api/settings/generation-defaults routes and /api/voices via registered endpoints.

let saved: Record<string, unknown> = {}
const puts: Record<string, unknown>[] = []

registerEndpoint('/api/voices', () => ({
  voices: [
    { id: 'alloy', label: 'Alloy' },
    { id: 'nova', label: 'Nova' },
  ],
}))
registerEndpoint(
  '/api/settings/generation-defaults',
  defineEventHandler(async (event) => {
    if (event.method === 'PUT') {
      const body = await readBody<Record<string, unknown>>(event)
      puts.push(body)
      // Mirror the server: omit undefined fields.
      saved = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined))
      return { generationDefaults: saved }
    }
    if (event.method === 'DELETE') {
      saved = {}
      return { generationDefaults: {} }
    }
    return { generationDefaults: saved }
  }),
)

/** Drive a USelectMenu by emitting update:modelValue on the menu carrying the data-test. */
function pickMenu(w: VueWrapper, testId: string, value: string) {
  const menu = w
    .findAllComponents({ name: 'USelectMenu' })
    .find((c) => c.find(`[data-test="${testId}"]`).exists())
  if (!menu) throw new Error(`USelectMenu [data-test="${testId}"] not found`)
  menu.vm.$emit('update:modelValue', value)
}

async function mount() {
  const wrapper = await mountSuspended(GenerationDefaultsSettings)
  await flushPromises() // resolve onMounted (load defaults + voices)
  return wrapper
}

beforeEach(() => {
  saved = {}
  puts.length = 0
})

describe('GenerationDefaultsSettings (US3)', () => {
  it('renders the three default fields plus save/clear/reset/status controls', async () => {
    const wrapper = await mount()
    for (const id of [
      'gen-default-voice',
      'gen-default-model',
      'gen-default-format',
      'gen-default-reset-voice',
      'gen-default-reset-model',
      'gen-default-reset-format',
      'gen-default-save',
      'gen-default-clear',
      'gen-default-status',
    ]) {
      expect(wrapper.find(`[data-test="${id}"]`).exists(), id).toBe(true)
    }
  })

  it('does not expose a speed default (synthesis always runs at 1×)', async () => {
    const wrapper = await mount()
    expect(wrapper.find('[data-test="gen-default-speed"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="gen-default-reset-speed"]').exists()).toBe(false)
  })

  it('saves the chosen defaults (PUT with the selected values)', async () => {
    const wrapper = await mount()
    pickMenu(wrapper, 'gen-default-voice', 'nova')
    pickMenu(wrapper, 'gen-default-model', 'tts-1')
    pickMenu(wrapper, 'gen-default-format', 'flac')
    await flushPromises()

    await wrapper.find('[data-test="gen-default-save"]').trigger('click')
    await flushPromises()

    expect(puts.at(-1)).toMatchObject({ voiceId: 'nova', model: 'tts-1', format: 'flac' })
  })

  it('per-field reset omits that field on the next save', async () => {
    saved = { voiceId: 'alloy', model: 'tts-1', format: 'mp3' }
    const wrapper = await mount()

    await wrapper.find('[data-test="gen-default-reset-voice"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-test="gen-default-save"]').trigger('click')
    await flushPromises()

    const body = puts.at(-1)!
    expect(body.voiceId).toBeUndefined() // reset dropped the voice default
    expect(body).toMatchObject({ model: 'tts-1', format: 'mp3' })
  })

  it('clears all saved defaults (DELETE)', async () => {
    saved = { voiceId: 'alloy' }
    const wrapper = await mount()
    expect(wrapper.find('[data-test="gen-default-status"]').text()).not.toBe('')

    await wrapper.find('[data-test="gen-default-clear"]').trigger('click')
    await flushPromises()

    expect(saved).toEqual({})
  })
})
