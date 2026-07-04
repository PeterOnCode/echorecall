import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { computed, ref, watch } from 'vue'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import { LibraryService } from '../../src/core/library/library-service'
import { FileAudioStore } from '../../src/core/library/audio-store'
import { toGenerationDto } from '../../server/utils/serialize'
import { useLibrary } from '../../app/composables/useLibrary'
import type { NewGenerationRecord } from '../../src/core/library/repository'

// 006 · US1 / R-NAV (SC-002) — cross-page Previous/Next over the filtered result set.
// Integration: drive useLibrary's nav against the REAL server-side pagination
// (SqliteGenerationRepository + LibraryService.list, serialized exactly as the route
// does) via a $fetch shim. Proves Prev/Next reach EVERY recording across page
// boundaries and disable only at the global first/last — not just within one page.

const g = globalThis as unknown as Record<string, unknown>
g.ref = ref
g.computed = computed
g.watch = watch
g.useI18n = () => ({ t: (k: string) => k })

let service: LibraryService

function rec(id: string, createdAt: string): NewGenerationRecord {
  return {
    id,
    text: 't',
    voiceId: 'alloy',
    model: null,
    format: 'mp3',
    speed: null,
    createdAt,
    path: `audio/${id}.mp3`,
    metadata: {},
  }
}

beforeEach(() => {
  const repo = new SqliteGenerationRepository(':memory:')
  // 5 rows with strictly increasing createdAt → deterministic asc order a..e.
  ;['a', 'b', 'c', 'd', 'e'].forEach((id, i) => repo.insert(rec(id, `2026-06-1${i}T10:00:00.000Z`)))
  service = new LibraryService(repo, new FileAudioStore('/tmp'))
  g.$fetch = async (url: string, opts?: { query?: Record<string, unknown> }) => {
    if (url === '/api/generations') {
      const page = Number(opts?.query?.page ?? 1)
      const pageSize = Number(opts?.query?.pageSize ?? 20)
      const { rows, total } = service.list({ page, pageSize, sort: 'createdAt', order: 'asc' })
      return { generations: rows.map((r) => toGenerationDto(r)), total, page, pageSize }
    }
    return {}
  }
})
afterEach(() => {
  delete g.$fetch
})

describe('cross-page Previous/Next (SC-002)', () => {
  it('Next reaches every recording across page boundaries and disables at the global last', async () => {
    const lib = useLibrary()
    lib.query.value = { sort: 'createdAt', order: 'asc', page: 1, pageSize: 2 }
    await lib.load()
    expect(lib.items.value.map((i) => i.id)).toEqual(['a', 'b'])
    expect(lib.hasPrev('a')).toBe(false)

    let active: string | null = 'a'
    const visited = [active]
    while (lib.hasNext(active)) {
      active = await lib.gotoNext(active)
      visited.push(active)
    }
    expect(visited).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(lib.hasNext('e')).toBe(false)
  })

  it('Prev walks back across boundaries to the global first and disables there', async () => {
    const lib = useLibrary()
    lib.query.value = { sort: 'createdAt', order: 'asc', page: 3, pageSize: 2 }
    await lib.load()
    expect(lib.items.value.map((i) => i.id)).toEqual(['e'])

    let active: string | null = 'e'
    const visited = [active]
    while (lib.hasPrev(active)) {
      active = await lib.gotoPrev(active)
      visited.push(active)
    }
    expect(visited).toEqual(['e', 'd', 'c', 'b', 'a'])
    expect(lib.hasPrev('a')).toBe(false)
  })
})
