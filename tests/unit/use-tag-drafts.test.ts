import { describe, expect, it, vi } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { useTagDrafts } from '../../app/composables/useTagDrafts'
import type { LibraryItem } from '../../app/composables/useLibrary'

// 006 · R-DRAFTS — an in-memory, session-scoped per-recording staged-edit (dirty)
// buffer. The inspector edits the draft for the active recording; switching
// selection AUTO-PRESERVES the staged edits (Q4 — no prompt) and returning restores
// them. Explicit Save commits the active recording's draft via the injected
// `update` (the page wires useLibrary.update) and clears it on success. Node-env
// unit test: shim the Vue reactivity auto-imports.

const g = globalThis as unknown as Record<string, unknown>
g.ref = ref
g.computed = computed
g.reactive = reactive

function item(over: Partial<LibraryItem> & { id: string }): LibraryItem {
  return {
    id: over.id,
    text: 't',
    voiceId: 'alloy',
    model: null,
    format: 'mp3',
    speed: null,
    createdAt: '2026-06-15T10:00:00.000Z',
    filename: `${over.id}.mp3`,
    audioUrl: `/api/library/${over.id}/audio`,
    metadata: {},
    ...over,
  }
}

describe('useTagDrafts', () => {
  it('starts clean: a freshly seeded draft is not dirty', () => {
    const { draftFor, isDirty, dirtyCount } = useTagDrafts({ update: vi.fn() })
    const it1 = item({ id: '1', filename: 'a.mp3', metadata: { title: 'A' } })
    const draft = draftFor('1', it1)
    expect(draft.filenameBase).toBe('a')
    expect(draft.metadata.title).toBe('A')
    expect(isDirty('1')).toBe(false)
    expect(dirtyCount.value).toBe(0)
  })

  it('marks an id dirty once a field diverges from the saved value', () => {
    const { draftFor, isDirty, dirtyCount } = useTagDrafts({ update: vi.fn() })
    const draft = draftFor('1', item({ id: '1', metadata: { title: 'A' } }))
    draft.metadata.title = 'Changed'
    expect(isDirty('1')).toBe(true)
    expect(dirtyCount.value).toBe(1)
  })

  it('tracks a filename (base) edit as dirty', () => {
    const { draftFor, isDirty } = useTagDrafts({ update: vi.fn() })
    const draft = draftFor('1', item({ id: '1', filename: 'a.mp3' }))
    draft.filenameBase = 'renamed'
    expect(isDirty('1')).toBe(true)
  })

  it('auto-preserves staged edits across a selection switch and restores them on return', () => {
    const { draftFor } = useTagDrafts({ update: vi.fn() })
    const it1 = item({ id: '1', metadata: { title: 'A' } })
    const it2 = item({ id: '2', metadata: { title: 'B' } })
    const d1 = draftFor('1', it1)
    d1.metadata.title = 'A-edited'
    // Switch away…
    draftFor('2', it2)
    // …and back: the same staged edit is restored (Q4 auto-preserve, no prompt).
    const d1again = draftFor('1', it1)
    expect(d1again.metadata.title).toBe('A-edited')
  })

  it('counts multiple dirty recordings simultaneously', () => {
    const { draftFor, dirtyCount } = useTagDrafts({ update: vi.fn() })
    draftFor('1', item({ id: '1', metadata: { title: 'A' } })).metadata.title = 'A2'
    draftFor('2', item({ id: '2', metadata: { title: 'B' } })).metadata.title = 'B2'
    expect(dirtyCount.value).toBe(2)
  })

  it('commit sends only the changed parts and clears the draft on success', async () => {
    const update = vi.fn(async () => ({ id: '1' }))
    const { draftFor, isDirty, commit } = useTagDrafts({ update })
    const draft = draftFor('1', item({ id: '1', filename: 'a.mp3', metadata: { title: 'A' } }))
    draft.metadata.title = 'A2'
    const res = await commit('1')
    expect(res.ok).toBe(true)
    expect(update).toHaveBeenCalledWith('1', { metadata: { title: 'A2' } })
    expect(isDirty('1')).toBe(false)
  })

  it('commit includes a renamed filename when the base changed', async () => {
    const update = vi.fn(async () => ({ id: '1' }))
    const { draftFor, commit } = useTagDrafts({ update })
    const draft = draftFor('1', item({ id: '1', filename: 'a.mp3', metadata: { title: 'A' } }))
    draft.filenameBase = 'renamed'
    await commit('1')
    expect(update).toHaveBeenCalledWith('1', { filename: 'renamed' })
  })

  it('commit keeps the draft (stays dirty) when the update fails', async () => {
    const update = vi.fn(async () => undefined) // useLibrary.update returns undefined on failure
    const { draftFor, isDirty, commit } = useTagDrafts({ update })
    draftFor('1', item({ id: '1', metadata: { title: 'A' } })).metadata.title = 'A2'
    const res = await commit('1')
    expect(res.ok).toBe(false)
    expect(isDirty('1')).toBe(true)
  })

  it('discard drops the staged edit so a re-seed returns the saved values', () => {
    const { draftFor, isDirty, discard } = useTagDrafts({ update: vi.fn() })
    const it1 = item({ id: '1', metadata: { title: 'A' } })
    draftFor('1', it1).metadata.title = 'A2'
    discard('1')
    expect(isDirty('1')).toBe(false)
    expect(draftFor('1', it1).metadata.title).toBe('A')
  })

  it('a no-op commit (nothing changed) reports ok without calling update', async () => {
    const update = vi.fn(async () => ({ id: '1' }))
    const { draftFor, commit } = useTagDrafts({ update })
    draftFor('1', item({ id: '1', metadata: { title: 'A' } }))
    const res = await commit('1')
    expect(res.ok).toBe(true)
    expect(update).not.toHaveBeenCalled()
  })
})
