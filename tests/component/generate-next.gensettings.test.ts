import { describe, it, expect, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import GenerateNextPage from '~/pages/index.vue'
import GenerationSettingsPanel from '~/components/generate/GenerationSettingsPanel.vue'

// 007 · US3 (T028 / G-DEFAULTS, FR-012/FR-013): the Generate page resolves each of
// Voice/Model/Format as last-selected → configured default → built-in fallback, and a
// per-field reset (emitted by the settings panel) restores the field to its configured
// default. The last-selected half lives in localStorage (`echorecall:viewprefs:genSettings`),
// the configured half comes from GET /api/settings/generation-defaults. Speed is not a
// generation control (synthesis always runs at 1×), so it is not resolved here.

const VOICES = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'nova', label: 'Nova' },
  { id: 'sage', label: 'Sage' },
]
registerEndpoint('/api/voices', () => ({ voices: VOICES }))
registerEndpoint('/api/settings/defaults', () => ({ defaultTags: {} }))

let configured: Record<string, unknown> = {}
registerEndpoint('/api/settings/generation-defaults', () => ({ generationDefaults: configured }))
registerEndpoint('/api/generations', () => ({ generations: [], total: 0, page: 1, pageSize: 20 }))

const GEN_KEY = 'echorecall:viewprefs:genSettings'

function panelOf(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  return wrapper.findComponent(GenerationSettingsPanel)
}

beforeEach(() => {
  configured = {}
  localStorage.clear()
})

describe('generate-next generation-settings resolution (US3)', () => {
  it('falls back to built-ins when nothing is configured or last-selected', async () => {
    const wrapper = await mountSuspended(GenerateNextPage)
    // Drain onMounted's chain: loadVoices → defaults → generation-defaults → resolve → nextTick.
    for (let i = 0; i < 6; i++) await flushPromises()
    const panel = panelOf(wrapper)
    expect(panel.props('voiceId')).toBe('alloy') // first voice
    expect(panel.props('model')).toBe('gpt-4o-mini-tts')
    expect(panel.props('format')).toBe('mp3')
  })

  it('uses the configured defaults when no last-selected value exists', async () => {
    configured = { voiceId: 'sage', model: 'tts-1', format: 'flac' }
    const wrapper = await mountSuspended(GenerateNextPage)
    // Drain onMounted's chain: loadVoices → defaults → generation-defaults → resolve → nextTick.
    for (let i = 0; i < 6; i++) await flushPromises()
    const panel = panelOf(wrapper)
    expect(panel.props('voiceId')).toBe('sage')
    expect(panel.props('model')).toBe('tts-1')
    expect(panel.props('format')).toBe('flac')
  })

  it('prefers the last-selected value over the configured default', async () => {
    configured = { voiceId: 'sage', model: 'tts-1', format: 'flac' }
    localStorage.setItem(GEN_KEY, JSON.stringify({ voiceId: 'nova' }))
    const wrapper = await mountSuspended(GenerateNextPage)
    // Drain onMounted's chain: loadVoices → defaults → generation-defaults → resolve → nextTick.
    for (let i = 0; i < 6; i++) await flushPromises()
    const panel = panelOf(wrapper)
    expect(panel.props('voiceId')).toBe('nova') // last-selected wins
    expect(panel.props('model')).toBe('tts-1') // still the configured default
  })

  it('persists a changed field as last-selected', async () => {
    const wrapper = await mountSuspended(GenerateNextPage)
    // Drain onMounted's chain: loadVoices → defaults → generation-defaults → resolve → nextTick.
    for (let i = 0; i < 6; i++) await flushPromises()
    panelOf(wrapper).vm.$emit('update:voiceId', 'nova')
    await flushPromises()
    expect(JSON.parse(localStorage.getItem(GEN_KEY)!)).toMatchObject({ voiceId: 'nova' })
  })

  it('per-field reset restores the configured default and forgets the last-selected value', async () => {
    configured = { voiceId: 'sage' }
    localStorage.setItem(GEN_KEY, JSON.stringify({ voiceId: 'nova' }))
    const wrapper = await mountSuspended(GenerateNextPage)
    // Drain onMounted's chain: loadVoices → defaults → generation-defaults → resolve → nextTick.
    for (let i = 0; i < 6; i++) await flushPromises()
    const panel = panelOf(wrapper)
    expect(panel.props('voiceId')).toBe('nova')

    panel.vm.$emit('reset', 'voiceId')
    await flushPromises()

    expect(panel.props('voiceId')).toBe('sage') // configured default
    expect(JSON.parse(localStorage.getItem(GEN_KEY)!).voiceId).toBeUndefined() // last-selected cleared
  })
})
