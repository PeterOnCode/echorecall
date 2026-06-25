import type { Metadata } from '#core/client'
import type { LibraryItem } from './useLibrary'

// 006 · R-DRAFTS (data-model §3.2) — an in-memory, session-scoped per-recording
// staged-edit (dirty) buffer. The tag-editor inspector reads/writes the draft for
// the active recording; switching selection AUTO-PRESERVES staged edits (Q4 — no
// prompt) and returning restores them. Explicit Save commits the active recording's
// draft via the injected `update` (the page wires useLibrary.update) and clears it on
// success. Nothing is persisted — drafts live only for the session. Multiple
// recordings may be dirty at once (the status bar reads `dirtyCount`).

/** The editable view the inspector binds to: the rename base + the tag set. */
export interface TagDraft {
  filenameBase: string
  metadata: Metadata
}

interface DraftEntry {
  /** The saved baseline captured when the draft was first seeded. */
  base: TagDraft
  /** The live, staged values the inspector mutates. */
  draft: TagDraft
}

export interface UseTagDraftsOptions {
  /** Commit path — the page passes `useLibrary.update`; truthy result == success. */
  update: (id: string, patch: { filename?: string; metadata?: Metadata }) => Promise<unknown>
}

/** Base name without the immutable extension (what the editor renames). */
function baseName(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(0, dot) : filename
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T
}

function snapshot(item: LibraryItem): TagDraft {
  return { filenameBase: baseName(item.filename), metadata: clone(item.metadata ?? {}) }
}

export function useTagDrafts(options: UseTagDraftsOptions) {
  // Map of staged edits keyed by recording id. A ref of a plain object (deeply
  // reactive) so inspector mutations drive isDirty / dirtyCount; removal replaces the
  // object immutably (no dynamic `delete`).
  const entries = ref<Record<string, DraftEntry>>({})

  function entryIsDirty(entry: DraftEntry): boolean {
    return JSON.stringify(entry.draft) !== JSON.stringify(entry.base)
  }

  function forget(id: string): void {
    const { [id]: _removed, ...rest } = entries.value
    entries.value = rest
  }

  /**
   * Return the staged editable view for `id`. Seeded from the saved item the first
   * time; subsequently the SAME staged object is returned so edits survive selection
   * switches (auto-preserve).
   */
  function draftFor(id: string, item: LibraryItem): TagDraft {
    if (!entries.value[id]) {
      const base = snapshot(item)
      entries.value = { ...entries.value, [id]: { base, draft: clone(base) } }
    }
    return entries.value[id]!.draft
  }

  function isDirty(id: string): boolean {
    const entry = entries.value[id]
    return entry ? entryIsDirty(entry) : false
  }

  const dirtyCount = computed(() => Object.values(entries.value).filter(entryIsDirty).length)

  /**
   * Commit the active recording's draft via the injected `update`, sending only the
   * changed parts (rename and/or retag). A no-op (nothing changed) succeeds without a
   * request. The draft is cleared on success; on failure it is kept so the edits and
   * the dirty state survive for a retry.
   */
  async function commit(id: string): Promise<{ ok: boolean }> {
    const entry = entries.value[id]
    if (!entry || !entryIsDirty(entry)) return { ok: true }

    const patch: { filename?: string; metadata?: Metadata } = {}
    if (entry.draft.filenameBase !== entry.base.filenameBase) {
      patch.filename = entry.draft.filenameBase
    }
    if (JSON.stringify(entry.draft.metadata) !== JSON.stringify(entry.base.metadata)) {
      patch.metadata = clone(entry.draft.metadata)
    }

    const result = await options.update(id, patch)
    if (result) {
      forget(id)
      return { ok: true }
    }
    return { ok: false }
  }

  /** Drop a recording's staged edits (a fresh draftFor re-seeds from the saved item). */
  function discard(id: string): void {
    forget(id)
  }

  return { draftFor, isDirty, dirtyCount, commit, discard }
}
