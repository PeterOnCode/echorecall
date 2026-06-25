import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { computed, ref, watch } from 'vue'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import { LibraryService } from '../../src/core/library/library-service'
import { FileAudioStore } from '../../src/core/library/audio-store'
import { toGenerationDto } from '../../server/utils/serialize'
import { useLibrary } from '../../app/composables/useLibrary'
import type { Metadata } from '../../src/core/shared/types'

// 006 · US4 / R-BULK (FR-015/FR-016) — bulk delete + bulk tag edit are client-side
// orchestration over the existing per-item endpoints. Integration: drive
// useLibrary.removeMany / bulkRetag against the REAL LibraryService (SQLite +
// updateMetadata/delete) via a $fetch shim. removeMany deletes then reloads once;
// bulkRetag overwrites one field across the selection and reports succeeded/failed.

const g = globalThis as unknown as Record<string, unknown>
g.ref = ref
g.computed = computed
g.watch = watch
g.useI18n = () => ({ t: (k: string) => k })

let service: LibraryService

beforeEach(() => {
  const repo = new SqliteGenerationRepository(':memory:')
  ;(['a', 'b', 'c'] as const).forEach((id) =>
    repo.insert({
      id,
      text: `${id} source`,
      voiceId: 'alloy',
      model: null,
      format: 'mp3',
      speed: null,
      createdAt: `2026-06-1${id === 'a' ? 0 : id === 'b' ? 1 : 2}T10:00:00.000Z`,
      path: `audio/${id}.mp3`,
      metadata: { title: id.toUpperCase(), genre: 'Speech' },
    }),
  )
  service = new LibraryService(repo, new FileAudioStore('/tmp'))
  g.$fetch = async (
    url: string,
    opts?: { method?: string; query?: Record<string, unknown>; body?: { metadata?: Metadata } },
  ) => {
    const method = opts?.method ?? 'GET'
    if (url === '/api/generations') {
      const page = Number(opts?.query?.page ?? 1)
      const pageSize = Number(opts?.query?.pageSize ?? 20)
      const { rows, total } = service.list({ page, pageSize, sort: 'createdAt', order: 'asc' })
      return { generations: rows.map((r) => toGenerationDto(r)), total, page, pageSize }
    }
    const id = url.split('/').pop()!
    if (method === 'DELETE') {
      await service.delete(id) // throws NotFound for unknown ids
      return {}
    }
    if (method === 'PATCH') {
      return toGenerationDto(await service.updateMetadata(id, opts?.body?.metadata ?? {}))
    }
    return {}
  }
})
afterEach(() => {
  delete g.$fetch
})

describe('bulk delete (R-BULK)', () => {
  it('removes every selected id and reloads once', async () => {
    const lib = useLibrary()
    lib.query.value = { sort: 'createdAt', order: 'asc', page: 1, pageSize: 20 }
    await lib.load()
    await lib.removeMany(['a', 'b'])
    expect(lib.items.value.map((i) => i.id)).toEqual(['c'])
    expect(lib.total.value).toBe(1)
  })
})

describe('bulk tag edit (R-BULK)', () => {
  it('overwrites one field across the selection (other tags preserved)', async () => {
    const lib = useLibrary()
    lib.query.value = { sort: 'createdAt', order: 'asc', page: 1, pageSize: 20 }
    await lib.load()
    const res = await lib.bulkRetag(['a', 'c'], 'genre', 'Jazz')
    expect(res).toEqual({ succeeded: 2, failed: [] })
    await lib.load()
    const a = lib.items.value.find((i) => i.id === 'a')!
    expect(a.metadata.genre).toBe('Jazz')
    expect(a.metadata.title).toBe('A') // untouched
  })

  it('reports per-id failures while applying the rest', async () => {
    const lib = useLibrary()
    lib.query.value = { sort: 'createdAt', order: 'asc', page: 1, pageSize: 20 }
    await lib.load()
    const res = await lib.bulkRetag(['a', 'nope'], 'genre', 'Jazz')
    expect(res.succeeded).toBe(1)
    expect(res.failed).toEqual(['nope'])
  })
})
