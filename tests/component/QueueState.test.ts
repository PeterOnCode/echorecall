import { describe, expect, it } from 'vitest'
import type { ResolvedQueueInput } from '#core/client'
import { useQueue } from '~/composables/useQueue'

// Foundational queue state for the 005 redesign (data-model §1-2): every row
// records its source (typed text vs an uploaded file, carrying the filename), and
// the composable tracks the active item plus a multi-select set with bulk
// toggle/remove. The reactive state uses Nuxt auto-imports, so — like the existing
// useQueue().updateItem coverage in QueueItemEditor.test.ts — this runs in the
// Nuxt test environment rather than the plain-node unit env.

describe('useQueue – source tracking (005 · T006)', () => {
  it('tags ad-hoc text rows as source "text" with no filename', () => {
    const q = useQueue()
    const item = q.addItem('hello')!
    expect(item.source).toBe('text')
    expect(item.sourceName).toBeUndefined()
  })

  it('tags uploaded rows as source "upload" carrying the filename', () => {
    const q = useQueue()
    q.addFromUpload('one\ntwo', 'notes.txt')
    const uploaded = q.items.value.filter((i) => i.source === 'upload')
    expect(uploaded).toHaveLength(2)
    expect(uploaded.every((i) => i.sourceName === 'notes.txt')).toBe(true)
  })
})

describe('useQueue – selection & active item (005 · T006)', () => {
  it('tracks the active item id (null by default)', () => {
    const q = useQueue()
    const a = q.addItem('x')!
    expect(q.activeId.value).toBeNull()
    q.activeId.value = a.clientId
    expect(q.activeId.value).toBe(a.clientId)
  })

  it('toggles a single row in and out of the checked set', () => {
    const q = useQueue()
    const a = q.addItem('a')!
    q.toggleChecked(a.clientId)
    expect(q.checkedIds.value.has(a.clientId)).toBe(true)
    q.toggleChecked(a.clientId)
    expect(q.checkedIds.value.has(a.clientId)).toBe(false)
  })

  it('toggleAll selects every given row, then clears when all are selected', () => {
    const q = useQueue()
    q.addItem('a')
    q.addItem('b')
    q.toggleAll(q.items.value)
    expect(q.checkedIds.value.size).toBe(2)
    q.toggleAll(q.items.value)
    expect(q.checkedIds.value.size).toBe(0)
  })

  it('removeMany drops rows and clears their selection/active state', () => {
    const q = useQueue()
    const a = q.addItem('a')!
    const b = q.addItem('b')!
    const c = q.addItem('c')!
    q.toggleChecked(a.clientId)
    q.toggleChecked(b.clientId)
    q.activeId.value = a.clientId
    q.removeMany([a.clientId, b.clientId])
    expect(q.items.value.map((i) => i.clientId)).toEqual([c.clientId])
    expect(q.checkedIds.value.size).toBe(0)
    expect(q.activeId.value).toBeNull()
  })
})

describe('useQueue – metadata stamping scoped to the generate target (005 · US2)', () => {
  it('stamps the shared form metadata only onto the rows being generated', () => {
    const q = useQueue()
    const a = q.addItem('a')!
    const b = q.addItem('b')!
    q.toggleChecked(a.clientId) // only A is targeted (checked-else-all → just A)
    q.metadata.value = { title: 'Shared' }

    q.applyMetadataToPending(q.generateTarget.value)

    expect(q.items.value.find((i) => i.clientId === a.clientId)!.metadata.title).toBe('Shared')
    // B isn't part of this run, so it must not be silently overwritten.
    expect(q.items.value.find((i) => i.clientId === b.clientId)!.metadata.title).toBeUndefined()
  })
})

describe('useQueue – client id fallback in non-secure contexts (005 · US2)', () => {
  it('still mints a unique id when crypto.randomUUID is unavailable (HTTP/LAN)', () => {
    const original = globalThis.crypto.randomUUID
    // Simulate a non-secure context where randomUUID is undefined.
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      const q = useQueue()
      const a = q.addItem('a')!
      const b = q.addItem('b')!
      expect(a.clientId).toMatch(/^[0-9a-f-]{36}$/i)
      expect(a.clientId).not.toBe(b.clientId)
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        value: original,
        configurable: true,
      })
    }
  })
})

describe('useQueue – search & filters (005 · US3 · T029)', () => {
  it('search narrows by item text and uploaded filename, case-insensitively', () => {
    const q = useQueue()
    const typed = q.addItem('Hello world')!
    q.addFromUpload('from a file', 'meeting-notes.txt')

    q.searchTerm.value = 'hello'
    expect(q.visibleItems.value.map((i) => i.clientId)).toEqual([typed.clientId])

    q.searchTerm.value = 'MEETING' // matches the uploaded row by its filename
    expect(q.visibleItems.value.map((i) => i.text)).toEqual(['from a file'])

    q.searchTerm.value = ''
    expect(q.visibleItems.value).toHaveLength(2)
  })

  it('filters by voice, format, album, recordedAt and language', () => {
    const q = useQueue()
    q.addItem('a')
    q.addItem('b')
    const [a, b] = q.items.value
    Object.assign(a!, {
      voiceId: 'alloy',
      format: 'mp3',
      metadata: { album: 'Briefing', recordedAt: '2026-06-24', languages: ['eng'] },
    })
    Object.assign(b!, {
      voiceId: 'echo',
      format: 'flac',
      metadata: { album: 'Notes', recordedAt: '2026-06-25', languages: ['hun'] },
    })

    q.filters.value = { voiceId: 'alloy' }
    expect(q.visibleItems.value.map((i) => i.clientId)).toEqual([a!.clientId])
    q.filters.value = { format: 'flac' }
    expect(q.visibleItems.value.map((i) => i.clientId)).toEqual([b!.clientId])
    q.filters.value = { album: 'Briefing' }
    expect(q.visibleItems.value.map((i) => i.clientId)).toEqual([a!.clientId])
    q.filters.value = { recordedAt: '2026-06-25' }
    expect(q.visibleItems.value.map((i) => i.clientId)).toEqual([b!.clientId])
    q.filters.value = { language: 'hun' }
    expect(q.visibleItems.value.map((i) => i.clientId)).toEqual([b!.clientId])

    q.filters.value = {}
    expect(q.visibleItems.value).toHaveLength(2)
  })

  it('stays responsive over a large queue (≥200 items, SC-003)', () => {
    const q = useQueue()
    for (let i = 0; i < 250; i++) q.addItem(`item ${i}`)
    const start = performance.now()
    q.searchTerm.value = 'item 1'
    const matches = q.visibleItems.value
    const elapsed = performance.now() - start
    expect(matches.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(100)
  })
})

describe('useQueue – generate target ignores search/filters (FR-005a)', () => {
  it('processes the entire queue (not just visible rows) when nothing is checked', () => {
    const q = useQueue()
    q.addItem('alpha')
    q.addItem('beta')

    // A search that hides "beta" must not shrink the generate target: with nothing
    // checked, FR-005a generates the entire queue regardless of the active filter.
    q.searchTerm.value = 'alpha'
    expect(q.visibleItems.value).toHaveLength(1)
    expect(q.generateTarget.value.map((i) => i.text).sort()).toEqual(['alpha', 'beta'])
  })

  it('still includes a checked row that the active filter hides', () => {
    const q = useQueue()
    const a = q.addItem('alpha')!
    q.addItem('beta')

    // Check "alpha", then search "beta" so only "beta" is visible and the checked
    // "alpha" row is filtered out of view. FR-005a still targets the checked row
    // even though it is no longer visible.
    q.toggleChecked(a.clientId)
    q.searchTerm.value = 'beta'
    expect(q.visibleItems.value.map((i) => i.clientId)).not.toContain(a.clientId)
    expect(q.generateTarget.value.map((i) => i.clientId)).toEqual([a.clientId])
  })
})

describe('useQueue – confirmed structured batch append (008 · US1)', () => {
  function inputs(): ResolvedQueueInput[] {
    return [
      {
        text: 'First imported row',
        voiceId: 'nova',
        model: 'gpt-4o-mini-tts',
        format: 'mp3',
        instructions: 'Speak clearly',
        metadata: {
          title: 'Imported title',
          track: '99',
          languages: ['eng'],
          customText: [{ description: 'Source', value: 'Batch' }],
        },
      },
      {
        text: 'Second imported row',
        voiceId: 'echo',
        model: 'tts-1-hd',
        format: 'flac',
        metadata: { artist: 'EchoRecall' },
      },
    ]
  }

  it('appends resolved values with fresh queue state, source, and filename', () => {
    const q = useQueue()
    const added = q.appendImported(inputs(), 'narráció.yaml', { metadataMode: 'structured' })

    expect(added).toHaveLength(2)
    expect(q.items.value).toEqual(added)
    expect(new Set(added.map((item) => item.clientId)).size).toBe(2)
    expect(added[0]).toMatchObject({
      text: 'First imported row',
      voiceId: 'nova',
      model: 'gpt-4o-mini-tts',
      format: 'mp3',
      instructions: 'Speak clearly',
      status: 'queued',
      source: 'upload',
      sourceName: 'narráció.yaml',
      metadataEdited: true,
    })
    expect(added[1]).toMatchObject({
      text: 'Second imported row',
      voiceId: 'echo',
      model: 'tts-1-hd',
      format: 'flac',
      status: 'queued',
      source: 'upload',
      sourceName: 'narráció.yaml',
      metadataEdited: true,
    })
    expect(added.every((item) => item.error === undefined && item.result === undefined)).toBe(true)
  })

  it('deep-clones metadata and preserves every existing row and its UI state', () => {
    const q = useQueue()
    const existing = q.addItem('Existing row')!
    existing.status = 'failed'
    existing.error = 'keep this failure'
    q.toggleChecked(existing.clientId)
    q.activeId.value = existing.clientId
    const existingSnapshot = { ...existing, metadata: { ...existing.metadata } }
    const resolved = inputs()

    const added = q.appendImported(resolved, 'batch.yaml', { metadataMode: 'structured' })

    expect(q.items.value[0]).toBe(existing)
    expect(q.items.value[0]).toEqual(existingSnapshot)
    expect(q.checkedIds.value.has(existing.clientId)).toBe(true)
    expect(q.activeId.value).toBe(existing.clientId)

    resolved[0]!.metadata.languages!.push('hun')
    resolved[0]!.metadata.customText![0]!.value = 'Mutated after append'
    expect(added[0]!.metadata.languages).toEqual(['eng'])
    expect(added[0]!.metadata.customText).toEqual([{ description: 'Source', value: 'Batch' }])
  })

  it('retains imported Title while Track remains derived from current queue order', () => {
    const q = useQueue()
    q.addItem('Existing row')
    const [imported] = q.appendImported([inputs()[0]!], 'batch.yaml', {
      metadataMode: 'structured',
    })

    q.stampDerivedMetadata([imported!], 5)

    expect(imported!.metadata.title).toBe('Imported title')
    expect(imported!.metadata.track).toBe('6')
  })
})
