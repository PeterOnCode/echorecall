import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { useQueue } from '../../app/composables/useQueue'

// 007 · US6 (T043 / FR-020): recording date defaults to the GENERATION day, not add time.
// makeItem no longer pre-stamps a date (dropping the 005 tomorrowIso default that
// applyMetadataToPending clobbered anyway); instead `stampRecordingDates` fills today's
// local-day date on each target row that still has none, right before generation. A
// user-set recordedAt is never overwritten. Resolves the 005 clobber.
//
// useQueue relies on Nuxt auto-imports (ref/computed); shim them onto globalThis, node env.
const g = globalThis as unknown as Record<string, unknown>
g.ref = ref
g.computed = computed

/** Today as a local-day YYYY-MM-DD string (matches the composable's todayIso). */
function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

describe('useQueue recording-date default → today (US6)', () => {
  it('makeItem no longer stamps a default recordedAt', () => {
    const q = useQueue()
    const a = q.addItem('a')!
    expect(a.metadata.recordedAt).toBeUndefined()
  })

  it('stamps today only on rows whose recordedAt is empty; never overwrites a user date', () => {
    const q = useQueue()
    const a = q.addItem('a')!
    const b = q.addItem('b')!
    q.updateItem(b.clientId, { metadata: { recordedAt: '2020-01-01' } })

    q.stampRecordingDates(q.items.value)

    expect(a.metadata.recordedAt).toBe(todayIso())
    expect(b.metadata.recordedAt).toBe('2020-01-01')
  })

  it('treats an empty-string recordedAt as unset', () => {
    const q = useQueue()
    q.metadata.value = { recordedAt: '' }
    const a = q.addItem('a')!
    expect(a.metadata.recordedAt).toBe('')

    q.stampRecordingDates([a])
    expect(a.metadata.recordedAt).toBe(todayIso())
  })

  it('stamps each row in a multi-item run independently', () => {
    const q = useQueue()
    const a = q.addItem('a')!
    const b = q.addItem('b')!
    q.updateItem(b.clientId, { metadata: { recordedAt: '2019-05-05' } })
    const c = q.addItem('c')!

    q.stampRecordingDates(q.items.value)

    expect(a.metadata.recordedAt).toBe(todayIso())
    expect(b.metadata.recordedAt).toBe('2019-05-05')
    expect(c.metadata.recordedAt).toBe(todayIso())
  })
})
