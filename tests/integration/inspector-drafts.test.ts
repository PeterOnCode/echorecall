import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { computed, ref, watch } from 'vue'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import { LibraryService } from '../../src/core/library/library-service'
import { FileAudioStore } from '../../src/core/library/audio-store'
import { toGenerationDto } from '../../server/utils/serialize'
import { useLibrary } from '../../app/composables/useLibrary'
import { useTagDrafts } from '../../app/composables/useTagDrafts'
import type { Metadata } from '../../src/core/shared/types'

// 006 · US5 / R-DRAFTS + R-TAGS (FR-019/SC-010) — the inspector's staged-edit buffer.
// Integration: drive useTagDrafts against the REAL LibraryService (SQLite, no tagger →
// extras persist purely through the tags_extra JSON pack/hydrate) via a $fetch shim.
// Asserts (1) explicit Save commits an EXTRA field (Album Artist) that round-trips on
// reload with no migration (SC-010), and (2) editing one recording, switching away
// without saving, and returning RESTORES the staged edits (auto-preserve, Q4).

const g = globalThis as unknown as Record<string, unknown>
g.ref = ref
g.computed = computed
g.watch = watch
g.useI18n = () => ({ t: (k: string) => k })

let service: LibraryService

beforeEach(() => {
  const repo = new SqliteGenerationRepository(':memory:')
  ;(['a', 'b'] as const).forEach((id) =>
    repo.insert({
      id,
      text: `${id} source`,
      voiceId: 'alloy',
      model: null,
      format: 'mp3',
      speed: null,
      createdAt: `2026-06-1${id === 'a' ? 0 : 1}T10:00:00.000Z`,
      path: `audio/${id}.mp3`,
      metadata: { title: id.toUpperCase() },
    }),
  )
  // No tagger → updateMetadata persists straight to the repo (the file is never touched),
  // so the extra fields round-trip through the tags_extra JSON column (no migration).
  service = new LibraryService(repo, new FileAudioStore('/tmp'))
  g.$fetch = async (
    url: string,
    opts?: { method?: string; query?: Record<string, unknown>; body?: { filename?: string; metadata?: Metadata } },
  ) => {
    const method = opts?.method ?? 'GET'
    if (url === '/api/generations') {
      const page = Number(opts?.query?.page ?? 1)
      const pageSize = Number(opts?.query?.pageSize ?? 20)
      const { rows, total } = service.list({ page, pageSize, sort: 'createdAt', order: 'asc' })
      return { generations: rows.map((r) => toGenerationDto(r)), total, page, pageSize }
    }
    const id = url.split('/').pop()!
    if (method === 'PATCH') {
      return toGenerationDto(await service.updateMetadata(id, opts?.body?.metadata ?? {}))
    }
    return {}
  }
})
afterEach(() => {
  delete g.$fetch
})

async function loadLibrary() {
  const lib = useLibrary()
  lib.query.value = { sort: 'createdAt', order: 'asc', page: 1, pageSize: 20 }
  await lib.load()
  return lib
}

describe('inspector drafts (R-DRAFTS / R-TAGS)', () => {
  it('explicit Save commits an extra field that round-trips on reload (SC-010)', async () => {
    const lib = await loadLibrary()
    const drafts = useTagDrafts({ update: lib.update })

    const itemA = lib.items.value.find((i) => i.id === 'a')!
    const draft = drafts.draftFor('a', itemA)
    draft.metadata = { ...draft.metadata, albumArtist: 'The Band' }
    expect(drafts.isDirty('a')).toBe(true)

    const result = await drafts.commit('a')
    expect(result.ok).toBe(true)
    expect(drafts.isDirty('a')).toBe(false)

    await lib.load()
    expect(lib.items.value.find((i) => i.id === 'a')!.metadata.albumArtist).toBe('The Band')
    // Untouched dedicated field survives the retag.
    expect(lib.items.value.find((i) => i.id === 'a')!.metadata.title).toBe('A')
  })

  it('auto-preserves staged edits across a selection change and restores them (Q4)', async () => {
    const lib = await loadLibrary()
    const drafts = useTagDrafts({ update: lib.update })
    const itemA = lib.items.value.find((i) => i.id === 'a')!
    const itemB = lib.items.value.find((i) => i.id === 'b')!

    const draftA = drafts.draftFor('a', itemA)
    draftA.metadata = { ...draftA.metadata, title: 'Edited A' }
    expect(drafts.isDirty('a')).toBe(true)

    // Switch selection to B without saving A.
    drafts.draftFor('b', itemB)

    // Return to A — the SAME staged buffer is restored (no discard, no prompt).
    const draftAagain = drafts.draftFor('a', itemA)
    expect(draftAagain.metadata.title).toBe('Edited A')
    expect(drafts.isDirty('a')).toBe(true)
  })

  it('committing a clean draft is a no-op success', async () => {
    const lib = await loadLibrary()
    const drafts = useTagDrafts({ update: lib.update })
    drafts.draftFor('a', lib.items.value.find((i) => i.id === 'a')!)
    expect(drafts.isDirty('a')).toBe(false)
    expect(await drafts.commit('a')).toEqual({ ok: true })
  })
})
