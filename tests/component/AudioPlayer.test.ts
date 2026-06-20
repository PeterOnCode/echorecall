import { describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AudioPlayer from '~/components/AudioPlayer.vue'

// Component coverage for the inline replay control (FR-009/US5). It exposes the
// native audio element with an accessible name, and — for the Phase 13 edge case
// (T107) — stops playback when it is unmounted, e.g. when its library/queue item
// is deleted or bulk-cleaned while playing, instead of letting audio linger.

describe('AudioPlayer', () => {
  it('renders the native controls and the given accessible name', async () => {
    const wrapper = await mountSuspended(AudioPlayer, { props: { src: '/api/x/audio', label: 'My clip' } })
    const audio = wrapper.find('audio')
    expect(audio.exists()).toBe(true)
    expect(audio.attributes('controls')).toBeDefined()
    expect(audio.attributes('src')).toBe('/api/x/audio')
    expect(audio.attributes('aria-label')).toBe('My clip')
  })

  it('falls back to a generic accessible name when no label is given', async () => {
    const wrapper = await mountSuspended(AudioPlayer, { props: { src: '/a' } })
    expect(wrapper.find('audio').attributes('aria-label')).toBe('Generated speech audio')
  })

  it('pauses playback when unmounted (item deleted/bulk-cleaned while playing)', async () => {
    const wrapper = await mountSuspended(AudioPlayer, { props: { src: '/a' } })
    const el = wrapper.find('audio').element as HTMLAudioElement
    const pause = vi.spyOn(el, 'pause').mockImplementation(() => {})

    wrapper.unmount()

    expect(pause).toHaveBeenCalledOnce()
  })
})
