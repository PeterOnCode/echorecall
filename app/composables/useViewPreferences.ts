// Per-device client view preferences (005 · US3 / FR-012, research §R5, data-model
// §4). The queue table's visible-column set is persisted in localStorage so a user's
// layout choice survives reloads — no server, no schema. SSR-safe: when there is no
// localStorage (server render, or a stripped environment) the composable simply
// falls back to the defaults and skips persistence.

/**
 * The user-toggleable queue columns. The structural `select` (checkbox) and
 * `actions` columns and the primary `text` column are always shown (so a row can
 * always be selected), so they are intentionally NOT part of this set.
 */
export type QueueColumnId = 'source' | 'voice' | 'format' | 'recordedAt' | 'language' | 'status'

const COLUMN_IDS: QueueColumnId[] = ['source', 'voice', 'format', 'recordedAt', 'language', 'status']
const DEFAULT_COLUMNS: Record<QueueColumnId, boolean> = {
  source: true,
  voice: true,
  format: true,
  recordedAt: true,
  language: true,
  status: true,
}
const STORAGE_KEY = 'echorecall:viewprefs:queueColumns'

/** localStorage when present (browser), else undefined (SSR / test without a stub). */
function storage(): Storage | undefined {
  return typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : undefined
}

/** Read the persisted visibility map, keeping only known boolean column flags. */
function readStored(): Partial<Record<QueueColumnId, boolean>> {
  try {
    const raw = storage()?.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: Partial<Record<QueueColumnId, boolean>> = {}
    for (const id of COLUMN_IDS) if (typeof parsed[id] === 'boolean') result[id] = parsed[id] as boolean
    return result
  } catch {
    return {}
  }
}

function persist(value: Record<QueueColumnId, boolean>): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Storage may be unavailable or full; preferences are best-effort.
  }
}

export function useViewPreferences() {
  // Stored value merged over the defaults so a newly-added column defaults to visible.
  const queueColumns = ref<Record<QueueColumnId, boolean>>({ ...DEFAULT_COLUMNS, ...readStored() })
  // Persist on any change (the columns dialog mutates this via v-model, FR-012). Sync
  // flush keeps a fresh instance's read deterministic right after a change.
  watch(queueColumns, (value) => persist(value), { deep: true, flush: 'sync' })

  /**
   * Set a column's visibility, enforcing the not-all-hidden guard (FR-012): the last
   * remaining visible column can't be hidden.
   */
  function setColumn(id: QueueColumnId, visible: boolean): void {
    if (!visible && queueColumns.value[id]) {
      const visibleCount = COLUMN_IDS.filter((c) => queueColumns.value[c]).length
      if (visibleCount <= 1) return
    }
    queueColumns.value = { ...queueColumns.value, [id]: visible }
  }

  return { queueColumns, setColumn }
}
