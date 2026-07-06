import { describe, expect, it } from 'vitest'
import { computed, ref, watch } from 'vue'
import { useQueue } from '../../app/composables/useQueue'

// 007 · Generate derives Title + Track rather than exposing them as editable fields. Right
// before generation `stampDerivedMetadata` fills each target row's:
//   - Title: the row's text chopped at the first line break (multi-line text keeps only its
//     first line), then the first 120 characters of that line, ellipsised when longer, filled
//     only when the row has no title (an imported title survives).
//   - Track: the row's 1-based position in the full queue (what the QueuePanel shows), always
//     refreshed.
//
// useQueue relies on Nuxt auto-imports (ref/computed/watch); shim them onto globalThis, node env.
const g = globalThis as unknown as Record<string, unknown>
g.ref = ref
g.computed = computed
g.watch = watch

describe('useQueue derived Title (007)', () => {
  it('uses the full text as the title when it is 120 characters or fewer', () => {
    const q = useQueue()
    const a = q.addItem('Short line of narration')!
    q.stampDerivedMetadata(q.items.value)
    expect(a.metadata.title).toBe('Short line of narration')
  })

  it('chops at the first line break, discarding the rest of the text', () => {
    const q = useQueue()
    const a = q.addItem('First line\nSecond line\n\nThird line')!
    q.stampDerivedMetadata(q.items.value)
    expect(a.metadata.title).toBe('First line')
  })

  it('uses the full text as the title at exactly 120 characters (no ellipsis)', () => {
    const q = useQueue()
    const text = 'x'.repeat(120)
    const a = q.addItem(text)!
    q.stampDerivedMetadata(q.items.value)
    expect(a.metadata.title).toBe(text)
  })

  it('truncates to the first 120 characters and appends an ellipsis when longer', () => {
    const q = useQueue()
    const text = 'x'.repeat(121)
    const a = q.addItem(text)!
    q.stampDerivedMetadata(q.items.value)
    expect(a.metadata.title).toBe(`${'x'.repeat(120)}…`)
    expect(a.metadata.title!.length).toBe(121) // 120 chars + the single ellipsis glyph
  })

  it('fills the title only when empty; never overwrites an existing title', () => {
    const q = useQueue()
    const a = q.addItem('some text')!
    q.updateItem(a.clientId, { metadata: { title: 'Kept Title' } })
    q.stampDerivedMetadata(q.items.value)
    expect(a.metadata.title).toBe('Kept Title')
  })
})

describe('useQueue derived Track (007)', () => {
  it('stamps each row with its 1-based queue position', () => {
    const q = useQueue()
    const a = q.addItem('a')!
    const b = q.addItem('b')!
    const c = q.addItem('c')!
    q.stampDerivedMetadata(q.items.value)
    expect(a.metadata.track).toBe('1')
    expect(b.metadata.track).toBe('2')
    expect(c.metadata.track).toBe('3')
  })

  it('reflects queue position even when only a subset (the generate target) is stamped', () => {
    const q = useQueue()
    q.addItem('a')!
    const b = q.addItem('b')!
    q.addItem('c')!
    // Only the second row is checked → the generate target is just that row, but its track
    // still reflects its position in the full queue (2), not "1".
    q.toggleChecked(b.clientId)
    q.stampDerivedMetadata(q.generateTarget.value)
    expect(b.metadata.track).toBe('2')
  })

  it('always refreshes the track, overwriting any prior value', () => {
    const q = useQueue()
    const a = q.addItem('a')!
    q.updateItem(a.clientId, { metadata: { track: '99' } })
    q.stampDerivedMetadata(q.items.value)
    expect(a.metadata.track).toBe('1')
  })

  it('offsets each track by the configured start number (default 1)', () => {
    const q = useQueue()
    const a = q.addItem('a')!
    const b = q.addItem('b')!
    const c = q.addItem('c')!
    // Start number 5 → the first row is track 5, and later rows increment from there.
    q.stampDerivedMetadata(q.items.value, 5)
    expect(a.metadata.track).toBe('5')
    expect(b.metadata.track).toBe('6')
    expect(c.metadata.track).toBe('7')
  })

  it('adds the start number to the full-queue position when stamping a subset', () => {
    const q = useQueue()
    q.addItem('a')!
    const b = q.addItem('b')!
    q.addItem('c')!
    // Only the second row is the target; its track is its full-queue position (1) + start (10).
    q.toggleChecked(b.clientId)
    q.stampDerivedMetadata(q.generateTarget.value, 10)
    expect(b.metadata.track).toBe('11')
  })
})
