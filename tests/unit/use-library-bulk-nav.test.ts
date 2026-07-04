import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, watch } from 'vue'
import { useLibrary } from '../../app/composables/useLibrary'
import type { LibraryItem } from '../../app/composables/useLibrary'

// 006 · R-BULK + R-NAV — thin client-side wrappers over the existing per-item
// endpoints, plus cross-page Previous/Next over the filtered result set. No new
// server route. Node-env unit test: shim the Vue reactivity + Nuxt auto-imports and
// fake $fetch with a small in-memory, paged store.

const g = globalThis as unknown as Record<string, unknown>
g.ref = ref
g.computed = computed
g.watch = watch
g.useI18n = () => ({ t: (k: string) => k })

function mk(id: string, over: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id,
    text: 't',
    voiceId: 'alloy',
    model: null,
    format: 'mp3',
    speed: null,
    createdAt: '2026-06-15T10:00:00.000Z',
    filename: `${id}.mp3`,
    audioUrl: `/api/library/${id}/audio`,
    metadata: {},
    ...over,
  }
}

let store: LibraryItem[] = []
let failPatchFor: string | null = null
let failGetFor: string | null = null

/** A paged in-memory backend for $fetch (GET list / PATCH retag / DELETE). */
function installFetch() {
  g.$fetch = vi.fn(async (url: string, opts?: { method?: string; query?: Record<string, unknown>; body?: { metadata?: Record<string, unknown> } }) => {
    const method = opts?.method ?? 'GET'
    if (url === '/api/generations') {
      const page = Number(opts?.query?.page ?? 1)
      const pageSize = Number(opts?.query?.pageSize ?? 20)
      const start = (page - 1) * pageSize
      return { generations: store.slice(start, start + pageSize), total: store.length, page, pageSize }
    }
    const id = url.split('/').pop()!
    if (method === 'DELETE') {
      store = store.filter((x) => x.id !== id)
      return {}
    }
    if (method === 'PATCH') {
      if (failPatchFor === id) throw new Error('retag failed')
      const idx = store.findIndex((x) => x.id === id)
      const updated = { ...store[idx]!, metadata: { ...(opts?.body?.metadata ?? {}) } } as LibraryItem
      store[idx] = updated
      return updated
    }
    // GET /api/generations/:id — a single recording (used by bulkRetag to read the
    // current tags of an off-page selection so a wholesale retag preserves them).
    if (method === 'GET') {
      if (failGetFor === id) throw new Error('not found')
      const item = store.find((x) => x.id === id)
      return item ? { ...item, metadata: { ...item.metadata } } : {}
    }
    return {}
  })
}

beforeEach(() => {
  failPatchFor = null
  failGetFor = null
  installFetch()
})
afterEach(() => {
  delete g.$fetch
})

describe('useLibrary.removeMany (R-BULK)', () => {
  it('deletes every id then reloads once so total/pagination stay correct', async () => {
    store = [mk('a'), mk('b'), mk('c')]
    const lib = useLibrary()
    await lib.load()
    await lib.removeMany(['a', 'b'])
    expect(store.map((x) => x.id)).toEqual(['c'])
    expect(lib.items.value.map((x) => x.id)).toEqual(['c'])
    expect(lib.total.value).toBe(1)
  })
})

describe('useLibrary.bulkRetag (R-BULK)', () => {
  it('overwrites one field across the selection and reports succeeded/failed', async () => {
    store = [mk('a', { metadata: { title: 'A' } }), mk('b', { metadata: { title: 'B' } })]
    const lib = useLibrary()
    await lib.load()
    const res = await lib.bulkRetag(['a', 'b'], 'genre', 'Podcast')
    expect(res).toEqual({ succeeded: 2, failed: [] })
    expect(store.find((x) => x.id === 'a')!.metadata.genre).toBe('Podcast')
    // Existing fields on each row are preserved (merge, not wholesale wipe).
    expect(store.find((x) => x.id === 'a')!.metadata.title).toBe('A')
  })

  it('can target an extra (R-TAGS) field such as encodedBy', async () => {
    store = [mk('a', { metadata: { title: 'A' } })]
    const lib = useLibrary()
    await lib.load()
    await lib.bulkRetag(['a'], 'encodedBy', 'kid3')
    expect(store.find((x) => x.id === 'a')!.metadata.encodedBy).toBe('kid3')
  })

  it('collects per-id failures while applying the rest', async () => {
    store = [mk('a', { metadata: {} }), mk('b', { metadata: {} })]
    failPatchFor = 'b'
    const lib = useLibrary()
    await lib.load()
    const res = await lib.bulkRetag(['a', 'b'], 'genre', 'Speech')
    expect(res.succeeded).toBe(1)
    expect(res.failed).toEqual(['b'])
    expect(store.find((x) => x.id === 'a')!.metadata.genre).toBe('Speech')
  })

  // Regression: selectedIds persists across pages, so a bulk edit can include rows
  // that are NOT on the loaded page. `items.value.find` misses those, and a wholesale
  // retag with only the edited field would wipe their other tags (data loss).
  it('preserves the other tags of rows that are not on the loaded page', async () => {
    store = [
      mk('a', { metadata: { title: 'A', artist: 'X' } }),
      mk('b', { metadata: { title: 'B', artist: 'Y' } }),
      mk('c', { metadata: { title: 'C', artist: 'Z' } }),
    ]
    const lib = useLibrary()
    lib.query.value = { ...lib.query.value, page: 1, pageSize: 2 }
    await lib.load() // loads 'a','b' — 'c' lives on page 2
    const res = await lib.bulkRetag(['a', 'c'], 'genre', 'Speech')
    expect(res).toEqual({ succeeded: 2, failed: [] })
    // Off-page 'c' keeps title/artist and gains genre (NOT collapsed to { genre }).
    expect(store.find((x) => x.id === 'c')!.metadata).toEqual({ title: 'C', artist: 'Z', genre: 'Speech' })
    expect(store.find((x) => x.id === 'a')!.metadata).toEqual({ title: 'A', artist: 'X', genre: 'Speech' })
  })

  it('reports an off-page id as failed (never wipes) when its current tags cannot be read', async () => {
    store = [
      mk('a', { metadata: { title: 'A' } }),
      mk('b'),
      mk('c', { metadata: { title: 'C', artist: 'Z' } }),
    ]
    failGetFor = 'c'
    const lib = useLibrary()
    lib.query.value = { ...lib.query.value, page: 1, pageSize: 2 }
    await lib.load()
    const res = await lib.bulkRetag(['a', 'c'], 'genre', 'Speech')
    expect(res.succeeded).toBe(1)
    expect(res.failed).toEqual(['c'])
    // 'c' is left untouched — a fetch failure must not overwrite its tags.
    expect(store.find((x) => x.id === 'c')!.metadata).toEqual({ title: 'C', artist: 'Z' })
  })
})

describe('useLibrary cross-page Prev/Next (R-NAV)', () => {
  async function seed5() {
    store = ['a', 'b', 'c', 'd', 'e'].map((id) => mk(id))
    const lib = useLibrary()
    lib.query.value = { ...lib.query.value, page: 1, pageSize: 2 }
    await lib.load()
    return lib
  }

  it('disables Prev at the global first row and Next at the global last row', async () => {
    const lib = await seed5()
    expect(lib.hasPrev('a')).toBe(false)
    expect(lib.hasNext('a')).toBe(true)
    // Jump to the final page to check the global-last bound.
    lib.query.value = { ...lib.query.value, page: 3 }
    await lib.load()
    expect(lib.items.value.map((x) => x.id)).toEqual(['e'])
    expect(lib.hasNext('e')).toBe(false)
    expect(lib.hasPrev('e')).toBe(true)
  })

  it('Next at a page boundary loads the next page and selects its first row', async () => {
    const lib = await seed5()
    const nextId = await lib.gotoNext('b') // 'b' is the last row of page 1
    expect(lib.items.value.map((x) => x.id)).toEqual(['c', 'd'])
    expect(nextId).toBe('c')
  })

  it('Prev at a page boundary loads the previous page and selects its last row', async () => {
    const lib = await seed5()
    lib.query.value = { ...lib.query.value, page: 2 }
    await lib.load()
    const prevId = await lib.gotoPrev('c') // 'c' is the first row of page 2
    expect(lib.items.value.map((x) => x.id)).toEqual(['a', 'b'])
    expect(prevId).toBe('b')
  })

  it('within a page, Next/Prev move by index without refetching', async () => {
    const lib = await seed5()
    const fetchCalls = (g.$fetch as ReturnType<typeof vi.fn>).mock.calls.length
    expect(await lib.gotoNext('a')).toBe('b')
    expect((g.$fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchCalls)
  })
})
