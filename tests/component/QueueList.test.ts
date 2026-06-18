import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import QueueList from '~/components/generate/QueueList.vue'
import type { QueueItem } from '~/composables/useQueue'

// Component coverage for the US4 live filename preview (FR-025–027): each
// not-yet-generated row shows what it will be saved as — the title slug + format
// extension — and falls back to a unique-name hint when the title yields no slug.
// The slug rule itself is unit-tested (naming.test.ts); here we verify it
// surfaces, and updates, in the queue UI. Assertions target the interpolated
// `{name}` (locale-independent), so they also catch a broken i18n binding.

const voices = [{ id: 'alloy', label: 'Alloy' }]

function item(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    clientId: 'c1',
    text: 'Hello',
    voiceId: 'alloy',
    model: 'tts-1',
    format: 'mp3',
    metadata: {},
    status: 'queued',
    ...overrides,
  }
}

describe('QueueList filename preview (US4)', () => {
  it('previews <slug>.<ext> from the row’s title and format', async () => {
    const wrapper = await mountSuspended(QueueList, {
      props: {
        items: [item({ metadata: { title: 'My Great Clip!' }, format: 'flac' })],
        voices,
      },
    })
    expect(wrapper.find('[data-test="filename-preview"]').text()).toContain('my-great-clip.flac')
  })

  it('shows a unique-name fallback (no emoji) when the title yields no slug', async () => {
    const wrapper = await mountSuspended(QueueList, {
      props: { items: [item({ metadata: { title: '🎵🎶' }, format: 'mp3' })], voices },
    })
    const text = wrapper.find('[data-test="filename-preview"]').text()
    expect(text).not.toContain('🎵')
    expect(text).toContain('mp3')
  })

  it('omits the preview once a row has successfully generated', async () => {
    const wrapper = await mountSuspended(QueueList, {
      props: {
        items: [
          item({
            status: 'done',
            result: { id: 'g1', audioUrl: '/api/generations/g1/audio' },
          }),
        ],
        voices,
      },
    })
    expect(wrapper.find('[data-test="filename-preview"]').exists()).toBe(false)
  })
})
