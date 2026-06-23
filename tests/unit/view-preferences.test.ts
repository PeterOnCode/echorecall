import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ref, watch } from 'vue'
import { useViewPreferences } from '../../app/composables/useViewPreferences'

// Client-side view preferences (005 · US3 / FR-012, research §R5, data-model §4):
// the queue's visible-column set is persisted per-device in localStorage, with a
// guard that prevents hiding every column. The composable uses Nuxt auto-imports
// (ref/watch) and `globalThis.localStorage`, so this node-env unit test shims the
// reactivity globals and provides an in-memory storage (SSR-safe: with no
// localStorage the composable simply falls back to the defaults).

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

describe('useViewPreferences – queue column visibility', () => {
  it('defaults every queue column to visible', () => {
    const { queueColumns } = useViewPreferences()
    expect(Object.values(queueColumns.value).length).toBeGreaterThan(0)
    expect(Object.values(queueColumns.value).every(Boolean)).toBe(true)
  })

  it('persists a hidden column and restores it for a fresh instance', () => {
    useViewPreferences().setColumn('voice', false)
    // A separate instance (e.g. next page load) reads the persisted state.
    expect(useViewPreferences().queueColumns.value.voice).toBe(false)
  })

  it('prevents hiding the last visible column (not-all-hidden guard, FR-012)', () => {
    const { queueColumns, setColumn } = useViewPreferences()
    const ids = Object.keys(queueColumns.value) as Array<keyof typeof queueColumns.value>

    // Hide every column except the first.
    for (const id of ids.slice(1)) setColumn(id, false)
    const last = ids[0]!
    expect(queueColumns.value[last]).toBe(true)

    // Hiding the final visible column is refused.
    setColumn(last, false)
    expect(queueColumns.value[last]).toBe(true)
    expect(Object.values(queueColumns.value).some(Boolean)).toBe(true)
  })
})
