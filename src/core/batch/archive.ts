import type { Generation } from '../shared/types'

/** A resolved archive entry: which generation, under what (disambiguated) zip name. */
export interface ArchiveEntry {
  id: string
  path: string
  name: string
}

/**
 * Resolve collision-safe zip entry names for a set of generations. Each entry is
 * named by its stored filename (basename of `path`); duplicate basenames — e.g.
 * the same title generated on different days, which live at distinct dated paths
 * but share a filename — are disambiguated with `_2`, `_3`, … so the archive
 * never silently drops a file (FR-008).
 */
export function resolveArchiveEntries(generations: Generation[]): ArchiveEntry[] {
  const used = new Set<string>()
  return generations.map((g) => {
    const base = g.path.split('/').pop() || g.id
    let name = base
    if (used.has(name)) {
      const dot = base.lastIndexOf('.')
      const stem = dot > 0 ? base.slice(0, dot) : base
      const ext = dot > 0 ? base.slice(dot) : ''
      let n = 2
      while (used.has(name)) {
        name = `${stem}_${n}${ext}`
        n++
      }
    }
    used.add(name)
    return { id: g.id, path: g.path, name }
  })
}
