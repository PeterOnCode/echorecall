import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { Metadata } from '#core/client'
import QueueList from '~/components/generate/QueueList.vue'
import type { QueueItem } from '~/composables/useQueue'

// Component coverage for the US4 live filename preview (FR-025–027): each
// not-yet-generated row shows what it will be saved as — the title slug + format
// extension — and falls back to a unique-name hint when the title yields no slug.
// The effective title follows the real data flow: the shared form metadata for an
// un-edited row (what applyMetadataToPending stamps on it at generation), and the
// row's own title once edited individually (US3). The slug rule itself is
// unit-tested (naming.test.ts); here we verify it surfaces, with the right title,
// in the queue UI. Assertions target the interpolated `{name}` (locale-
// independent), so they also catch a broken i18n binding.

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
    source: 'text',
    ...overrides,
  }
}

function mount(items: QueueItem[], sharedMetadata?: Metadata) {
  return mountSuspended(QueueList, { props: { items, voices, sharedMetadata } })
}

describe('QueueList filename preview (US4)', () => {
  it('previews the shared-form title slug for a row not yet edited individually', async () => {
    // The common flow: a row was added before the shared Title was filled, so its
    // own metadata is still empty — the preview must reflect the shared title that
    // generation will stamp on it, not the stale snapshot.
    const wrapper = await mount(
      [item({ metadata: {}, format: 'flac' })],
      { title: 'My Great Clip!' },
    )
    expect(wrapper.find('[data-test="filename-preview"]').text()).toContain('my-great-clip.flac')
  })

  it('previews the row’s own title once it has been edited individually (US3)', async () => {
    // An individually-edited row keeps its own metadata through generation, so it
    // wins over the shared form title.
    const wrapper = await mount(
      [item({ metadata: { title: 'Row Title' }, metadataEdited: true, format: 'mp3' })],
      { title: 'Shared Title' },
    )
    expect(wrapper.find('[data-test="filename-preview"]').text()).toContain('row-title.mp3')
  })

  it('shows a unique-name fallback (no emoji) when the effective title yields no slug', async () => {
    const wrapper = await mount([item({ metadata: {}, format: 'mp3' })], { title: '🎵🎶' })
    const text = wrapper.find('[data-test="filename-preview"]').text()
    expect(text).not.toContain('🎵')
    expect(text).toContain('mp3')
  })

  it('omits the preview once a row has successfully generated', async () => {
    const wrapper = await mount([
      item({ status: 'done', result: { id: 'g1', audioUrl: '/api/generations/g1/audio' } }),
    ])
    expect(wrapper.find('[data-test="filename-preview"]').exists()).toBe(false)
  })
})
