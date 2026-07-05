import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ref, watch } from 'vue'
import { useViewPreferences } from '../../app/composables/useViewPreferences'

// 007 · Configure Visible Fields — the Generate metadata field set added to
// useViewPreferences: an ORDERED, toggleable set (each id 1:1 with a Metadata key) that
// persists to localStorage, merges stored-over-defaults (new ids default visible), and
// enforces a not-all-hidden guard. Node-env unit test: shim the Vue reactivity auto-imports
// and provide an in-memory localStorage (SSR-safe).

const g = globalThis as unknown as Record<string, unknown>
g.ref = ref
g.watch = watch

class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  clear(): void {
    this.store.clear()
  }
}

beforeEach(() => {
  g.localStorage = new MemoryStorage()
})
afterEach(() => {
  delete g.localStorage
})

const METADATA_IDS = [
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

describe('useViewPreferences – metadata fields (007)', () => {
  it('exposes the 10 toggleable metadata fields as an ordered array, all visible by default', () => {
    const { metadataFields } = useViewPreferences()
    expect(metadataFields.value.map((f) => f.id)).toEqual(METADATA_IDS)
    expect(metadataFields.value.every((f) => f.visible)).toBe(true)
  })

  it('persists visibility + order and restores them for a fresh instance', () => {
    const { metadataFields, setMetadataFields } = useViewPreferences()
    // Hide one field and move it to the front (a reorder + a toggle in one commit).
    setMetadataFields([
      { id: 'comment' as const, visible: false },
      ...metadataFields.value.filter((f) => f.id !== 'comment'),
    ])
    const fresh = useViewPreferences()
    expect(fresh.metadataFields.value[0]).toEqual({ id: 'comment', visible: false })
    expect(fresh.metadataFields.value.find((f) => f.id === 'comment')!.visible).toBe(false)
  })

  it('refuses a commit that would hide every field (not-all-hidden guard)', () => {
    const { metadataFields, setMetadataFields } = useViewPreferences()
    setMetadataFields(metadataFields.value.map((f) => ({ ...f, visible: false })))
    expect(metadataFields.value.some((f) => f.visible)).toBe(true)
  })

  it('resets to the default ordered, all-visible set', () => {
    const { metadataFields, setMetadataFields, resetMetadataFields } = useViewPreferences()
    setMetadataFields([
      { id: 'title' as const, visible: false },
      ...metadataFields.value.filter((f) => f.id !== 'title'),
    ])
    resetMetadataFields()
    expect(metadataFields.value.map((f) => f.id)).toEqual(METADATA_IDS)
    expect(metadataFields.value.every((f) => f.visible)).toBe(true)
  })

  it('falls back to defaults without localStorage (no throw, SSR-safe)', () => {
    delete g.localStorage
    expect(() => {
      const { metadataFields } = useViewPreferences()
      expect(metadataFields.value).toHaveLength(METADATA_IDS.length)
    }).not.toThrow()
  })
})
