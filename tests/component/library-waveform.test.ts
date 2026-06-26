import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { defineEventHandler, getQuery } from 'h3'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import LibraryPage from '~/pages/library.vue'
import { wavesurferState, resetWavesurferMock } from './wavesurfer-mock'

// 006 · US2 (FR-007/FR-010) — the reused 005 WaveformPlayer mounted in the
// /library footer for the ACTIVE recording: absent when nothing is selected,
// loads the active item's audioUrl when a row is clicked, and passes through the
// player's own "unavailable" state on a load error (no crash). wavesurfer.js is
// mocked (happy-dom has no canvas/WebAudio); we assert the page WIRING, not
// wavesurfer internals.

vi.mock('wavesurfer.js', async () => ({
  default: (await import('./wavesurfer-mock')).WaveSurferMock,
}))
vi.mock('wavesurfer.js/plugins/regions', async () => ({
  default: (await import('./wavesurfer-mock')).RegionsPluginMock,
}))

const rows = [
  {
    id: 'a',
    text: 'Alpha source',
    voiceId: 'alloy',
    model: null,
    format: 'mp3',
    speed: null,
    createdAt: '2026-06-15T10:00:00.000Z',
    filename: 'alpha.mp3',
    audioUrl: '/api/generations/a/audio',
    metadata: { title: 'Alpha' },
  },
]

registerEndpoint(
  '/api/generations',
  defineEventHandler((event) => {
    const q = getQuery(event)
    return { generations: rows, total: rows.length, page: Number(q.page ?? 1), pageSize: Number(q.pageSize ?? 20) }
  }),
)

beforeEach(() => resetWavesurferMock())

async function mountPage() {
  const wrapper = await mountSuspended(LibraryPage)
  await flushPromises()
  return wrapper
}

describe('library waveform footer (US2)', () => {
  it('shows no waveform when nothing is selected', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('[data-test="waveform-player"]').exists()).toBe(false)
  })

  it('renders the waveform for the active recording and loads its audio', async () => {
    const wrapper = await mountPage()
    await wrapper.findAll('[data-test="library-row"]')[0]!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="waveform-player"]').exists()).toBe(true)
    expect(wavesurferState.instance!.load).toHaveBeenCalledWith('/api/generations/a/audio')
  })

  it('passes through the unavailable state on a load error (FR-010)', async () => {
    const wrapper = await mountPage()
    await wrapper.findAll('[data-test="library-row"]')[0]!.trigger('click')
    await flushPromises()

    wavesurferState.instance!.emit('error', new Error('decode failed'))
    await flushPromises()

    expect(wrapper.find('[data-test="waveform-unavailable"]').exists()).toBe(true)
  })
})
