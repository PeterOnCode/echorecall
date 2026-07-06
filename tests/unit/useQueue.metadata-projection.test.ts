import { describe, expect, it } from 'vitest'
import { computed, nextTick, ref, watch } from 'vue'
import { useQueue } from '../../app/composables/useQueue'
import type { MetadataFieldId } from '../../app/composables/useViewPreferences'

// 007 · Configure Visible Fields — only the currently-visible metadata fields are written
// onto queue rows. useQueue takes a `visibleMetadataFields` getter; a hidden configurable
// field is dropped from a row's saved metadata (makeItem, the live watcher, and
// applyMetadataToPending), while any non-configurable key (e.g. deployment defaults for a
// field not in the metadata form) always passes through. Recording-date auto-stamping is
// independent of visibility (still fills today at generation).
//
// useQueue relies on Nuxt auto-imports (ref/computed/watch); shim them onto globalThis, node env.
const g = globalThis as unknown as Record<string, unknown>
g.ref = ref
g.computed = computed
g.watch = watch

const ALL: MetadataFieldId[] = [
  'title',
  'artist',
  'album',
  'genre',
  'track',
  'recordedAt',
  'comment',
  'languages',
  'customText',
  'customUrl',
]

/** Today as a local-day YYYY-MM-DD string (matches the composable's todayIso). */
function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

describe('useQueue metadata projection (007 · Configure Visible Fields)', () => {
  it('saves only visible fields onto a newly-added row', () => {
    const visible = ref<MetadataFieldId[]>(ALL.filter((f) => f !== 'album'))
    const q = useQueue({ visibleMetadataFields: () => visible.value })
    q.metadata.value = { title: 'T', album: 'A', genre: 'G' }

    const row = q.addItem('hello')!
    expect(row.metadata.title).toBe('T')
    expect(row.metadata.genre).toBe('G')
    expect(row.metadata.album).toBeUndefined() // hidden → not saved
  })

  it('preserves non-configurable keys (deployment defaults) even when not in the visible set', () => {
    const visible = ref<MetadataFieldId[]>(['title'])
    const q = useQueue({ visibleMetadataFields: () => visible.value })
    // `composer` is a valid Metadata key but not one of the configurable form fields.
    q.metadata.value = { title: 'T', album: 'A', composer: 'C' }

    const row = q.addItem('hello')!
    expect(row.metadata.title).toBe('T')
    expect(row.metadata.album).toBeUndefined() // configurable + hidden → dropped
    expect(row.metadata.composer).toBe('C') // non-configurable → preserved
  })

  it('applyMetadataToPending re-projects to the current visible set', () => {
    const visible = ref<MetadataFieldId[]>([...ALL])
    const q = useQueue({ visibleMetadataFields: () => visible.value })
    q.metadata.value = { title: 'T', album: 'A' }
    const row = q.addItem('hello')!
    expect(row.metadata.album).toBe('A')

    visible.value = ALL.filter((f) => f !== 'album') // hide album
    q.applyMetadataToPending(q.items.value)
    expect(row.metadata.album).toBeUndefined()
    expect(row.metadata.title).toBe('T')
  })

  it('re-projects existing (non-edited) rows live when visibility changes', async () => {
    const visible = ref<MetadataFieldId[]>([...ALL])
    const q = useQueue({ visibleMetadataFields: () => visible.value })
    q.metadata.value = { title: 'T', album: 'A' }
    const row = q.addItem('hello')!
    expect(row.metadata.album).toBe('A')

    visible.value = ALL.filter((f) => f !== 'album') // hide album
    await nextTick()
    expect(row.metadata.album).toBeUndefined()

    visible.value = [...ALL] // show it again → re-added from the form
    await nextTick()
    expect(row.metadata.album).toBe('A')
  })

  it('still auto-stamps today onto recordedAt even when the field is hidden', () => {
    const visible = ref<MetadataFieldId[]>(ALL.filter((f) => f !== 'recordedAt'))
    const q = useQueue({ visibleMetadataFields: () => visible.value })
    // A form recordedAt would be dropped by the projection (hidden)...
    q.metadata.value = { title: 'T', recordedAt: '2020-01-01' }
    const row = q.addItem('hello')!
    expect(row.metadata.recordedAt).toBeUndefined()

    // ...but generation-time stamping is independent of visibility and fills today.
    q.stampRecordingDates(q.items.value)
    expect(row.metadata.recordedAt).toBe(todayIso())
  })

  it('with no option (default), saves every field — unchanged pre-feature behavior', () => {
    const q = useQueue()
    q.metadata.value = { title: 'T', album: 'A', genre: 'G' }
    const row = q.addItem('hello')!
    expect(row.metadata).toMatchObject({ title: 'T', album: 'A', genre: 'G' })
  })

  it('keeps imported row metadata when preparing loaded queue rows for generation', () => {
    const q = useQueue()
    q.metadata.value = {}
    q.loadDocument({
      schema: 'echorecall.queue',
      version: 1,
      items: [
        {
          text: 'loaded script',
          voiceId: 'alloy',
          model: 'gpt-4o-mini-tts',
          format: 'mp3',
          metadata: { comment: 'loaded comment' },
          source: 'text',
        },
      ],
    })
    const row = q.items.value[0]!

    q.applyMetadataToPending(q.generateTarget.value)

    expect(row.metadata.comment).toBe('loaded comment')
  })
})
