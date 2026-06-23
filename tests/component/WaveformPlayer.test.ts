import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import WaveformPlayer from '~/components/library/WaveformPlayer.vue'
import {
  wavesurferState,
  resetWavesurferMock,
  WaveSurferMock,
} from './wavesurfer-mock'

// Component coverage for US6 (005 redesign / FR-016): WaveformPlayer wraps
// `wavesurfer.js` for the selected recording — a waveform with zoom and loop-only
// regions (no audio modification). happy-dom can render neither the <canvas> nor
// WebAudio, so the library is mocked (./wavesurfer-mock, mirroring the useColorMode
// mock pattern) and we assert our *wiring*: it loads the given src, the zoom control
// calls `zoom`, adding a region marks a playback loop, a load error surfaces the
// unavailable state (no crash), and the instance is torn down on unmount / src change.

// The factory must reach the mock via dynamic import so it survives vi.mock hoisting;
// the dynamic and the top-level import resolve to the same module singleton, so the
// captured `wavesurferState` handles are shared.
vi.mock('wavesurfer.js', async () => ({
  default: (await import('./wavesurfer-mock')).WaveSurferMock,
}))
vi.mock('wavesurfer.js/plugins/regions', async () => ({
  default: (await import('./wavesurfer-mock')).RegionsPluginMock,
}))

const SRC = '/api/generations/gen-1/audio'

beforeEach(() => resetWavesurferMock())

/** Mount and bring the instance to the `ready` state (decoded, controls enabled). */
async function mountReady(src = SRC) {
  const wrapper = await mountSuspended(WaveformPlayer, { props: { src } })
  wavesurferState.instance!.emit('ready', 10)
  await flushPromises()
  return wrapper
}

describe('WaveformPlayer (US6)', () => {
  it('creates a waveform and loads the given src on mount', async () => {
    const wrapper = await mountSuspended(WaveformPlayer, { props: { src: SRC } })

    expect(wrapper.find('[data-test="waveform-player"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="waveform-canvas"]').exists()).toBe(true)
    expect(WaveSurferMock.create).toHaveBeenCalledTimes(1)
    expect(wavesurferState.instance!.load).toHaveBeenCalledWith(SRC)
  })

  it('zooms the waveform via the zoom control', async () => {
    const wrapper = await mountReady()

    const zoom = wrapper.find('[data-test="waveform-zoom"]')
    await zoom.setValue('120')

    expect(wavesurferState.instance!.zoom).toHaveBeenCalledWith(120)
  })

  it('adds a loop region that replays when playback leaves it', async () => {
    const wrapper = await mountReady()

    await wrapper.find('[data-test="waveform-add-region"]').trigger('click')

    const regions = wavesurferState.regions!
    expect(regions.addRegion).toHaveBeenCalledTimes(1)

    // Loop-only: leaving the region while looping replays it (no audio mutation).
    const region = wavesurferState.lastRegion!
    regions.emit('region-out', region)
    // Replays with NO stop-at-end argument — wavesurfer's canonical loop. Passing
    // `play(true)` arms the core's stopAtPosition=end and, since region-out fires
    // inside the same timeupdate (t already > end), the core would instantly pause
    // and seek back to the end, glitching the loop. Lock the no-arg call here.
    expect(region.play).toHaveBeenCalledWith()
  })

  it('does not loop a region once the loop toggle is turned off', async () => {
    const wrapper = await mountReady()
    await wrapper.find('[data-test="waveform-add-region"]').trigger('click')
    const regions = wavesurferState.regions!
    const region = wavesurferState.lastRegion!

    await wrapper.find('[data-test="waveform-loop-toggle"]').trigger('click')
    regions.emit('region-out', region)

    expect(region.play).not.toHaveBeenCalled()
  })

  it('shows the unavailable state and emits error when the audio fails to load', async () => {
    const wrapper = await mountSuspended(WaveformPlayer, { props: { src: '/missing.mp3' } })

    wavesurferState.instance!.emit('error', new Error('decode failed'))
    await flushPromises()

    expect(wrapper.find('[data-test="waveform-unavailable"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="waveform-canvas"]').exists()).toBe(false)
    expect(wrapper.emitted('error')).toBeTruthy()
  })

  it('ignores a stale error from a torn-down instance during a rebuild', async () => {
    const wrapper = await mountSuspended(WaveformPlayer, { props: { src: SRC } })
    const first = wavesurferState.instance!

    // Select another recording before the first finishes loading: rebuild destroys
    // `first` (wavesurfer aborts its in-flight load and emits an AbortError via the
    // load() try/catch) and builds a fresh instance.
    await wrapper.setProps({ src: '/api/generations/gen-2/audio' })
    await flushPromises()
    const second = wavesurferState.instance!
    expect(second).not.toBe(first)

    // The stale abort error from the destroyed first instance must NOT flip the
    // live player into the unavailable state, or it would hide the valid waveform.
    first.emit('error', new DOMException('aborted', 'AbortError'))
    await flushPromises()

    expect(wrapper.find('[data-test="waveform-unavailable"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="waveform-canvas"]').exists()).toBe(true)
    expect(wrapper.emitted('error')).toBeFalsy()
  })

  it('destroys the instance on unmount', async () => {
    const wrapper = await mountSuspended(WaveformPlayer, { props: { src: SRC } })
    const instance = wavesurferState.instance!

    wrapper.unmount()

    expect(instance.destroy).toHaveBeenCalledTimes(1)
  })

  it('tears down and rebuilds the waveform when src changes', async () => {
    const wrapper = await mountSuspended(WaveformPlayer, { props: { src: SRC } })
    const first = wavesurferState.instance!

    await wrapper.setProps({ src: '/api/generations/gen-2/audio' })
    await flushPromises()

    expect(first.destroy).toHaveBeenCalledTimes(1)
    expect(WaveSurferMock.create).toHaveBeenCalledTimes(2)
    expect(wavesurferState.instance!.load).toHaveBeenCalledWith('/api/generations/gen-2/audio')
  })
})
