import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ref, watch } from 'vue'
import { useViewPreferences } from '../../app/composables/useViewPreferences'

// 006 · R-COLUMNS — the Library view preferences added to useViewPreferences: an
// ORDERED, toggleable file-table column set (Filename is always-on and NOT in the
// set) and an ORDERED, toggleable inspector field set (Name is always-on and NOT in
// the set). Both persist to localStorage, merge stored-over-defaults (new ids
// default visible), and enforce a not-all-hidden guard. Node-env unit test: shim the
// Vue reactivity auto-imports and provide an in-memory localStorage (SSR-safe).

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

const LIBRARY_IDS = [
  'title',
  'artist',
  'album',
  'year',
  'track',
  'genre',
  'comment',
  'date',
  'composer',
  'duration',
  'bitrate',
]
const INSPECTOR_IDS = [
  'text',
  'title',
  'artist',
  'album',
  'comment',
  'date',
  'track',
  'genre',
  'encodedBy',
  'language',
  'albumArtist',
  'composer',
  'bpm',
  'rating',
]

describe('useViewPreferences – library columns (R-COLUMNS)', () => {
  it('exposes the 11 toggleable columns as an ordered array, all visible by default', () => {
    const { libraryColumns } = useViewPreferences()
    expect(libraryColumns.value.map((c) => c.id)).toEqual(LIBRARY_IDS)
    expect(libraryColumns.value.every((c) => c.visible)).toBe(true)
  })

  it('never includes the always-on Filename column in the toggle set', () => {
    const { libraryColumns } = useViewPreferences()
    expect(libraryColumns.value.some((c) => (c.id as string) === 'filename')).toBe(false)
  })

  it('persists visibility + order and restores them for a fresh instance', () => {
    const { libraryColumns, setLibraryColumns } = useViewPreferences()
    // Hide one column and move it to the front (a reorder + a toggle in one commit).
    const next = [
      { id: 'genre' as const, visible: false },
      ...libraryColumns.value.filter((c) => c.id !== 'genre'),
    ]
    setLibraryColumns(next)
    const fresh = useViewPreferences()
    expect(fresh.libraryColumns.value[0]).toEqual({ id: 'genre', visible: false })
    expect(fresh.libraryColumns.value.find((c) => c.id === 'genre')!.visible).toBe(false)
  })

  it('refuses a commit that would hide every column (not-all-hidden guard)', () => {
    const { libraryColumns, setLibraryColumns } = useViewPreferences()
    setLibraryColumns(libraryColumns.value.map((c) => ({ ...c, visible: false })))
    expect(libraryColumns.value.some((c) => c.visible)).toBe(true)
  })

  it('resets to the default ordered, all-visible set', () => {
    const { libraryColumns, setLibraryColumns, resetLibraryColumns } = useViewPreferences()
    setLibraryColumns([{ id: 'genre' as const, visible: false }, ...libraryColumns.value.filter((c) => c.id !== 'genre')])
    resetLibraryColumns()
    expect(libraryColumns.value.map((c) => c.id)).toEqual(LIBRARY_IDS)
    expect(libraryColumns.value.every((c) => c.visible)).toBe(true)
  })
})

describe('useViewPreferences – inspector fields (R-FIELDS)', () => {
  it('exposes the 14 toggleable inspector fields as an ordered array, all visible by default', () => {
    const { inspectorFields } = useViewPreferences()
    expect(inspectorFields.value.map((f) => f.id)).toEqual(INSPECTOR_IDS)
    expect(inspectorFields.value.every((f) => f.visible)).toBe(true)
  })

  it('never includes the always-on Name field in the toggle set', () => {
    const { inspectorFields } = useViewPreferences()
    expect(inspectorFields.value.some((f) => (f.id as string) === 'name')).toBe(false)
  })

  it('persists visibility + order and restores them for a fresh instance', () => {
    const { inspectorFields, setInspectorFields } = useViewPreferences()
    setInspectorFields([
      { id: 'rating' as const, visible: false },
      ...inspectorFields.value.filter((f) => f.id !== 'rating'),
    ])
    const fresh = useViewPreferences()
    expect(fresh.inspectorFields.value[0]).toEqual({ id: 'rating', visible: false })
  })

  it('refuses a commit that would hide every field (not-all-hidden guard)', () => {
    const { inspectorFields, setInspectorFields } = useViewPreferences()
    setInspectorFields(inspectorFields.value.map((f) => ({ ...f, visible: false })))
    expect(inspectorFields.value.some((f) => f.visible)).toBe(true)
  })
})

describe('useViewPreferences – SSR safety', () => {
  it('falls back to defaults without localStorage (no throw)', () => {
    delete g.localStorage
    expect(() => {
      const { libraryColumns, inspectorFields } = useViewPreferences()
      expect(libraryColumns.value).toHaveLength(LIBRARY_IDS.length)
      expect(inspectorFields.value).toHaveLength(INSPECTOR_IDS.length)
    }).not.toThrow()
  })
})
